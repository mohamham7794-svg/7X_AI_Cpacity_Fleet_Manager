import React, { useEffect, useState } from "react";
import { color, font, Pill, Button } from "../theme.jsx";
import { STORES } from "../data/stores.js";
import { getStores, runForecast, runDriverRequirements, runOptimize } from "../api.js";

const DEFAULT_CONFIG = {
  base_capacity: 10,
  store_productivity: 0.82,
  traffic_factor: 0.9,
  weather_factor: 1.0,
  route_length_factor: 0.75,
};

export default function OpsDashboard() {
  const [availableStores, setAvailableStores] = useState([]);
  const [storesLoadError, setStoresLoadError] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [horizonHours, setHorizonHours] = useState(24);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const [forecasts, setForecasts] = useState(null);
  const [driverRequirements, setDriverRequirements] = useState(null);
  const [hiringPlan, setHiringPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runError, setRunError] = useState(null);

  // Load the list of stores that actually have data in the backend DB.
  // Falls back to Wasel's local store IDs (still lets you try running a
  // plan, it'll just error clearly if that store has no seeded history).
  useEffect(() => {
    getStores()
      .then((ids) => setAvailableStores(ids.length ? ids : STORES.map((s) => s.store_id)))
      .catch((err) => {
        setStoresLoadError(err.message);
        setAvailableStores(STORES.map((s) => s.store_id));
      });
  }, []);

  useEffect(() => {
    if (!storeId && availableStores.length) setStoreId(availableStores[0]);
  }, [availableStores, storeId]);

  async function runPlan() {
    if (!storeId) return;
    setLoading(true);
    setRunError(null);
    setForecasts(null);
    setDriverRequirements(null);
    setHiringPlan(null);
    try {
      const fc = await runForecast(storeId, horizonHours);
      setForecasts(fc);
      const dr = await runDriverRequirements(fc, { store_id: storeId, ...config });
      setDriverRequirements(dr);
      const plan = await runOptimize(dr);
      setHiringPlan(plan);
    } catch (err) {
      setRunError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 60px" }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, color: color.ink, margin: "0 0 4px" }}>
          Forecasting &amp; Hiring
        </h2>
        <p style={{ fontFamily: font.body, fontSize: 13, color: color.muted, margin: 0 }}>
          Live from the planning backend — same event stream you see in the "events" feed feeds this.
        </p>
      </div>

      {storesLoadError && (
        <Banner tone="amber">
          Couldn't reach <code>/v1/stores</code> ({storesLoadError}). Showing Wasel's known store IDs instead —
          make sure the backend is running and reachable.
        </Banner>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
          background: color.surface,
          border: `1px solid ${color.line}`,
          borderRadius: 14,
          padding: 16,
          marginBottom: 18,
        }}
      >
        <Field label="Store">
          <select value={storeId || ""} onChange={(e) => setStoreId(e.target.value)} style={selectStyle}>
            {availableStores.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Horizon (hours)">
          <input
            type="number"
            min={1}
            max={168}
            value={horizonHours}
            onChange={(e) => setHorizonHours(Number(e.target.value) || 24)}
            style={inputStyle}
          />
        </Field>

        {Object.entries({
          base_capacity: "Base capacity",
          store_productivity: "Productivity",
          traffic_factor: "Traffic factor",
          weather_factor: "Weather factor",
          route_length_factor: "Route length factor",
        }).map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              type="number"
              step="0.01"
              value={config[key]}
              onChange={(e) => setConfig((c) => ({ ...c, [key]: Number(e.target.value) }))}
              style={{ ...inputStyle, width: 90 }}
            />
          </Field>
        ))}

        <Button onClick={runPlan} disabled={loading || !storeId} style={{ height: 38 }}>
          {loading ? "Running…" : "Run plan"}
        </Button>
      </div>

      {runError && <Banner tone="coral">{runError}</Banner>}

      {!forecasts && !loading && !runError && (
        <div style={{ fontFamily: font.body, fontSize: 13.5, color: color.muted, padding: "24px 4px" }}>
          Pick a store and hit "Run plan" — this calls <code>/v1/forecast</code> →{" "}
          <code>/v1/driver-requirements</code> → <code>/v1/optimize</code> in sequence against real seeded data.
        </div>
      )}

      {forecasts && (
        <>
          <KpiRow forecasts={forecasts} driverRequirements={driverRequirements} hiringPlan={hiringPlan} loading={loading} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: hiringPlan ? "1.6fr 1fr" : "1fr",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            <Card title="Shipment forecast">
              <ForecastChart forecasts={forecasts} />
            </Card>

            {hiringPlan && (
              <Card title="Recommended hiring plan">
                <HiringPlanView plan={hiringPlan} />
              </Card>
            )}
          </div>

          {driverRequirements && (
            <Card title="Driver requirements, hour by hour">
              <DriverTable rows={driverRequirements} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// --- KPI summary strip ----------------------------------------------------
// Every number here is derived from data already returned by the same
// /v1/forecast -> /v1/driver-requirements -> /v1/optimize calls the cards
// below render in full — this is a rollup, not a separate data source.

function KpiRow({ forecasts, driverRequirements, hiringPlan, loading }) {
  const totalShipments = forecasts.reduce((s, f) => s + f.predicted_shipments, 0);

  const peakDrivers = driverRequirements ? Math.max(...driverRequirements.map((d) => d.drivers_needed)) : null;
  const avgDrivers = driverRequirements
    ? driverRequirements.reduce((s, d) => s + d.drivers_needed, 0) / driverRequirements.length
    : null;
  const avgUtilization = driverRequirements
    ? (driverRequirements.reduce((s, d) => s + d.capacity_used, 0) / driverRequirements.length) * 100
    : null;

  const totalHires = hiringPlan ? hiringPlan.permanent_hires + hiringPlan.temp_hires + hiringPlan.outsourced_units : null;
  // Matches the optimizer's own 60/40 mix constraint exactly
  // (packages/optimization/hiring.py): permanent as a share of
  // permanent+outsourced. Temp is deliberately excluded from this ratio —
  // it's a separate short-term lever, not part of the permanent-vs-
  // outsourced policy split — so it must also be excluded here, or this
  // card reads a different number than the one the backend is actually
  // constraining and testing (tests/test_phase5_optimization.py).
  const permBase = hiringPlan ? hiringPlan.permanent_hires + hiringPlan.outsourced_units : 0;
  const permanentPct = hiringPlan && permBase > 0 ? (hiringPlan.permanent_hires / permBase) * 100 : null;
  const costPerShipment = hiringPlan && totalShipments > 0 ? hiringPlan.total_cost / totalShipments : null;

  const cards = [
    {
      label: "Peak drivers / hr",
      value: peakDrivers === null ? "—" : peakDrivers,
      sub: avgDrivers === null ? "forecast loaded" : `avg ${avgDrivers.toFixed(1)}/hr over horizon`,
      tone: "mint",
    },
    {
      label: "Forecast volume",
      value: Math.round(totalShipments).toLocaleString(),
      sub: `shipments over ${forecasts.length}h horizon`,
      tone: "coral",
    },
    {
      label: "Recommended hires",
      value: totalHires === null ? "—" : totalHires,
      sub: hiringPlan
        ? `${hiringPlan.permanent_hires} permanent · ${hiringPlan.temp_hires} temp · ${hiringPlan.outsourced_units} outsourced`
        : "run optimizer to see mix",
      tone: "amber",
    },
    {
      label: "Permanent mix (vs. outsourced)",
      value: permanentPct === null ? "—" : `${permanentPct.toFixed(0)}%`,
      sub: permanentPct === null ? "target 60% permanent" : deltaVsTarget(permanentPct, 60),
      tone: "mint",
    },
    {
      label: "Plan cost",
      value: hiringPlan ? hiringPlan.total_cost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—",
      sub: costPerShipment !== null ? `≈ AED ${costPerShipment.toFixed(2)} / shipment` : "AED, per horizon",
      tone: "coral",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))",
        gap: 12,
        marginBottom: 18,
        opacity: loading ? 0.55 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} />
      ))}
    </div>
  );
}

function deltaVsTarget(value, target) {
  const diff = value - target;
  if (Math.abs(diff) < 1) return "on target (60%)";
  return diff > 0 ? `${diff.toFixed(0)}pt above 60% target` : `${Math.abs(diff).toFixed(0)}pt below 60% target`;
}

function KpiCard({ label, value, sub, tone }) {
  const accents = {
    mint: color.mint,
    coral: color.coral,
    amber: "#C98A00",
  };
  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.line}`,
        borderRadius: 14,
        padding: "16px 16px 14px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accents[tone] }} />
      <div
        style={{
          fontFamily: font.mono,
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: color.muted,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26, color: color.ink, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontFamily: font.body, fontSize: 11.5, color: color.muted, marginTop: 6, lineHeight: 1.4 }}>{sub}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontFamily: font.mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: color.muted }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Banner({ tone, children }) {
  const tones = {
    amber: { bg: color.amberTint, fg: "#8A6100" },
    coral: { bg: color.coralTint, fg: color.coralDeep },
  }[tone];
  return (
    <div
      style={{
        background: tones.bg,
        color: tones.fg,
        fontFamily: font.body,
        fontSize: 12.5,
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 14,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.line}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ fontFamily: font.body, fontWeight: 700, fontSize: 13.5, color: color.ink, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

const selectStyle = {
  fontFamily: font.body,
  fontSize: 13.5,
  padding: "8px 10px",
  borderRadius: 9,
  border: `1px solid ${color.line}`,
  background: "#fff",
  color: color.ink,
  height: 38,
};
const inputStyle = { ...selectStyle, width: 100 };

// --- Forecast area chart (plain SVG, no chart library dependency) --------
// "Make it more readable" (per the sketch): gridlines + y-axis ticks +
// area fill + a hover-free peak marker, instead of a bare line-and-dots.

function ForecastChart({ forecasts }) {
  const width = 960;
  const height = 240;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const values = forecasts.map((f) => f.predicted_shipments);
  const max = Math.max(...values, 1);
  const min = 0; // shipments are non-negative — anchor the axis at 0 for honest area-fill proportions
  const range = max - min || 1;

  const xAt = (i) => padLeft + (i / Math.max(1, forecasts.length - 1)) * plotW;
  const yAt = (v) => padTop + plotH - ((v - min) / range) * plotH;

  const points = forecasts.map((f, i) => [xAt(i), yAt(f.predicted_shipments)]);
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${xAt(forecasts.length - 1).toFixed(1)},${(padTop + plotH).toFixed(1)} L${xAt(0).toFixed(1)},${(padTop + plotH).toFixed(1)} Z`;

  const peakIdx = values.indexOf(max);
  const gridTicks = 4; // 4 horizontal gridlines + baseline
  const yTickValues = Array.from({ length: gridTicks + 1 }, (_, i) => (max / gridTicks) * i);

  // Show ~6 evenly-spaced x-axis time labels regardless of horizon length.
  const xLabelCount = Math.min(6, forecasts.length);
  const xLabelStep = Math.max(1, Math.floor((forecasts.length - 1) / Math.max(1, xLabelCount - 1)));
  const xLabelIdxs = Array.from({ length: xLabelCount }, (_, i) => Math.min(forecasts.length - 1, i * xLabelStep));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <defs>
          <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color.coral} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color.coral} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines + y-axis labels */}
        {yTickValues.map((v, i) => {
          const y = yAt(v);
          return (
            <g key={i}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke={color.line} strokeWidth="1" />
              <text x={padLeft - 8} y={y + 3} textAnchor="end" fontFamily={font.mono} fontSize="9.5" fill={color.muted}>
                {v.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Area + line */}
        <path d={areaPath} fill="url(#forecastFill)" stroke="none" />
        <path d={linePath} fill="none" stroke={color.coral} strokeWidth="2.25" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === peakIdx ? 3.5 : 2} fill={i === peakIdx ? color.coralDeep : color.coral} />
        ))}

        {/* Peak marker */}
        <line x1={xAt(peakIdx)} y1={padTop} x2={xAt(peakIdx)} y2={yAt(values[peakIdx])} stroke={color.coralDeep} strokeWidth="1" strokeDasharray="2 3" />
        <text x={xAt(peakIdx)} y={padTop - 4} textAnchor="middle" fontFamily={font.mono} fontSize="9.5" fill={color.coralDeep} fontWeight="700">
          peak {max.toFixed(0)}/hr
        </text>

        {/* X-axis time labels */}
        {xLabelIdxs.map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={height - 8}
            textAnchor={i === 0 ? "start" : i === forecasts.length - 1 ? "end" : "middle"}
            fontFamily={font.mono}
            fontSize="9.5"
            fill={color.muted}
          >
            {new Date(forecasts[i].timestamp).toLocaleString([], { weekday: "short", hour: "2-digit" })}
          </text>
        ))}
      </svg>
    </div>
  );
}

function DriverTable({ rows }) {
  const shown = rows.slice(0, 24);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font.mono, fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: "left", color: color.muted }}>
            <th style={thStyle}>Hour</th>
            <th style={thStyle}>Forecast (shipments)</th>
            <th style={thStyle}>Drivers needed</th>
            <th style={thStyle}>Capacity / driver</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.timestamp} style={{ borderTop: `1px solid ${color.line}` }}>
              <td style={tdStyle}>{new Date(r.timestamp).toLocaleString([], { weekday: "short", hour: "2-digit" })}</td>
              <td style={tdStyle}>{r.forecast_shipments.toFixed(1)}</td>
              <td style={tdStyle}>
                <Pill tone={r.drivers_needed > 0 ? "mint" : "neutral"}>{r.drivers_needed}</Pill>
              </td>
              <td style={tdStyle}>{r.capacity_used.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <div style={{ fontFamily: font.mono, fontSize: 11, color: color.muted, marginTop: 8 }}>
          + {rows.length - shown.length} more hours not shown
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: "6px 10px", fontWeight: 600 };
const tdStyle = { padding: "6px 10px" };

function HiringPlanView({ plan }) {
  const total = plan.permanent_hires + plan.temp_hires + plan.outsourced_units || 1;
  const segments = [
    { label: "Permanent", value: plan.permanent_hires, color: color.mint },
    { label: "Temp", value: plan.temp_hires, color: color.amber },
    { label: "Outsourced", value: plan.outsourced_units, color: color.coral },
  ];
  let acc = 0;
  const gradientStops = segments
    .map((s) => {
      const start = (acc / total) * 100;
      acc += s.value;
      const end = (acc / total) * 100;
      return `${s.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: total > 1 || plan.permanent_hires + plan.temp_hires + plan.outsourced_units > 0
            ? `conic-gradient(${gradientStops})`
            : color.line,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: 62, height: 62, borderRadius: "50%", background: color.surface, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.mono, fontSize: 11, color: color.muted, textAlign: "center" }}>
          {plan.solver_status}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: font.body, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
            <span style={{ color: color.inkSoft }}>{s.label}</span>
            <span style={{ fontFamily: font.mono, fontWeight: 600, color: color.ink }}>{s.value}</span>
          </div>
        ))}
      </div>

      <div style={{ marginLeft: "auto" }}>
        <div style={{ fontFamily: font.mono, fontSize: 11, color: color.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Total cost
        </div>
        <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, color: color.ink }}>
          {plan.total_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
          <span style={{ fontFamily: font.mono, fontSize: 12, color: color.muted }}>AED</span>
        </div>
      </div>
    </div>
  );
}
