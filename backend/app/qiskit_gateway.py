import numpy as np
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from qiskit.quantum_info import DensityMatrix, state_fidelity
from qiskit_aer.noise import NoiseModel, depolarizing_error

class QiskitChannelEngine:
    def __init__(self):
        self.simulator = AerSimulator(method="density_matrix")

    def transmit_bell_state(self, noise_prob: float = 0.0) -> dict:
        qc = QuantumCircuit(2)
        qc.h(0)
        qc.cx(0, 1)

        noise_model = None
        # Clamp noise to valid Qiskit single-qubit channel range
        p = min(max(float(noise_prob), 0.0), 0.75)
        if p > 0.0:
            noise_model = NoiseModel()
            error_1q = depolarizing_error(p, 1)
            noise_model.add_all_qubit_quantum_error(error_1q, ['h', 'x', 'id'])

        qc.save_density_matrix()

        result = self.simulator.run(qc, noise_model=noise_model).result()
        rho_aer = result.data(0)['density_matrix']
        rho = np.array(rho_aer.data, dtype=complex)

        # Theoretical ideal Bell state |Phi+>
        bell_vec = np.zeros(4, dtype=complex)
        bell_vec[0] = 1.0 / np.sqrt(2)
        bell_vec[3] = 1.0 / np.sqrt(2)
        ideal_dm = DensityMatrix(bell_vec)
        
        fidelity = float(np.real(state_fidelity(DensityMatrix(rho), ideal_dm)))

        return {
            "density_matrix": rho,
            "fidelity": fidelity
        }
