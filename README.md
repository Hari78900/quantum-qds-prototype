# Q-RATCHET: Teleportation QDS Forensic Gateway
**Deterministic Quantum Digital Signature Threat Detection Engine**  
*Problem Statement Track: SIH26141*

---

## Technical Overview
Q-RATCHET is an end-to-end continuous-variable and discrete-variable quantum digital signature forensics gateway. Rather than relying on heuristic or probabilistic AI/ML classification, Q-RATCHET evaluates physical and mathematical monotones to establish definitive, zero-false-positive intrusion guarantees.

### Core Capabilities
* **Physical Monotone Verification**: Real-time evaluation of EPR-Steering bounds (S_N > 1.0), Peres-Horodecki PPT negativity (N = 0.5), and Local Hidden State (LHS) convex polytope membership.
* **Sequential Probability Ratio Test (SPRT)**: Wald's sequential log-likelihood tracking across incoming qubit streams, triggering early-exit aborts on compromised channels in under 15 measurements (< 5 ms).
* **Interactive 3D Bloch Canvas**: Custom spatial state representation tracking state fidelity, polarization angles, and dynamic state collapse under adversarial perturbation.
* **Deterministic Adversarial Tap**:
  * Intercept-and-Resend Eavesdropping
  * Universal Quantum Cloning Machine (UQCM, F ≈ 5/6)
  * Photon-Number Splitting (PNS)
  * Classical-Quantum Interlocking Man-in-the-Middle (MitM)

---

## Tech Stack
* **Backend**: FastAPI, NumPy, SciPy (Linear Algebra & Entropy Bounds), Uvicorn
* **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, HTML5 Canvas API

---

## Quickstart

### Backend Service
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

### Frontend Dashboard
cd frontend
npm install
npm run dev
