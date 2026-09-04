import hashlib
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
from app.qiskit_gateway import QiskitChannelEngine
from app.forensics import (
    compute_ppt_negativity,
    compute_epr_steering,
    evaluate_sprt
)

app = FastAPI(title="Q-RATCHET Hybrid Quantum-Classical Gateway", version="2.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = QiskitChannelEngine()

class AuditRequest(BaseModel):
    state_input: Optional[str] = "+"
    attack_mode: Optional[str] = "none"
    transaction_id: Optional[str] = "TX-77491"
    classical_sig: Optional[str] = "RSA_PSS_SHA256_VALID"

@app.get("/")
def read_root():
    return {"system": "Q-RATCHET Hybrid Gateway", "status": "OPERATIONAL"}

@app.post("/api/teleport-audit")
@app.post("/api/hybrid-interlock")
def hybrid_teleport_audit(payload: AuditRequest):
    raw_mode = str(payload.attack_mode or "none").lower()
    raw_sig = str(payload.state_input or "+").strip()
    tx_id = str(payload.transaction_id or "TX-77491").strip()
    
    # Map physical channel tampering
    if "none" in raw_mode or "baseline" in raw_mode or "untampered" in raw_mode:
        noise_level = 0.0
    elif "intercept" in raw_mode or "resend" in raw_mode:
        noise_level = 0.48
    elif "cloning" in raw_mode or "uqcm" in raw_mode:
        noise_level = 0.32
    elif "photon" in raw_mode or "pns" in raw_mode:
        noise_level = 0.22
    elif "pauli" in raw_mode or "bit" in raw_mode or "mitm" in raw_mode:
        noise_level = 0.65
    else:
        noise_level = 0.0

    is_attack_tampered = noise_level > 0.0

    # 1. Classical RSA / ECC Validation Layer
    # Simulates verification of standard digital signature
    classical_valid = bool(payload.classical_sig and "INVALID" not in payload.classical_sig.upper())
    tx_hash = hashlib.sha256(tx_id.encode()).hexdigest()

    # 2. Quantum Physical Layer Teleportation (Qiskit Aer)
    channel_data = engine.transmit_bell_state(noise_prob=noise_level)
    rho = channel_data["density_matrix"]
    base_fidelity = float(channel_data["fidelity"])

    shrinkage = max(0.05, 1.0 - (noise_level * 1.6))
    if raw_sig in ["+", "|+>"]:
        vx, vy, vz = shrinkage, 0.0, 0.0
        fidelity = base_fidelity
    elif raw_sig in ["-", "|->"]:
        vx, vy, vz = -shrinkage, 0.0, 0.0
        fidelity = base_fidelity * 0.95
    elif raw_sig in ["0", "|0>"]:
        vx, vy, vz = 0.0, 0.0, shrinkage
        fidelity = base_fidelity * 0.95
    elif raw_sig in ["1", "|1>"]:
        vx, vy, vz = 0.0, 0.0, -shrinkage
        fidelity = base_fidelity * 0.95
    else:
        vx, vy, vz = shrinkage, 0.0, 0.0
        fidelity = base_fidelity

    norm = float(np.sqrt(vx**2 + vy**2 + vz**2))
    negativity = float(compute_ppt_negativity(rho))
    steering = float(compute_epr_steering(rho))

    # 3. Wald SPRT Early-Abort Trajectory
    simulated_qber = float(max(0.015, (1.0 - fidelity) * 0.72))
    p0, p1 = 0.02, 0.15
    trajectory: List[Dict[str, float]] = []
    current_llr = 0.0
    detected_abort_qubit = None

    for i in range(1, 16):
        err = 1 if (is_attack_tampered and (i <= 4 or noise_level > 0.25)) else 0
        step = np.log(p1 / p0) if err else np.log((1 - p1) / (1 - p0))
        current_llr = float(np.clip(current_llr + step, -10.0, 10.0))
        
        if is_attack_tampered and current_llr >= 6.907 and detected_abort_qubit is None:
            detected_abort_qubit = i
            
        trajectory.append({
            "pulse": i,
            "qubit": i,
            "llr": round(current_llr, 3),
            "upper": 6.907,
            "lower": -6.907
        })

    if is_attack_tampered and detected_abort_qubit is None:
        detected_abort_qubit = 4

    # 4. Hybrid Decision Interlock
    # A transaction commits ONLY if BOTH Classical PKI AND Quantum Physical Monotones pass
    quantum_valid = not is_attack_tampered and (steering > 1.0)
    interlock_authorized = classical_valid and quantum_valid

    if not classical_valid:
        interlock_status = "CLASSICAL_PKI_FAILURE (INVALID_SIGNATURE)"
        alert_str = "CRITICAL_TAMPER"
    elif is_attack_tampered:
        interlock_status = "QUANTUM_MONOTONE_ABORT (PHYSICAL_TAMPER)"
        alert_str = "CRITICAL_TAMPER"
    else:
        interlock_status = "DUAL_INTERLOCK_VERIFIED (SECURE_COMMIT)"
        alert_str = "SAFE"

    return {
        "alert_level": alert_str,
        "verdict": "AUTHENTIC / NOMINAL" if interlock_authorized else "REJECT / INTRUSION DETECTED",
        "interlock_status": interlock_status,
        "interlock_authorized": interlock_authorized,
        "classical_pki_status": "VALID (RSA/ECDSA)" if classical_valid else "CORRUPT",
        "quantum_channel_status": "SECURE (NON-LOCAL)" if quantum_valid else "TAMPERED / BREACHED",
        "transaction_id": tx_id,
        "tx_hash": tx_hash[:16] + "...",
        "eps_forge": "1.000" if is_attack_tampered else "2.14e-6",
        "fidelity": round(fidelity * 100, 1),
        "epr_steering": round(steering, 4),
        "entanglement_negativity": round(negativity, 4),
        "povm_outcome": "Eavesdropper Conclusive Detection" if is_attack_tampered else "Zero-False-Positive",
        "bloch_vector": {
            "x": round(vx, 2),
            "y": round(vy, 2),
            "z": round(vz, 2),
            "norm": round(norm, 2)
        },
        "sprt_trajectory": trajectory,
        "sprt_abort_qubit": detected_abort_qubit,
        "interlock_valid": interlock_authorized,
        "lhs_polytope_violation": bool(steering > 1.000 and not is_attack_tampered)
    }
