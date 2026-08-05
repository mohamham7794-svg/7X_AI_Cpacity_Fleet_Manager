import React, { useEffect, useRef, useState } from "react";
import { color, font } from "../theme.jsx";

/* ------------------------------------------------------------------ */
/*  OpsTransition                                                      */
/*  The "welcome to your AI capacity & fleet manager" beat between     */
/*  clicking the header's Forecasting & Hiring pill and landing on the */
/*  actual dashboard (per the sketch: step 4 -> transitional page ->   */
/*  step 5). No external gif — an on-brand, dependency-free animated   */
/*  scene built from the same route-mark language as the Wasel logo/   */
/*  Hero (dots + dashed paths), so it never feels like a stock loader. */
/*  Auto-advances, but is fully skippable so it never blocks a demo.   */
/* ------------------------------------------------------------------ */

const AUTO_ADVANCE_MS = 2200;

export default function OpsTransition({ onContinue }) {
  const [progress, setProgress] = useState(0); // 0 -> 100
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    function tick(ts) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const pct = Math.min(100, (elapsed / AUTO_ADVANCE_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        onContinue();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: `radial-gradient(120% 140% at 50% 0%, #1B2030 0%, ${color.ink} 62%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        cursor: "pointer",
      }}
      onClick={onContinue}
      role="button"
      aria-label="Continue to Forecasting & Hiring dashboard"
    >
      <NetworkScene />

      <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 24px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 14px",
            borderRadius: 999,
            border: "1.5px solid rgba(255,255,255,0.18)",
            marginBottom: 22,
            fontFamily: font.mono,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.7)",
            animation: "wasel-fade-up 0.5s ease both",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color.mint, animation: "wasel-pulse 1.4s ease-in-out infinite" }} />
          Live planning backend
        </div>

        <h1
          style={{
            fontFamily: font.display,
            fontWeight: 700,
            fontSize: "clamp(28px, 4.4vw, 44px)",
            lineHeight: 1.15,
            color: "#fff",
            margin: "0 0 12px",
            animation: "wasel-fade-up 0.55s ease 0.08s both",
          }}
        >
          Welcome to your
          <br />
          <span style={{ color: color.mint }}>AI Capacity &amp; Fleet Manager</span>
        </h1>

        <p
          style={{
            fontFamily: font.body,
            fontSize: 15,
            color: "rgba(255,255,255,0.62)",
            maxWidth: 460,
            margin: "0 auto 30px",
            lineHeight: 1.6,
            animation: "wasel-fade-up 0.55s ease 0.16s both",
          }}
        >
          Forecasting demand, converting it into driver-hours, and optimizing your permanent /
          outsourced hiring mix — all from the events Wasel is generating right now.
        </p>

        <div style={{ animation: "wasel-fade-up 0.55s ease 0.24s both" }}>
          <div
            style={{
              width: 220,
              height: 3,
              borderRadius: 999,
              background: "rgba(255,255,255,0.12)",
              margin: "0 auto 14px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${color.mint}, ${color.coral})`,
                transition: "width 0.05s linear",
              }}
            />
          </div>
          <span style={{ fontFamily: font.mono, fontSize: 11.5, color: "rgba(255,255,255,0.45)" }}>
            Loading dashboard — click anywhere to skip
          </span>
        </div>
      </div>
    </div>
  );
}

/* Animated background: a handful of "store" nodes on dashed routes,
   converging toward a central "fleet" node — literal to what the page is
   about to show (per-store demand rolling into one hiring plan), drawn
   in plain SVG so there's zero asset/network dependency. */
function NetworkScene() {
  const nodes = [
    { x: 14, y: 22, delay: 0 },
    { x: 86, y: 18, delay: 0.6 },
    { x: 10, y: 78, delay: 1.2 },
    { x: 90, y: 74, delay: 0.3 },
    { x: 50, y: 90, delay: 0.9 },
  ];
  const center = { x: 50, y: 48 };

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, opacity: 0.9 }}
    >
      {/* soft concentric pulse rings from the center */}
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={center.x}
          cy={center.y}
          r="4"
          fill="none"
          stroke={color.mint}
          strokeWidth="0.3"
          opacity="0"
          style={{
            transformOrigin: `${center.x}px ${center.y}px`,
            animation: `wasel-ring 3.2s ease-out ${i * 1.05}s infinite`,
          }}
        />
      ))}

      {nodes.map((n, i) => {
        const path = `M ${n.x} ${n.y} Q ${(n.x + center.x) / 2} ${(n.y + center.y) / 2 - 8}, ${center.x} ${center.y}`;
        return (
          <g key={i}>
            <path d={path} stroke="rgba(255,255,255,0.14)" strokeWidth="0.35" strokeDasharray="0.6 1.4" fill="none" />
            <circle cx={n.x} cy={n.y} r="1.1" fill={color.coral} opacity="0.85" />
            <circle r="0.9" fill="#fff">
              <animateMotion dur="2.8s" begin={`${n.delay}s`} repeatCount="indefinite" path={path} />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="2.8s" begin={`${n.delay}s`} repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}

      <circle cx={center.x} cy={center.y} r="2.4" fill={color.mint} />

      <style>{`
        @keyframes wasel-ring {
          0% { r: 3; opacity: 0.45; }
          100% { r: 26; opacity: 0; }
        }
      `}</style>
    </svg>
  );
}
