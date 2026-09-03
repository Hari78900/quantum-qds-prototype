from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.qiskit_gateway import QiskitChannelEngine
from app.forensics import (
    compute_ppt_negativity,
    compute_epr_steering,
    extract_bloch_coordinates,
    evaluate_sprt
)

app = FastAPI(title="Q-RATCHET Quantum Forensic Gateway", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = QiskitChannelEngine()

class TelemetryRequest(BaseModel):
    attack_type: str = "NONE"
    noise_intensity: float = 0.0

@app.get("/")
def read_root():
    return {
        "system": "Q-RATCHET Forensic Gateway",
        "backend": "IBM Qiskit Aer 1.x",
        "status": "OPERATIONAL"
    }

@app.post("/api/quantum/telemetry")
def get_telemetry(payload: TelemetryRequest):
    noise_level = float(payload.noise_intensity) if payload.attack_type != "NONE" else 0.0

    channel_data = engine.transmit_bell_state(noise_prob=noise_level)
    rho = channel_data["density_matrix"]
    fidelity = float(channel_data["fidelity"])

    negativity = float(compute_ppt_negativity(rho))
    steering = float(compute_epr_steering(rho))
    bloch = extract_bloch_coordinates(rho)

    simulated_qber = float(max(0.01, (1.0 - fidelity) * 0.6))
    sprt = evaluate_sprt(simulated_qber)

    return {
        "status": "SUCCESS",
        "monotones": {
            "ppt_negativity": round(negativity, 4),
            "epr_steering": round(steering, 4),
            "state_fidelity": round(fidelity, 4),
            "simulated_qber": round(simulated_qber, 4)
        },
        "sprt_decision": sprt,
        "bloch_vector": {
            "x": float(bloch["x"]),
            "y": float(bloch["y"]),
            "z": float(bloch["z"])
        },
        "attack_mode": str(payload.attack_type)
    }
