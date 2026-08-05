import React, { useState } from "react";
import { color, font, Pill, Button } from "../theme.jsx";

const AREAS = ["Abu Dhabi · Al Reem Island", "Abu Dhabi · Corniche", "Abu Dhabi · Khalifa City", "Abu Dhabi · Mussafah"];

export default function Checkout({ store, lines, onBack, onPlaceOrder }) {
  const [area, setArea] = useState(AREAS[0]);
  const [payment, setPayment] = useState("card");
  const [placing, setPlacing] = useState(false);

  const subtotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const deliveryFee = 6;
  const total = subtotal + deliveryFee;

  const handlePlace = () => {
    setPlacing(true);
    setTimeout(() => onPlaceOrder({ area, payment, subtotal, deliveryFee, total }), 550);
  };

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "20px 24px 60px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: font.mono, fontSize: 12.5, color: color.muted, padding: 0, marginBottom: 18 }}>
        ← back to store
      </button>

      <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, color: color.ink, margin: "0 0 20px" }}>Checkout</h2>

      <Section title="Delivering to">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {AREAS.map((a) => (
            <label key={a} style={optionRow(area === a)}>
              <input type="radio" name="area" checked={area === a} onChange={() => setArea(a)} style={{ accentColor: color.coral }} />
              <span style={{ fontFamily: font.body, fontSize: 13.5, color: color.ink }}>{a}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Payment">
        <div style={{ display: "flex", gap: 10 }}>
          {[{ id: "card", label: "💳 Card •• 4821" }, { id: "cash", label: "💵 Cash on delivery" }].map((p) => (
            <button
              key={p.id}
              onClick={() => setPayment(p.id)}
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 12,
                border: `1.5px solid ${payment === p.id ? color.coral : color.line}`,
                background: payment === p.id ? color.coralTint : color.surface,
                fontFamily: font.body,
                fontSize: 13,
                fontWeight: 600,
                color: color.ink,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title={`Order from ${store.name}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {lines.map((l) => (
            <div key={l.item.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: font.body, fontSize: 13.5 }}>
              <span style={{ color: color.inkSoft }}>{l.qty}× {l.item.name}</span>
              <span style={{ fontFamily: font.mono, color: color.ink }}>AED {(l.item.price * l.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Section>

      <div style={{ background: color.surface, border: `1px solid ${color.line}`, borderRadius: 14, padding: 16, marginBottom: 22 }}>
        <Row label="Subtotal" value={subtotal} />
        <Row label="Delivery fee" value={deliveryFee} />
        <div style={{ height: 1, background: color.line, margin: "8px 0" }} />
        <Row label="Total" value={total} bold />
      </div>

      <Button full onClick={handlePlace} disabled={placing}>
        {placing ? "Placing order…" : `Place order · AED ${total.toFixed(2)}`}
      </Button>
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <Pill>Estimated arrival {store.etaMinutes[0]}–{store.etaMinutes[1]} min</Pill>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: font.body, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
      <span style={{ fontFamily: font.body, fontSize: bold ? 14.5 : 13, fontWeight: bold ? 700 : 400, color: bold ? color.ink : color.muted }}>{label}</span>
      <span style={{ fontFamily: font.mono, fontSize: bold ? 15 : 13, fontWeight: bold ? 700 : 400, color: color.ink }}>AED {value.toFixed(2)}</span>
    </div>
  );
}

function optionRow(active) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    border: `1.5px solid ${active ? color.coral : color.line}`,
    background: active ? color.coralTint : color.surface,
    cursor: "pointer",
  };
}
