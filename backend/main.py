from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from quantum.execution import execute_deterministic_audit

app = FastAPI(title="Q-RATCHET Teleportation QDS Core", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TeleportAuditRequest(BaseModel):
    state_input: str
    attack_mode: str

@app.get("/api/health")
def health_check():
    return {"status": "ONLINE", "framework": "SIH26141_QDS_DETERMINISTIC"}

@app.post("/api/teleport-audit")
def audit_signature(payload: TeleportAuditRequest):
    return execute_deterministic_audit(payload.state_input, payload.attack_mode)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
