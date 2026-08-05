import React from "react";
import { color, font, Button } from "../theme.jsx";

export default function CartDrawer({ open, onClose, lines, onInc, onDec, onCheckout }) {
  if (!open) return null;
  const total = lines.reduce((s, l) => s + l.item.price * l.qty, 0);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,23,31,0.35)" }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(400px, 100%)",
          background: color.paper,
          borderLeft: `1px solid ${color.line}`,
          display: "flex",
          flexDirection: "column",
          animation: "wasel-slide-in 0.22s ease both",
        }}
      >
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${color.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 17, color: color.ink }}>Your cart</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: color.muted }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {lines.length === 0 && (
            <div style={{ fontFamily: font.body, fontSize: 13.5, color: color.muted, marginTop: 30, textAlign: "center" }}>
              Nothing here yet — add something from a store.
            </div>
          )}
          {lines.map((l) => (
            <div key={l.item.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 22, width: 32, textAlign: "center" }}>{l.item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 13.5, color: color.ink }}>{l.item.name}</div>
                <div style={{ fontFamily: font.mono, fontSize: 12, color: color.muted }}>AED {l.item.price} × {l.qty}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => onDec(l.item)} style={qtyBtnStyle}>−</button>
                <span style={{ fontFamily: font.mono, fontSize: 13, width: 14, textAlign: "center" }}>{l.qty}</span>
                <button onClick={() => onInc(l.item)} style={qtyBtnStyle}>+</button>
              </div>
            </div>
          ))}
        </div>

        {lines.length > 0 && (
          <div style={{ padding: 20, borderTop: `1px solid ${color.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontFamily: font.body, fontSize: 14 }}>
              <span style={{ color: color.muted }}>Subtotal</span>
              <span style={{ fontFamily: font.mono, fontWeight: 600, color: color.ink }}>AED {total.toFixed(2)}</span>
            </div>
            <Button full onClick={onCheckout}>Go to checkout</Button>
          </div>
        )}
      </div>
    </div>
  );
}

const qtyBtnStyle = {
  width: 24,
  height: 24,
  borderRadius: 7,
  border: `1px solid ${color.line}`,
  background: color.surface,
  cursor: "pointer",
  fontSize: 13,
  color: color.ink,
  lineHeight: 1,
};
