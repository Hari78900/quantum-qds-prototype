import numpy as np

def partial_transpose_2qubit(rho: np.ndarray) -> np.ndarray:
    """
    Computes partial transpose with respect to Subsystem A (rho^{T_A})
    for a 4x4 bipartite density matrix.
    """
    rho_ta = np.zeros((4, 4), dtype=complex)
    for i in range(2):
        for j in range(2):
            for k in range(2):
                for l in range(2):
                    row = 2 * i + k
                    col = 2 * j + l
                    ta_row = 2 * j + k
                    ta_col = 2 * i + l
                    rho_ta[ta_row, ta_col] = rho[row, col]
    return rho_ta

def compute_ppt_negativity(rho: np.ndarray) -> float:
    """
    Peres-Horodecki criterion: N(rho) = sum(|lambda_i| - lambda_i) / 2
    N > 0 strictly proves entanglement. N = 0.5 for pure Bell states.
    """
    rho_ta = partial_transpose_2qubit(rho)
    eigenvalues = np.linalg.eigvalsh(rho_ta)
    negativity = float(np.sum(np.abs(eigenvalues) - eigenvalues) / 2.0)
    return round(negativity, 4)

def compute_epr_steering(rho: np.ndarray) -> float:
    """
    Evaluates 3-setting steering inequality S_N across Pauli matrices.
    S_N > 1.0 proves steerability / channel integrity against untrusted sources.
    """
    pauli_x = np.array([[0, 1], [1, 0]], dtype=complex)
    pauli_y = np.array([[0, -1j], [1j, 0]], dtype=complex)
    pauli_z = np.array([[1, 0], [0, -1]], dtype=complex)

    c_xx = np.real(np.trace(rho @ np.kron(pauli_x, pauli_x)))
    c_yy = np.real(np.trace(rho @ np.kron(pauli_y, pauli_y)))
    c_zz = np.real(np.trace(rho @ np.kron(pauli_z, pauli_z)))

    s_n = (1.0 / np.sqrt(3)) * (np.abs(c_xx) + np.abs(c_yy) + np.abs(c_zz))
    return round(float(s_n), 4)

def extract_bloch_coordinates(rho: np.ndarray) -> dict:
    """
    Traces out subsystem B to get single-qubit reduced density matrix rho_A,
    then projects onto Pauli axes for Three.js rendering.
    """
    rho_a = np.zeros((2, 2), dtype=complex)
    rho_a[0, 0] = rho[0, 0] + rho[1, 1]
    rho_a[0, 1] = rho[0, 2] + rho[1, 3]
    rho_a[1, 0] = rho[2, 0] + rho[3, 1]
    rho_a[1, 1] = rho[2, 2] + rho[3, 3]

    pauli_x = np.array([[0, 1], [1, 0]], dtype=complex)
    pauli_y = np.array([[0, -1j], [1j, 0]], dtype=complex)
    pauli_z = np.array([[1, 0], [0, -1]], dtype=complex)

    x = float(np.real(np.trace(rho_a @ pauli_x)))
    y = float(np.real(np.trace(rho_a @ pauli_y)))
    z = float(np.real(np.trace(rho_a @ pauli_z)))

    return {"x": round(x, 4), "y": round(y, 4), "z": round(z, 4)}

def evaluate_sprt(qber: float, n_pulses: int = 12) -> dict:
    """
    Wald's Sequential Probability Ratio Test (SPRT).
    H0: Channel intact (QBER <= 0.02)
    H1: Active tap / intrusion (QBER >= 0.15)
    """
    alpha = 0.001
    beta = 0.001

    upper_bound = np.log((1 - beta) / alpha)
    lower_bound = np.log(beta / (1 - alpha))

    p0 = 0.02
    p1 = 0.15

    errors = int(np.round(qber * n_pulses))
    log_likelihood = (
        errors * np.log(p1 / p0) +
        (n_pulses - errors) * np.log((1 - p1) / (1 - p0))
    )

    if log_likelihood >= upper_bound:
        decision = "ABORT_INTRUSION_DETECTED"
    elif log_likelihood <= lower_bound:
        decision = "ACCEPT_CHANNEL_AUTHENTIC"
    else:
        decision = "CONTINUE_MONITORING"

    return {
        "decision": decision,
        "llr": round(float(log_likelihood), 4),
        "upper_bound": round(float(upper_bound), 4),
        "pulses_tested": n_pulses,
        "latency_ms": round(float(n_pulses * 0.32), 2)
    }
