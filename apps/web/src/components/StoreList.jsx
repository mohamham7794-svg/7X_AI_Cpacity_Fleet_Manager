import React from "react";
import { color, font, Pill } from "../theme.jsx";
import { STORES } from "../data/stores.js";

export default function StoreList({ onSelectStore }) {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "10px 24px 60px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: color.ink, margin: 0 }}>
          Stores near you
        </h2>
        <span style={{ fontFamily: font.mono, fontSize: 12, color: color.muted }}>{STORES.length} available</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {STORES.map((s, i) => (
          <StoreCard key={s.store_id} store={s} delay={i * 0.05} onClick={() => onSelectStore(s.store_id)} />
        ))}
      </div>
    </div>
  );
}

function StoreCard({ store, delay, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: color.surface,
        border: `1px solid ${color.line}`,
        borderRadius: 16,
        padding: 0,
        cursor: "pointer",
        overflow: "hidden",
        animation: `wasel-fade-up 0.4s ease both`,
        animationDelay: `${delay}s`,
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 10px 24px rgba(20,23,31,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ background: store.tint, height: 88, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, overflow: "hidden" }}>
        {store.image ? (
          <img src={store.image} alt={store.cuisine} style={{ height: "100%", width: "100%", objectFit: "cover" }} />
        ) : (
          store.icon
        )}
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontFamily: font.body, fontWeight: 700, fontSize: 15, color: color.ink, marginBottom: 3 }}>{store.name}</div>
        <div style={{ fontFamily: font.body, fontSize: 12.5, color: color.muted, marginBottom: 10 }}>{store.area}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Pill>{store.cuisine}</Pill>
          <Pill tone="amber">★ {store.rating}</Pill>
          <Pill tone="mint">{store.etaMinutes[0]}–{store.etaMinutes[1]} min</Pill>
        </div>
      </div>
    </button>
  );
}
