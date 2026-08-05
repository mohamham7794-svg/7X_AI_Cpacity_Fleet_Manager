import React from "react";
import { color, font, Pill } from "../theme.jsx";

export default function Hero() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px 28px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "center" }}>
        <div>
          <Pill tone="mint" style={{ marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color.mint, display: "inline-block" }} />
            Live in Abu Dhabi, Dubai, Sharjah &amp; Ajman
          </Pill>
          <h1
            style={{
              fontFamily: font.display,
              fontWeight: 800,
              fontSize: "clamp(34px, 5vw, 52px)",
              lineHeight: 1.06,
              color: color.ink,
              margin: "0 0 16px",
              letterSpacing: "-0.01em",
            }}
          >
            Order it.
            <br />
            Watch it <span style={{ color: color.coral }}>wasel</span>.
          </h1>
          <p style={{ fontFamily: font.body, fontSize: 16.5, color: color.inkSoft, lineHeight: 1.6, maxWidth: 440, margin: "0 0 26px" }}>
            وصل — "it arrived." Order from the stores near you and track every
            step from kitchen to door, in real time.
          </p>
        </div>

        {/* Signature element: an animated route connecting a store to a door,
            standing in for the hero's "most characteristic thing" — motion
            toward arrival. */}
        <RouteHero />
      </div>
    </div>
  );
}

function RouteHero() {
  return (
    <div
      style={{
        position: "relative",
        background: color.surface,
        border: `1px solid ${color.line}`,
        borderRadius: 20,
        padding: "34px 28px",
        overflow: "hidden",
      }}
    >
      <svg viewBox="0 0 320 160" width="100%" height="150">
        <path
          id="wasel-hero-path"
          d="M20 130 C 90 130, 100 40, 160 40 S 250 130, 300 40"
          stroke={color.line}
          strokeWidth="3"
          strokeDasharray="1 9"
          strokeLinecap="round"
          fill="none"
        />
        <g>
          <circle cx="20" cy="130" r="7" fill={color.coralTint} stroke={color.coral} strokeWidth="2" />
          <text x="20" y="152" textAnchor="middle" fontFamily={font.mono} fontSize="9" fill={color.muted}>
            store
          </text>
        </g>
        <g>
          <circle cx="300" cy="40" r="7" fill={color.mintTint} stroke={color.mint} strokeWidth="2" />
          <text x="300" y="24" textAnchor="middle" fontFamily={font.mono} fontSize="9" fill={color.muted}>
            you
          </text>
        </g>
        <circle r="6" fill={color.coral}>
          <animateMotion dur="3.4s" repeatCount="indefinite" path="M20 130 C 90 130, 100 40, 160 40 S 250 130, 300 40" />
        </circle>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontFamily: font.mono, fontSize: 11, color: color.muted }}>picked up · 6 min ago</span>
        <span style={{ fontFamily: font.mono, fontSize: 11, color: color.mint, fontWeight: 600 }}>ETA 14 min</span>
      </div>
    </div>
  );
}
