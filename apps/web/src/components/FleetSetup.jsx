import React, { useState } from "react";
import { color, font, Pill, Button } from "../theme.jsx";
import { STORES } from "../data/stores.js";

/* "LANDING PAGE" from the sketch: "you fill it with routes and drivers
   placements + types of subscriptions premium or normal". This feeds the
   ops console — a route/placement here is exactly the kind of input the
   backend's StaffingPlan / StoreConfig expects, just captured as a form
   instead of a raw API payload. State is local-only (no backend endpoint
   for this yet); wiring a POST here later is a one-function change. */

const emptyRoute = { store_id: STORES[0].store_id, routeName: "", drivers: 3, subscription: "normal" };

export default function FleetSetup() {
  const [routes, setRoutes] = useState([
    { id: 1, store_id: "AUH-014", routeName: "Mussafah — Zone A", drivers: 6, subscription: "premium" },
    { id: 2, store_id: "DXB-002", routeName: "Al Quoz — Industrial Loop", drivers: 4, subscription: "normal" },
  ]);
  const [draft, setDraft] = useState(emptyRoute);
  const [nextId, setNextId] = useState(3);

  function addRoute(e) {
    e.preventDefault();
    if (!draft.routeName.trim()) return;
    setRoutes((prev) => [...prev, { id: nextId, ...draft }]);
    setNextId((n) => n + 1);
    setDraft(emptyRoute);
  }

  function removeRoute(id) {
    setRoutes((prev) => prev.filter((r) => r.id !== id));
  }

  const totals = routes.reduce(
    (acc, r) => {
      acc.drivers += Number(r.drivers) || 0;
      acc[r.subscription] += 1;
      return acc;
    },
    { drivers: 0, premium: 0, normal: 0 }
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 60px" }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, color: color.ink, margin: "0 0 4px" }}>
          Fleet Setup
        </h2>
        <p style={{ fontFamily: font.body, fontSize: 13, color: color.muted, margin: 0 }}>
          Routes and driver placements, plus subscription tier per route — feeds the Forecasting &amp; Hiring plan.
        </p>
      </div>

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Routes configured" value={routes.length} />
        <StatCard label="Drivers placed" value={totals.drivers} />
        <StatCard label="Premium routes" value={totals.premium} tone="amber" />
        <StatCard label="Normal routes" value={totals.normal} tone="mint" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 20, alignItems: "start" }}>
        {/* Form */}
        <form
          onSubmit={addRoute}
          style={{
            background: color.surface,
            border: `1px solid ${color.line}`,
            borderRadius: 16,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ fontFamily: font.body, fontWeight: 700, fontSize: 14, color: color.ink }}>Add a route</div>

          <Field label="Store">
            <select
              value={draft.store_id}
              onChange={(e) => setDraft((d) => ({ ...d, store_id: e.target.value }))}
              style={selectStyle}
            >
              {STORES.map((s) => (
                <option key={s.store_id} value={s.store_id}>
                  {s.name} ({s.store_id})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Route name">
            <input
              type="text"
              placeholder="e.g. Khalifa City — East loop"
              value={draft.routeName}
              onChange={(e) => setDraft((d) => ({ ...d, routeName: e.target.value }))}
              style={inputStyle}
            />
          </Field>

          <Field label="Drivers placed on this route">
            <input
              type="number"
              min={1}
              max={60}
              value={draft.drivers}
              onChange={(e) => setDraft((d) => ({ ...d, drivers: Number(e.target.value) || 0 }))}
              style={inputStyle}
            />
          </Field>

          <Field label="Subscription tier">
            <div style={{ display: "flex", gap: 8 }}>
              {["normal", "premium"].map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, subscription: tier }))}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1.5px solid ${draft.subscription === tier ? color.ink : color.line}`,
                    background: draft.subscription === tier ? color.ink : "#fff",
                    color: draft.subscription === tier ? "#fff" : color.inkSoft,
                    fontFamily: font.body,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {tier}
                </button>
              ))}
            </div>
          </Field>

          <Button type="submit" style={{ marginTop: 4 }}>
            + Add route
          </Button>
        </form>

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {routes.length === 0 && (
            <div style={{ fontFamily: font.body, fontSize: 13, color: color.muted, padding: "20px 4px" }}>
              No routes configured yet — add one on the left.
            </div>
          )}
          {routes.map((r) => {
            const store = STORES.find((s) => s.store_id === r.store_id);
            return (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: color.surface,
                  border: `1px solid ${color.line}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: store?.tint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  {store?.image ? <img src={store.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : store?.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 13.5, color: color.ink }}>{r.routeName}</div>
                  <div style={{ fontFamily: font.mono, fontSize: 11, color: color.muted }}>
                    {store?.name} ({r.store_id})
                  </div>
                </div>
                <Pill tone="mint">{r.drivers} drivers</Pill>
                <Pill tone={r.subscription === "premium" ? "amber" : "neutral"} style={{ textTransform: "capitalize" }}>
                  {r.subscription}
                </Pill>
                <button
                  onClick={() => removeRoute(r.id)}
                  title="Remove route"
                  style={{ background: "none", border: "none", cursor: "pointer", color: color.muted, fontSize: 16, padding: 4 }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: color.ink,
    amber: "#8A6100",
    mint: "#0B8F68",
  };
  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.line}`,
        borderRadius: 12,
        padding: "10px 16px",
        minWidth: 130,
      }}
    >
      <div style={{ fontFamily: font.mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: color.muted }}>
        {label}
      </div>
      <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: tones[tone] }}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: font.mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: color.muted }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  fontFamily: font.body,
  fontSize: 13.5,
  padding: "10px 12px",
  borderRadius: 9,
  border: `1px solid ${color.line}`,
  background: "#fff",
  color: color.ink,
};
const selectStyle = { ...inputStyle };
