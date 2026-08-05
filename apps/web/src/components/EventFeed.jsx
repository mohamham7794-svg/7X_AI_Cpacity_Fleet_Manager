import React, { useEffect, useState } from "react";
import { color, font, Pill } from "../theme.jsx";
import { subscribeToEvents } from "../events.js";

const TYPE_TONE = {
  page_view: "neutral",
  store_viewed: "neutral",
  item_added: "coral",
  item_removed: "neutral",
  checkout_started: "amber",
  order_placed: "mint",
  order_status_changed: "mint",
};

export default function EventFeed({ open, onClose }) {
  const [events, setEvents] = useState([]);

  useEffect(() => subscribeToEvents(setEvents), []);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,23,31,0.35)" }} />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(420px, 100%)",
          background: "#101319",
          borderLeft: `1px solid #262C35`,
          display: "flex",
          flexDirection: "column",
          animation: "wasel-slide-in 0.22s ease both",
        }}
      >
        <div style={{ padding: "18px 20px", borderBottom: "1px solid #262C35" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 16, color: "#fff" }}>Live event stream</span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#7C8794" }}>✕</button>
          </div>
          <div style={{ fontFamily: font.body, fontSize: 12, color: "#7C8794", lineHeight: 1.5 }}>
            Every tap on this page becomes a structured event, in the shape a
            backend rollup would turn into hourly demand per store.
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {events.length === 0 && (
            <div style={{ fontFamily: font.mono, fontSize: 12, color: "#586170", textAlign: "center", marginTop: 30 }}>
              waiting for interactions…
            </div>
          )}
          {events.map((e) => (
            <div key={e.event_id} style={{ background: "#171C24", border: "1px solid #262C35", borderRadius: 10, padding: "9px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <Pill tone={TYPE_TONE[e.type] || "neutral"} style={{ background: undefined }}>{e.type}</Pill>
                <span style={{ fontFamily: font.mono, fontSize: 10, color: "#586170" }}>
                  {e.timestamp.slice(11, 19)}
                </span>
              </div>
              <div style={{ fontFamily: font.mono, fontSize: 10.5, color: "#8A95A5", lineHeight: 1.5, wordBreak: "break-word" }}>
                {Object.entries(e)
                  .filter(([k]) => !["event_id", "type", "timestamp", "session_id"].includes(k))
                  .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
                  .join("  ·  ") || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
