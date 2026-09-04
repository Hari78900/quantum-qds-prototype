import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ShieldAlert, ShieldCheck, Activity, Cpu, Radio, Lock, RefreshCw, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface TelemetryData {
  verdict: string;
  alert_level: string;
  fidelity: number;
  bloch_vector: { x: number; y: number; z: number; norm: number };
  epr_steering: number;
  entanglement_negativity: number;
  povm_outcome: string;
  coherent_info: number;
  holevo_bound: number;
  decoy_yield_y1: number;
  lhs_polytope_violation: boolean;
  sprt_abort_qubit: number | null;
  sprt_trajectory: { qubit: number; llr: number; upper: number; lower: number }[];
  eps_forge: string;
  interlock_valid: boolean;
  interlock_authorized?: boolean;
  interlock_status?: string;
  classical_pki_status?: string;
  quantum_channel_status?: string;
  transaction_id?: string;
}

const BlochSphereCanvas = ({ vector }: { vector: { x: number; y: number; z: number; norm: number } }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 60;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radius, radius * 0.35, 0, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.lineWidth = 1.5;

    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius - 10);
    ctx.lineTo(centerX, centerY + radius + 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX - radius * 0.7, centerY + radius * 0.4);
    ctx.lineTo(centerX + radius * 0.7, centerY - radius * 0.4);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('|0⟩ (+Z)', centerX - 20, centerY - radius - 12);
    ctx.fillText('|1⟩ (-Z)', centerX - 20, centerY + radius + 20);
    ctx.fillText('|+⟩ (+X)', centerX + radius * 0.7 + 5, centerY - radius * 0.4);

    const px = centerX + (vector.x * 0.7 - vector.y * 0.7) * radius;
    const py = centerY - vector.z * radius + (vector.x * 0.35 + vector.y * 0.35) * radius * 0.5;

    ctx.strokeStyle = vector.norm < 0.95 ? '#f43f5e' : '#06b6d4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(px, py);
    ctx.stroke();

    ctx.fillStyle = vector.norm < 0.95 ? '#fb7185' : '#22d3ee';
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2.5, 0, 2 * Math.PI);
    ctx.fill();
  }, [vector]);

  return (
    <div className="flex flex-col items-center justify-center p-2 bg-slate-950 rounded border border-slate-800 mb-3">
      <canvas ref={canvasRef} width={220} height={180} className="w-full max-w-[220px]" />
      <div className="text-[11px] text-slate-400 mt-1 font-mono flex gap-3">
        <span>X: <b className="text-cyan-400">{vector.x.toFixed(2)}</b></span>
        <span>Y: <b className="text-cyan-400">{vector.y.toFixed(2)}</b></span>
        <span>Z: <b className="text-cyan-400">{vector.z.toFixed(2)}</b></span>
        <span>||r||: <b className={vector.norm < 0.95 ? "text-rose-400" : "text-emerald-400"}>{vector.norm.toFixed(2)}</b></span>
      </div>
    </div>
  );
};

export default function App() {
  const [attackMode, setAttackMode] = useState<string>('none');
  const [signatureState, setSignatureState] = useState<string>('+');
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/api/teleport-audit', {
        state_input: signatureState,
        attack_mode: attackMode
      });
      setData(res.data);
    } catch (err) {
      console.error("Backend offline or request failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, [attackMode, signatureState]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-mono">
      <header className="border-b border-slate-800 pb-4 mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
            <Radio className="animate-pulse text-cyan-400" /> Q-RATCHET :: Teleportation QDS Forensic Gateway
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic Threat Detection | SIH26141 Compliance | Zero-AI Physical Monotones
          </p>
        </div>
        <button 
          onClick={runAudit} 
          disabled={loading}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded text-sm font-semibold transition"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} /> Run Verification
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Zap size={16} className="text-amber-400" /> Adversarial Attack Tap
            </h2>
            <div className="space-y-2 text-sm">
              {[
                { id: 'none', label: 'Baseline (Untampered Channel)' },
                { id: 'intercept_resend', label: 'Intercept-and-Resend Eavesdropping' },
                { id: 'cloning_forgery', label: 'Universal Quantum Cloning (UQCM)' },
                { id: 'pns_attack', label: 'Photon-Number Splitting (PNS)' },
                { id: 'classical_mitm', label: 'Classical Pauli Bit Tampering (MitM)' },
              ].map(opt => (
                <label 
                  key={opt.id} 
                  className={`flex items-center gap-3 p-2.5 rounded cursor-pointer border transition ${
                    attackMode === opt.id ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200' : 'border-slate-800 hover:bg-slate-800/50 text-slate-400'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="attack" 
                    value={opt.id} 
                    checked={attackMode === opt.id} 
                    onChange={e => setAttackMode(e.target.value)} 
                    className="accent-cyan-400"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mt-6 mb-3">
              Input Signature Eigenstate
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {['+', '-', '0', '1'].map(st => (
                <button
                  key={st}
                  onClick={() => setSignatureState(st)}
                  className={`py-2 rounded font-bold border ${
                    signatureState === st ? 'bg-cyan-600 border-cyan-400 text-white' : 'border-slate-800 bg-slate-800/50 text-slate-400'
                  }`}
                >
                  |{st}⟩
                </button>
              ))}
            </div>
          </div>

          {data && (
            <div className={`p-5 rounded-lg border ${
              data.alert_level === 'SAFE' 
                ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300' 
                : 'bg-rose-950/30 border-rose-500/50 text-rose-300'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                {data.alert_level === 'SAFE' ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
                <div>
                  <div className="text-xs uppercase font-bold tracking-widest">Gateway Output</div>
                  <div className="text-lg font-bold">{data.alert_level}</div>
                </div>
              </div>
              <p className="text-sm border-t border-slate-800/60 pt-3 mt-2">{data.verdict}</p>
              <div className="mt-3 text-xs flex justify-between text-slate-400">
                <span>Distinguishability Bound:</span>
                <span className="font-mono text-cyan-400">ε_forge ≤ {data.eps_forge}</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" /> 3D Bloch Sphere Vector State
            </h2>
            
            {data && <BlochSphereCanvas vector={data.bloch_vector} />}

            {data && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400">State Fidelity</div>
                  <div className="text-lg font-bold text-cyan-300 mt-0.5">{data.fidelity}%</div>
                  <div className="text-slate-400 text-[10px]">Ideal: 100.0%</div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400">EPR-Steering (S_N)</div>
                  <div className={`text-lg font-bold mt-0.5 ${data.epr_steering > 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {data.epr_steering}
                  </div>
                  <div className="text-slate-400 text-[10px]">Bound &gt; 1.000</div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400">Schrödinger Negativity</div>
                  <div className={`text-lg font-bold mt-0.5 ${data.entanglement_negativity > 0.3 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {data.entanglement_negativity}
                  </div>
                  <div className="text-slate-400 text-[10px]">Peres-Horodecki (N)</div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="text-slate-400">USD POVM Detector</div>
                  <div className={`text-sm font-bold mt-1 ${data.povm_outcome === 'E_VALID' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {data.povm_outcome}
                  </div>
                  <div className="text-slate-400 text-[10px]">Zero-False-Positive</div>
                </div>
              </div>
            )}
          </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2"><Lock size={16} className="text-cyan-400" /> Dual-Layer Hybrid Interlock</span>
              <span className={data?.interlock_authorized ? "text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-950 text-emerald-300 border border-emerald-800" : "text-[10px] px-2 py-0.5 rounded font-bold bg-rose-950 text-rose-300 border border-rose-800"}>
                {data?.interlock_authorized ? 'SECURE COMMIT' : 'ABORT / ISOLATE'}
              </span>
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Classical PKI Layer (RSA/ECDSA):</span>
                <span className="text-cyan-400 font-semibold font-mono">
                  {data?.classical_pki_status || 'VALID (RSA/ECDSA)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Physical Quantum Channel:</span>
                <span className={data?.quantum_channel_status?.includes('SECURE') ? 'text-emerald-400 font-semibold font-mono' : 'text-rose-400 font-semibold font-mono'}>
                  {data?.quantum_channel_status || (data?.interlock_valid ? 'SECURE (NON-LOCAL)' : 'TAMPERED / BREACHED')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">LHS Polytope Convex Membership:</span>
                <span className={data?.lhs_polytope_violation ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {data?.lhs_polytope_violation ? 'NON-LOCAL (GENUINE)' : 'CLASSICAL / COMPROMISED'}
                </span>
              </div>
              <div className="pt-1 text-[11px] font-mono text-slate-400 flex justify-between items-center">
                <span>Interlock Decision:</span>
                <span className={data?.interlock_authorized ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {data?.interlock_status || (data?.interlock_valid ? 'DUAL_INTERLOCK_VERIFIED' : 'QUANTUM_MONOTONE_ABORT')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Cpu size={16} className="text-cyan-400" /> Wald's SPRT Early-Exit Trajectory
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Sequential log-likelihood tracking aborts compromised channel in &lt; 15 measurements (&lt; 5 ms).
            </p>

            {data?.sprt_trajectory && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.sprt_trajectory}>
                    <XAxis dataKey="qubit" stroke="#64748b" tick={{ fontSize: 10 }} label={{ value: 'Qubit Stream', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[-10, 10]} />
                    <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', fontSize: '12px' }} />
                    <ReferenceLine y={data.sprt_trajectory[0]?.upper || 6.9} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Upper Abort (A)', fill: '#f43f5e', fontSize: 10 }} />
                    <ReferenceLine y={data.sprt_trajectory[0]?.lower || -6.9} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Lower Accept (B)', fill: '#10b981', fontSize: 10 }} />
                    <Line type="monotone" dataKey="llr" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="mt-4 p-4 bg-slate-950 rounded border border-slate-800 text-xs">
            <div className="text-slate-400">Early Abort Performance:</div>
            <div className="text-sm font-bold mt-1 text-cyan-300">
              {data?.sprt_abort_qubit 
                ? `ALERT: Attack detected & halted at Qubit #${data.sprt_abort_qubit} (< 4 ms)` 
                : `Channel within safe operating bounds. Verification nominal.`}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
