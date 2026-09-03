import numpy as np
from scipy.optimize import linprog

I_2 = np.array([[1, 0], [0, 1]], dtype=complex)
SIGMA_X = np.array([[0, 1], [1, 0]], dtype=complex)
SIGMA_Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
SIGMA_Z = np.array([[1, 0], [0, -1]], dtype=complex)

STATE_0 = np.array([1, 0], dtype=complex)
STATE_1 = np.array([0, 1], dtype=complex)
STATE_PLUS = (STATE_0 + STATE_1) / np.sqrt(2)
STATE_MINUS = (STATE_0 - STATE_1) / np.sqrt(2)

BELL_PHI_PLUS = (np.kron(STATE_0, STATE_0) + np.kron(STATE_1, STATE_1)) / np.sqrt(2)

class QuantumForensicsCore:
    def __init__(self, alpha=0.001, beta=0.001, p0=0.02, p1=0.25):
        self.A = np.log((1 - beta) / alpha)
        self.B = np.log(beta / (1 - alpha))
        self.p0 = p0
        self.p1 = p1

    @staticmethod
    def evaluate_epr_steering(rho_shared: np.ndarray) -> float:
        corrs = [
            np.abs(np.real(np.trace(rho_shared @ np.kron(SIGMA_X, SIGMA_X)))),
            np.abs(np.real(np.trace(rho_shared @ np.kron(SIGMA_Y, SIGMA_Y)))),
            np.abs(np.real(np.trace(rho_shared @ np.kron(SIGMA_Z, SIGMA_Z))))
        ]
        return float(np.sum(corrs) / np.sqrt(3))

    @staticmethod
    def evaluate_peres_horodecki_negativity(rho: np.ndarray) -> float:
        rho_pt = np.zeros_like(rho)
        for i in range(2):
            for j in range(2):
                for k in range(2):
                    for l in range(2):
                        rho_pt[2 * i + l, 2 * j + k] = rho[2 * i + k, 2 * j + l]
        eigvals = np.linalg.eigvalsh(rho_pt)
        return float(max(0.0, (np.sum(np.abs(eigvals)) - 1.0) / 2.0))

    @staticmethod
    def evaluate_usd_povm(ideal_state: np.ndarray, received_state: np.ndarray):
        fidelity = float(np.clip(np.real(np.vdot(ideal_state, received_state) * np.vdot(received_state, ideal_state)), 0.0, 1.0))
        p_valid = max(0.0, 1.0 - np.sqrt(1.0 - fidelity))
        p_attack = max(0.0, (1.0 - fidelity) * 0.85)
        
        roll = np.random.rand()
        if roll < p_valid:
            outcome = "E_VALID"
        elif roll < p_valid + p_attack:
            outcome = "E_ATTACK"
        else:
            outcome = "E_INCONCLUSIVE"
        return outcome, fidelity

    @staticmethod
    def evaluate_decoy_yield(s_gain: float, d_gain: float, mu: float = 0.5, nu: float = 0.1) -> float:
        num = d_gain * np.exp(nu) - s_gain * np.exp(mu) * ((nu ** 2) / (mu ** 2))
        den = mu * nu - nu ** 2
        return float((mu / den) * num)

    @staticmethod
    def compute_coherent_and_holevo(fidelity: float):
        p = float(np.clip(1.0 - fidelity, 1e-12, 1.0 - 1e-12))
        h_p = -p * np.log2(p) - (1 - p) * np.log2(1 - p) if p < 0.5 else 1.0
        coherent_info = float(max(-1.0, 1.0 - 2.0 * h_p))
        holevo_bound = float(h_p)
        return coherent_info, holevo_bound

    @staticmethod
    def evaluate_lhs_polytope(steering_val: float) -> bool:
        c = [0, 0]
        a_ub = [[1, 1], [-1, 0], [0, -1]]
        b_ub = [1.0, 0, 0]
        res = linprog(c, A_ub=a_ub, b_ub=b_ub, method="highs")
        return bool(steering_val > 1.0 and res.success)

    def compute_sprt_trajectory(self, is_attack: bool):
        llr = 0.0
        trajectory = []
        aborted_at = None
        for step in range(1, 31):
            prob = self.p1 if is_attack else self.p0
            has_error = np.random.rand() < prob
            delta = np.log(self.p1 / self.p0) if has_error else np.log((1 - self.p1) / (1 - self.p0))
            llr += delta
            trajectory.append({
                "qubit": step, 
                "llr": float(llr), 
                "upper": float(self.A), 
                "lower": float(self.B)
            })
            if llr >= self.A and aborted_at is None:
                aborted_at = step
                break
            elif llr <= self.B and aborted_at is None and not is_attack:
                break
        return trajectory, aborted_at
