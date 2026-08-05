import React, { useEffect, useState } from "react";
import { color, font, Pill, Button } from "../theme.jsx";

export const STAGES = [
  { key: "placed", label: "Order placed", icon: "🧾" },
  { key: "confirmed", label: "Confirmed by store", icon: "✅" },
  { key: "preparing", label: "Preparing your order", icon: "👨‍🍳" },
  { key: "assigned", label: "Courier assigned", icon: "🛵" },
  { key: "picked_up", label: "Picked up", icon: "📦" },
  { key: "on_the_way", label: "On the way", icon: "🚗" },
  { key: "delivered", label: "Delivered", icon: "🏠" },
];

const STAGE_MS = 2600;
const COURIERS = ["Rashid", "Fatima", "Omar", "Sara", "Yousef"];

export default function OrderTracking({ order, onStageChange, onNewOrder }) {
  const [stageIndex, setStageIndex] = useState(0);
  const courier = order.courier;

  useEffect(() => {
    if (stageIndex >= STAGES.length - 1) return;
    const t = setTimeout(() => {
      const next = stageIndex + 1;
      setStageIndex(next);
      onStageChange(STAGES[next].key);
    }, STAGE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageIndex]);

  const delivered = stageIndex === STAGES.length - 1;
  const progressPct = (stageIndex / (STAGES.length - 1)) * 100;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 24px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontFamily: font.mono, fontSize: 12, color: color.muted }}>order {order.id}</span>
        <Pill tone={delivered ? "mint" : "amber"}>{delivered ? "Delivered" : "In progress"}</Pill>
      </div>
      <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, color: color.ink, margin: "4px 0 22px" }}>
        {delivered ? "It's wasel. 🎉" : STAGES[stageIndex].label}
      </h2>

      {/* Animated route, progress reflects stage */}
      <div style={{ background: color.surface, border: `1px solid ${color.line}`, borderRadius: 18, padding: "24px 20px", marginBottom: 22 }}>
        <svg viewBox="0 0 320 60" width="100%" height="56">
          <path d="M12 30 L308 30" stroke={color.line} strokeWidth="3" strokeDasharray="1 8" strokeLinecap="round" />
          <path d="M12 30 L308 30" stroke={color.mint} strokeWidth="3" strokeLinecap="round"
            strokeDasharray="296" strokeDashoffset={296 - (296 * progressPct) / 100}
            style={{ transition: "stroke-dashoffset 0.6s ease" }} />
          <circle cx="12" cy="30" r="6" fill={color.coralTint} stroke={color.coral} strokeWidth="2" />
          <circle cx="308" cy="30" r="6" fill={color.mintTint} stroke={color.mint} strokeWidth="2" />
          <text x={12 + (296 * progressPct) / 100} y="16" textAnchor="middle" fontSize="16">🛵</text>
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontFamily: font.mono, fontSize: 11, color: color.muted }}>{order.store.name}</span>
          <span style={{ fontFamily: font.mono, fontSize: 11, color: color.muted }}>{order.area}</span>
        </div>
      </div>

      {stageIndex >= 3 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: color.mintTint, borderRadius: 12, padding: "10px 14px", marginBottom: 18 }}>
          <span style={{ fontSize: 20 }}>🛵</span>
          <div>
            <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 13, color: color.ink }}>{courier} is your courier</div>
            <div style={{ fontFamily: font.mono, fontSize: 11, color: "#0B8F68" }}>★ 4.9 · plate D 24681</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {STAGES.map((s, i) => (
          <div key={s.key} style={{ display: "flex", gap: 12, opacity: i <= stageIndex ? 1 : 0.35 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: i <= stageIndex ? color.mint : color.line,
                  color: i <= stageIndex ? "#fff" : color.muted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {i < stageIndex ? "✓" : s.icon}
              </div>
              {i < STAGES.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 22, background: i < stageIndex ? color.mint : color.line }} />}
            </div>
            <div style={{ paddingBottom: 20, paddingTop: 3 }}>
              <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 13.5, color: color.ink }}>{s.label}</div>
              {i === stageIndex && !delivered && (
                <div style={{ fontFamily: font.mono, fontSize: 11, color: color.muted, marginTop: 2 }}>updating…</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {delivered && (
        <Button full onClick={onNewOrder} style={{ marginTop: 8 }}>
          Order again
        </Button>
      )}
    </div>
  );
}

export function assignCourier() {
  return COURIERS[Math.floor(Math.random() * COURIERS.length)];
}
