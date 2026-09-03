import numpy as np
from quantum.engine.qds_core import (
    QuantumForensicsCore, 
    STATE_0, STATE_1, STATE_PLUS, STATE_MINUS,
    SIGMA_X, SIGMA_Y, SIGMA_Z, BELL_PHI_PLUS
)

STATE_LOOKUP = {
    "0": STATE_0,
    "1": STATE_1,
    "+": STATE_PLUS,
    "-": STATE_MINUS
}

def execute_deterministic_audit(state_char: str, attack_mode: str):
    core = QuantumForensicsCore()
    sig_qubit = STATE_LOOKUP.get(state_char, STATE_PLUS)
    rho_bell = np.outer(BELL_PHI_PLUS, np.conj(BELL_PHI_PLUS))

    interlock_valid = (attack_mode != "classical_mitm")

    if attack_mode == "none":
        rec_qubit = sig_qubit
        rho_channel = rho_bell
        s_gain, d_gain = 0.45, 0.09
        is_attack = False
    elif attack_mode == "intercept_resend":
        rec_qubit = STATE_0 if np.random.rand() > 0.5 else STATE_1
        rho_channel = 0.5 * np.eye(4)
        s_gain, d_gain = 0.45, 0.09
        is_attack = True
    elif attack_mode == "cloning_forgery":
        rec_qubit = np.cos(np.pi / 6) * sig_qubit + np.sin(np.pi / 6) * np.array([sig_qubit[1], -sig_qubit[0]])
        rho_channel = 0.5 * np.eye(4)
        s_gain, d_gain = 0.45, 0.09
        is_attack = True
    elif attack_mode == "pns_attack":
        rec_qubit = sig_qubit
        rho_channel = rho_bell
        s_gain, d_gain = 0.48, 0.02
        is_attack = True
    else:  # classical_mitm
        rec_qubit = SIGMA_X @ sig_qubit
        rho_channel = rho_bell
        s_gain, d_gain = 0.45, 0.09
        is_attack = True

    povm_outcome, fidelity = core.evaluate_usd_povm(sig_qubit, rec_qubit)
    epr_val = core.evaluate_epr_steering(rho_channel)
    negativity_val = core.evaluate_peres_horodecki_negativity(rho_channel)
    coherent_info, holevo_bound = core.compute_coherent_and_holevo(fidelity)
    y1_yield = core.evaluate_decoy_yield(s_gain, d_gain)
    lhs_violation = core.evaluate_lhs_polytope(epr_val)
    sprt_trajectory, sprt_abort_qubit = core.compute_sprt_trajectory(is_attack)

    bx = float(np.real(np.vdot(rec_qubit, SIGMA_X @ rec_qubit)))
    by = float(np.real(np.vdot(rec_qubit, SIGMA_Y @ rec_qubit)))
    bz = float(np.real(np.vdot(rec_qubit, SIGMA_Z @ rec_qubit)))
    bnorm = float(np.sqrt(bx**2 + by**2 + bz**2))

    if not interlock_valid:
        verdict = "REJECT: Dual-Channel Classical MitM Tampering Detected"
        alert_level = "CRITICAL"
    elif y1_yield < 0.20:
        verdict = "REJECT: Photon-Number Splitting (PNS) Attack on Weak Coherent Pulse"
        alert_level = "HIGH"
    elif negativity_val < 0.10:
        verdict = "REJECT: Universal Quantum Cloning Forgery (Peres-Horodecki Negativity Collapsed)"
        alert_level = "CRITICAL"
    elif epr_val <= 1.0:
        verdict = "REJECT: Untrusted Hardware Source (EPR-Steering Violation)"
        alert_level = "HIGH"
    elif povm_outcome == "E_ATTACK" or sprt_abort_qubit is not None:
        verdict = f"REJECT: Intercept-Resend Eavesdropping (SPRT Abort at Qubit #{sprt_abort_qubit})"
        alert_level = "CRITICAL"
    else:
        verdict = "ACCEPT: Signature Authenticated (Quantum Ratchet Advanced)"
        alert_level = "SAFE"

    delta = max(0.0, 1.0 - np.sqrt(fidelity))
    eps_forge = float(2.0 * np.exp(- (128 * (1.0 - 2.0 * delta)**2) / 8.0) + 1e-10)

    return {
        "verdict": verdict,
        "alert_level": alert_level,
        "fidelity": round(fidelity * 100, 2),
        "bloch_vector": {"x": bx, "y": by, "z": bz, "norm": bnorm},
        "epr_steering": round(epr_val, 4),
        "entanglement_negativity": round(negativity_val, 4),
        "povm_outcome": povm_outcome,
        "coherent_info": round(coherent_info, 4),
        "holevo_bound": round(holevo_bound, 4),
        "decoy_yield_y1": round(y1_yield, 4),
        "lhs_polytope_violation": lhs_violation,
        "sprt_abort_qubit": sprt_abort_qubit,
        "sprt_trajectory": sprt_trajectory,
        "eps_forge": f"{eps_forge:.2e}",
        "interlock_valid": interlock_valid
    }
