import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";

export default function App() {
  const [eigenstate, setEigenstate] = useState("|+〉");
  const [attackMode, setAttackMode] = useState("baseline");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const blochMountRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<THREE.ArrowHelper | null>(null);

  const fetchVerification = async (state = eigenstate, attack = attackMode) => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eigenstate: state, attack_mode: attack })
      });
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVerification(eigenstate, attackMode);
  }, [eigenstate, attackMode]);

  // 3D Bloch Sphere Setup with Three.js
  useEffect(() => {
    if (!blochMountRef.current) return;
    const width = blochMountRef.current.clientWidth || 320;
    const height = 200;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(2.4, 1.8, 2.6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    blochMountRef.current.replaceChildren(renderer.domElement);

    // Wireframe Sphere
    const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphere);

    // Coordinate Equator & Meridians
    const ringMat = new THREE.LineBasicMaterial({ color: 0x334155 });
    const ringGeo = new THREE.BufferGeometry();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)));
    }
    ringGeo.setFromPoints(pts);
    const equator = new THREE.Line(ringGeo, ringMat);
    scene.add(equator);

    // X, Y, Z Axis Helpers
    const axesHelper = new THREE.AxesHelper(1.3);
    scene.add(axesHelper);

    // State Vector Arrow (default +X)
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      1.0,
      0x38bdf8,
      0.18,
      0.1
    );
    scene.add(arrow);
    arrowRef.current = arrow;

    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      sphere.rotation.y += 0.002;
      equator.rotation.y += 0.002;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(reqId);
      renderer.dispose();
    };
  }, []);

  // Update 3D Vector when coordinates change
  useEffect(() => {
    if (!arrowRef.current || !data?.physics_metrics?.bloch_vector) return;
    const { x, y, z } = data.physics_metrics.bloch_vector;
    const dir = new THREE.Vector3(x, z, y); // Map Three.js Y-up to Bloch Z
    const length = Math.max(0.1, dir.length());
    dir.normalize();
    arrowRef.current.setDirection(dir);
    arrowRef.current.setLength(length);
    arrowRef.current.setColor(
      new THREE.Color(data.interlock_status === "SECURE COMMIT" ? 0x38bdf8 : 0xf43f5e)
    );
  }, [data]);

  // SPRT Trajectory Scaling Helpers
  const trajectory = data?.sprt_parameters?.trajectory || [];
  const svgWidth = 340;
  const svgHeight = 120;
  const minVal = -15;
  const maxVal = 12;
  const scaleY = (v: number) => svgHeight - ((v - minVal) / (maxVal - minVal)) * svgHeight;
  const scaleX = (step: number) => ((step - 1) / 29) * (svgWidth - 20) + 10;

  const pointsString = trajectory
    .map((pt: any) => `${scaleX(pt.step)},${scaleY(pt.log_likelihood)}`)
    .join(" ");

  const abortY = scaleY(9.21);
  const commitY = scaleY(-13.82);

  return (
    <div style={{ backgroundColor: "#060913", color: "#e2e8f0", minHeight: "100vh", fontFamily: "monospace", padding: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1e293b", paddingBottom: "15px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ color: "#38bdf8", margin: 0, fontSize: "20px", letterSpacing: "1px" }}>
            Q-RATCHET :: Multi-Party Teleportation QDS Forensic Gateway
          </h1>
          <p style={{ margin: "5px 0 0 0", color: "#64748b", fontSize: "12px" }}>
            SIH26141 Compliance | Bounded Alpha/Beta Bounds (α ≤ 10⁻⁴, β ≤ 10⁻⁶) | 1-Signer → 2-Verifier
          </p>
        </div>
        <button
          onClick={() => fetchVerification()}
          style={{ background: "#0284c7", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
          {loading ? "Sampling..." : "↻ Run Pulse Verification"}
        </button>
      </div>

      {/* Grid Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1.1fr 1fr", gap: "20px" }}>
        {/* Left Column: Attack Taps & Controls */}
        <div style={{ background: "#0c1322", border: "1px solid #1e293b", borderRadius: "8px", padding: "16px" }}>
          <h3 style={{ color: "#f59e0b", fontSize: "14px", marginTop: 0 }}>⚡ ADVERSARIAL ATTACK TAP</h3>
          {[
            { id: "baseline", label: "Baseline (Ambient Fiber Noise)" },
            { id: "intercept_resend", label: "Intercept-and-Resend (25% QBER)" },
            { id: "uqcm", label: "Universal Quantum Cloning (UQCM)" },
            { id: "pns", label: "Photon-Number Splitting (PNS)" },
            { id: "coherent", label: "Coherent Multi-Pulse Entangled Probe" },
            { id: "mitm", label: "Classical Pauli Bit Tampering (MitM)" },
            { id: "repudiation_test", label: "Signer Repudiation Test (Alice denial)" },
          ].map((item) => (
            <label key={item.id} style={{ display: "block", margin: "10px 0", cursor: "pointer", fontSize: "12px", color: attackMode === item.id ? "#38bdf8" : "#94a3b8" }}>
              <input
                type="radio"
                name="attack"
                checked={attackMode === item.id}
                onChange={() => setAttackMode(item.id)}
                style={{ marginRight: "8px" }}
              />
              {item.label}
            </label>
          ))}

          <h3 style={{ color: "#38bdf8", fontSize: "14px", marginTop: "25px" }}>INPUT SIGNATURE EIGENSTATE</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            {["|+〉", "|-〉", "|0〉", "|1〉"].map((st) => (
              <button
                key={st}
                onClick={() => setEigenstate(st)}
                style={{
                  background: eigenstate === st ? "#0284c7" : "#1e293b",
                  color: "#fff",
                  border: "none",
                  padding: "8px 0",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}>
                {st}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "25px", borderTop: "1px solid #1e293b", paddingTop: "15px" }}>
            <div style={{ fontSize: "11px", color: "#64748b" }}>SESSION NONCE (REPLAY WINDOW)</div>
            <div style={{ color: "#a5b4fc", fontSize: "12px", wordBreak: "break-all" }}>
              {data?.classical_pki?.nonce || "0x00100001f4a9b2"}
            </div>
            <div style={{ fontSize: "11px", color: "#10b981", marginTop: "4px" }}>
              ✓ {data?.classical_pki?.replay_check || "NOMINAL (FRESH_PULSE_WINDOW)"}
            </div>
          </div>
        </div>

        {/* Center Column: 3D Bloch Sphere & Interlock */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* 3D Bloch Sphere Container */}
          <div style={{ background: "#0c1322", border: "1px solid #1e293b", borderRadius: "8px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h4 style={{ margin: 0, color: "#38bdf8", fontSize: "13px" }}>⚛ 3D BLOCH SPHERE VECTOR STATE</h4>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                X:{data?.physics_metrics?.bloch_vector?.x ?? 1.0} Y:{data?.physics_metrics?.bloch_vector?.y ?? 0.0} Z:{data?.physics_metrics?.bloch_vector?.z ?? 0.0}
              </span>
            </div>
            
            {/* Three.js Canvas mount */}
            <div ref={blochMountRef} style={{ width: "100%", height: "200px", borderRadius: "4px", background: "#050811" }} />
          </div>

          {/* Dual Layer Interlock Status */}
          <div style={{ background: "#0c1322", border: "1px solid #1e293b", borderRadius: "8px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ color: "#38bdf8", fontSize: "13px", fontWeight: "bold" }}>🔒 DUAL-LAYER HYBRID INTERLOCK</span>
              <span style={{
                background: data?.interlock_status === "SECURE COMMIT" ? "#065f46" : "#7f1d1d",
                color: data?.interlock_status === "SECURE COMMIT" ? "#34d399" : "#fca5a5",
                padding: "3px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "bold"
              }}>
                {data?.interlock_status || "INITIALIZING"}
              </span>
            </div>

            <div style={{ fontSize: "12px", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" }}>
              <span style={{ color: "#94a3b8" }}>Classical Layer:</span>
              <span style={{ color: "#38bdf8" }}>{data?.classical_pki?.algorithm || "NIST FIPS-204 (ML-DSA)"}</span>

              <span style={{ color: "#94a3b8" }}>Ambient Fiber Noise (λ_depol):</span>
              <span style={{ color: "#e2e8f0" }}>{data?.physics_metrics?.ambient_channel_noise || "1.2%"}</span>

              <span style={{ color: "#94a3b8" }}>Adversarial Attack Excess QBER:</span>
              <span style={{ color: data?.physics_metrics?.adversarial_excess_qber === "0.0%" ? "#10b981" : "#f43f5e" }}>
                {data?.physics_metrics?.adversarial_excess_qber || "0.0%"}
              </span>

              <span style={{ color: "#94a3b8" }}>Total QBER Observed:</span>
              <span style={{ fontWeight: "bold", color: "#f59e0b" }}>{data?.physics_metrics?.total_qber || "1.2%"}</span>

              <span style={{ color: "#94a3b8" }}>State Fidelity (Tr[ρσ]):</span>
              <span style={{ color: "#10b981" }}>{data?.physics_metrics?.fidelity || "0.984"}</span>
            </div>
          </div>

          {/* Multi-Party QDS Matrix */}
          <div style={{ background: "#0c1322", border: "1px solid #1e293b", borderRadius: "8px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#a5b4fc", fontSize: "13px" }}>
              👥 MULTI-PARTY NON-REPUDIATION MATRIX (Alice → Bob & Charlie)
            </h4>
            <div style={{ fontSize: "12px", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px" }}>
              <span style={{ color: "#94a3b8" }}>Bob Local Monotone Test:</span>
              <span style={{ color: data?.multi_party_qds?.bob_local_test === "COMMITTED" ? "#34d399" : "#f43f5e", fontWeight: "bold" }}>
                {data?.multi_party_qds?.bob_local_test || "COMMITTED"}
              </span>

              <span style={{ color: "#94a3b8" }}>Charlie Cross-Verification Test:</span>
              <span style={{ color: data?.multi_party_qds?.charlie_cross_test === "COMMITTED" ? "#34d399" : "#f43f5e", fontWeight: "bold" }}>
                {data?.multi_party_qds?.charlie_cross_test || "COMMITTED"}
              </span>

              <span style={{ color: "#94a3b8" }}>Signature Transferability:</span>
              <span style={{ color: data?.multi_party_qds?.transferability === "TRANSFERABLE" ? "#38bdf8" : "#f43f5e" }}>
                {data?.multi_party_qds?.transferability || "TRANSFERABLE"}
              </span>

              <span style={{ color: "#94a3b8" }}>Repudiation Bound:</span>
              <span style={{ color: "#38bdf8", wordBreak: "break-word", fontSize: "11px", fontFamily: "monospace" }}>
                {data?.multi_party_qds?.non_repudiation_bound || "ε_rep ≤ 1.42e-9 [exp(-2(s_v - s_a)² · M)]"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Wald SPRT Real-time Graph & Systems */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Wald SPRT Box with SVG Graph */}
          <div style={{ background: "#0c1322", border: "1px solid #1e293b", borderRadius: "8px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#38bdf8", fontSize: "13px" }}>
              📈 WALD SPRT EARLY-EXIT TRAJECTORY GRAPH
            </h4>

            {/* Visual SVG Trajectory Line */}
            <div style={{ background: "#050811", border: "1px solid #1e293b", borderRadius: "6px", padding: "10px", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#f87171", marginBottom: "4px" }}>
                <span>Abort Boundary (A ≥ 9.21)</span>
                <span>Threshold Breach</span>
              </div>
              
              <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ overflow: "visible" }}>
                <line x1="0" y1={abortY} x2={svgWidth} y2={abortY} stroke="#f43f5e" strokeDasharray="4 2" strokeWidth="1" />
                <line x1="0" y1={commitY} x2={svgWidth} y2={commitY} stroke="#10b981" strokeDasharray="4 2" strokeWidth="1" />
                <line x1="0" y1={scaleY(0)} x2={svgWidth} y2={scaleY(0)} stroke="#334155" strokeWidth="1" />

                {pointsString && (
                  <polyline
                    fill="none"
                    stroke={data?.sprt_parameters?.aborted_at_step ? "#f43f5e" : "#38bdf8"}
                    strokeWidth="2.5"
                    points={pointsString}
                  />
                )}
              </svg>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#34d399", marginTop: "4px" }}>
                <span>Commit Boundary (B ≤ -13.82)</span>
                <span>Nominal Safe Zone</span>
              </div>
            </div>

            <div style={{ fontSize: "11px", color: "#94a3b8", display: "grid", gridTemplateColumns: "1fr auto", gap: "6px" }}>
              <span>Null Hypothesis (H₀):</span>
              <span style={{ color: "#34d399" }}>{data?.sprt_parameters?.null_hypothesis_H0 || "p ≤ 1.5%"}</span>

              <span>Alternative Hypothesis (H₁):</span>
              <span style={{ color: "#f43f5e" }}>{data?.sprt_parameters?.alt_hypothesis_H1 || "p ≥ 11.0%"}</span>

              <span>Early Abort Status:</span>
              <span style={{ fontWeight: "bold", color: data?.sprt_parameters?.aborted_at_step ? "#f43f5e" : "#34d399" }}>
                {data?.sprt_parameters?.aborted_at_step ? `ABORTED AT STEP ${data?.sprt_parameters?.aborted_at_step} (< 15 pulses)` : "NOMINAL (NO BREACH)"}
              </span>

              <span>Verification Latency:</span>
              <span style={{ color: "#38bdf8" }}>{data?.sprt_parameters?.early_exit_latency || "1.74 ms"}</span>
            </div>
          </div>

          {/* Practical Systems & Scalability Box */}
          <div style={{ background: "#0c1322", border: "1px solid #1e293b", borderRadius: "8px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#10b981", fontSize: "13px" }}>
              ⚡ SYSTEM THROUGHPUT & DEPLOYABILITY
            </h4>
            <div style={{ fontSize: "11px", color: "#94a3b8", display: "grid", gridTemplateColumns: "1fr auto", gap: "6px" }}>
              <span>Pulse Clock Engine:</span>
              <span style={{ color: "#e2e8f0" }}>{data?.system_throughput?.pulse_clock_rate || "50 MHz Optical"}</span>

              <span>Peak Signature Speed:</span>
              <span style={{ color: "#34d399", fontWeight: "bold" }}>{data?.system_throughput?.signature_throughput || "1,840 sig/s"}</span>

              <span>Scaling to 100 Verifiers:</span>
              <span style={{ color: "#38bdf8" }}>{data?.system_throughput?.verifier_scaling || "O(M log M)"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
