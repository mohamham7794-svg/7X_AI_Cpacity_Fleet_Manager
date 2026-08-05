import React from "react";
import { color, font, Pill, Button } from "../theme.jsx";
import { findStore } from "../data/stores.js";

export default function StoreDetail({ storeId, cart, onAdd, onBack, onGoToCheckout }) {
  const store = findStore(storeId);
  if (!store) return null;

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "20px 24px 100px" }}>
      <button
        onClick={onBack}
        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: font.mono, fontSize: 12.5, color: color.muted, padding: 0, marginBottom: 18 }}
      >
        ← all stores
      </button>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 22 }}>
        <div style={{ background: store.tint, borderRadius: 16, width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0, overflow: "hidden" }}>
          {store.image ? (
            <img src={store.image} alt={store.cuisine} style={{ height: "100%", width: "100%", objectFit: "cover" }} />
          ) : (
            store.icon
          )}
        </div>
        <div>
          <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, color: color.ink, margin: "0 0 4px" }}>{store.name}</h2>
          <div style={{ fontFamily: font.body, fontSize: 13, color: color.muted, marginBottom: 8 }}>{store.area}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <Pill>{store.cuisine}</Pill>
            <Pill tone="amber">★ {store.rating}</Pill>
            <Pill tone="mint">{store.etaMinutes[0]}–{store.etaMinutes[1]} min</Pill>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {store.menu.map((item) => (
          <MenuRow key={item.id} item={item} qty={cart[item.id] || 0} onAdd={() => onAdd(store, item)} />
        ))}
      </div>

      {cartCount > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(720px, calc(100% - 40px))",
            animation: "wasel-fade-up 0.25s ease both",
          }}
        >
          <Button variant="dark" full onClick={onGoToCheckout} style={{ display: "flex", justifyContent: "space-between", boxShadow: "0 12px 28px rgba(20,23,31,0.28)" }}>
            <span>View cart · {cartCount} item{cartCount === 1 ? "" : "s"}</span>
            <span>→</span>
          </Button>
        </div>
      )}
    </div>
  );
}

function MenuRow({ item, qty, onAdd }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: color.surface,
        border: `1px solid ${color.line}`,
        borderRadius: 14,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 26, width: 40, textAlign: "center", flexShrink: 0 }}>{item.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 14.5, color: color.ink }}>{item.name}</div>
        <div style={{ fontFamily: font.body, fontSize: 12.5, color: color.muted }}>{item.desc}</div>
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 13.5, color: color.ink, minWidth: 54, textAlign: "right" }}>AED {item.price}</div>
      <button
        onClick={onAdd}
        style={{
          background: qty > 0 ? color.mint : color.coralTint,
          color: qty > 0 ? "#fff" : color.coralDeep,
          border: "none",
          borderRadius: 10,
          width: 34,
          height: 34,
          fontSize: 16,
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {qty > 0 ? qty : "+"}
      </button>
    </div>
  );
}
