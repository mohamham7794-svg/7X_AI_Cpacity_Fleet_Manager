import React from "react";
import { color, font } from "../theme.jsx";

/* Logo mark: two dots connected by a dashed route — literal to "Wasel"
   (وصل — arrived / connected). Reused, larger, in the Hero and tracking view. */
export function RouteMark({ size = 28, animate = true }) {
  const w = size * 1.6;
  return (
    <svg width={w} height={size} viewBox={`0 0 ${w} ${size}`} fill="none">
      <path
        d={`M4 ${size - 4} Q ${w / 2} 2, ${w - 4} ${size - 4}`}
        stroke={color.line}
        strokeWidth="2.5"
        strokeDasharray="1 6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="4" cy={size - 4} r="4" fill={color.coral} />
      <circle cx={w - 4} cy={size - 4} r="4" fill={color.mint} />
      {animate && (
        <circle r="3.2" fill={color.ink}>
          <animateMotion
            dur="2.6s"
            repeatCount="indefinite"
            path={`M4 ${size - 4} Q ${w / 2} 2, ${w - 4} ${size - 4}`}
          />
        </circle>
      )}
    </svg>
  );
}

function NavTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: font.body,
        fontWeight: 600,
        fontSize: 12.5,
        padding: "7px 14px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: active ? color.ink : "transparent",
        color: active ? "#fff" : color.inkSoft,
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

export default function Header({ cartCount, onCartClick, onLogoClick, eventCount, onFeedClick, view, onOpsClick, onHomeClick, onOffersClick, onFleetClick, onScorecardClick }) {
  const onScorecard = typeof view === "string" && view.startsWith("scorecard");
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "rgba(255,253,248,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: `1px solid ${color.line}`,
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <button
          onClick={onLogoClick}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <RouteMark size={22} />
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: color.ink }}>wasel</span>
        </button>

        <nav style={{ display: "flex", alignItems: "center", gap: 4, background: color.line, borderRadius: 999, padding: 3 }}>
          <NavTab label="Storefront" active={view === "home" || view === "store" || view === "checkout" || view === "tracking"} onClick={onHomeClick} />
          <NavTab label="Offers" active={view === "offers"} onClick={onOffersClick} />
          <NavTab label="Fleet Setup" active={view === "fleet"} onClick={onFleetClick} />
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Access point into the backend/ops console — deliberately styled
              apart from the storefront nav pills since it's a distinct
              "room" of the app, not another storefront tab. */}
          <button
            onClick={onOpsClick}
            title="Forecasting, driver requirements & hiring plan — live from the planning backend"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: view === "ops" || view === "ops-intro" ? color.ink : "transparent",
              border: `1.5px solid ${color.ink}`,
              borderRadius: 999,
              padding: "8px 14px",
              cursor: "pointer",
              fontFamily: font.body,
              fontWeight: 700,
              fontSize: 12.5,
              color: view === "ops" || view === "ops-intro" ? "#fff" : color.ink,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color.mint }} />
            Forecasting &amp; Hiring
          </button>

          <button
            onClick={onScorecardClick}
            title="Demand accuracy, staffing efficiency, service reliability & cost — vs. the brief's targets"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: onScorecard ? color.ink : "transparent",
              border: `1.5px solid ${color.ink}`,
              borderRadius: 999,
              padding: "8px 14px",
              cursor: "pointer",
              fontFamily: font.body,
              fontWeight: 700,
              fontSize: 12.5,
              color: onScorecard ? "#fff" : color.ink,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color.amber }} />
            Scorecard
          </button>

          <button
            onClick={onFeedClick}
            title="Every tap here becomes a data point — watch it live"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: color.surface,
              border: `1px solid ${color.line}`,
              borderRadius: 999,
              padding: "7px 12px",
              cursor: "pointer",
              fontFamily: font.mono,
              fontSize: 11.5,
              color: color.inkSoft,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color.mint, animation: "wasel-pulse 1.8s ease-in-out infinite" }} />
            {eventCount} events
          </button>

          <button
            onClick={onCartClick}
            style={{
              position: "relative",
              background: color.ink,
              border: "none",
              borderRadius: 999,
              width: 40,
              height: 40,
              cursor: "pointer",
              fontSize: 17,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            🛍️
            {cartCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  background: color.coral,
                  color: "#fff",
                  borderRadius: 999,
                  fontSize: 10.5,
                  fontFamily: font.body,
                  fontWeight: 700,
                  width: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
