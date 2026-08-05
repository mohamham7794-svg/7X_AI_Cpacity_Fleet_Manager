import React from "react";
import { color, font, Button } from "../../theme.jsx";

// --- Sub-navigation between the scorecard hub + the four dedicated pages -
export const METRIC_PAGES = [
  { key: "scorecard-hub", short: "Overview", label: "Scorecard overview" },
  { key: "scorecard-accuracy", short: "Accuracy", label: "Demand accuracy" },
  { key: "scorecard-staffing", short: "Staffing", label: "Staffing efficiency" },
  { key: "scorecard-reliability", short: "Reliability", label: "Service reliability" },
  { key: "scorecard-cost", short: "Cost", label: "Cost efficiency" },
];

export function MetricSubNav({ active, onNavigate }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
        marginBottom: 20,
        background: color.surface,
        border: `1px solid ${color.line}`,
        borderRadius: 999,
        padding: 4,
      }}
    >
      {METRIC_PAGES.map((p) => (
        <button
          key={p.key}
          onClick={() => onNavigate(p.key)}
          style={{
            fontFamily: font.body,
            fontWeight: 700,
            fontSize: 12.5,
            padding: "8px 14px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
            background: active === p.key ? color.ink : "transparent",
            color: active === p.key ? "#fff" : color.inkSoft,
            transition: "background 0.15s ease, color 0.15s ease",
          }}
        >
          {p.short}
        </button>
      ))}
    </div>
  );
}

// --- Page chrome: title + store/horizon controls + run button ------------
export function MetricPageHeader({ eyebrow, title, description, targetLabel }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: color.muted, marginBottom: 4 }}>
        {eyebrow}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 22, color: color.ink, margin: 0 }}>{title}</h2>
        {targetLabel && (
          <span
            style={{
              fontFamily: font.mono,
              fontSize: 11,
              fontWeight: 600,
              color: "#0B8F68",
              background: color.mintTint,
              borderRadius: 999,
              padding: "3px 10px",
            }}
          >
            brief target: {targetLabel}
          </span>
        )}
      </div>
      <p style={{ fontFamily: font.body, fontSize: 13, color: color.muted, margin: "4px 0 0", maxWidth: 640 }}>{description}</p>
    </div>
  );
}

export function ControlsBar({ storeId, setStoreId, availableStores, storesLoadError, horizonHours, setHorizonHours, onRun, loading }) {
  return (
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
      {storesLoadError && (
        <div style={{ width: "100%", fontFamily: font.body, fontSize: 12, color: "#8A6100", background: color.amberTint, borderRadius: 10, padding: "8px 12px" }}>
          Couldn't reach <code>/v1/stores</code> ({storesLoadError}). Showing Wasel's known store IDs instead.
        </div>
      )}
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
          style={{ ...selectStyle, width: 100 }}
        />
      </Field>
      <Button onClick={onRun} disabled={loading || !storeId} style={{ height: 38 }}>
        {loading ? "Computing…" : "Run scorecard"}
      </Button>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontFamily: font.mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: color.muted }}>
        {label}
      </span>
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

export function Card({ title, subtitle, children, style }) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.line}`, borderRadius: 14, padding: 18, marginBottom: 16, ...style }}>
      {title && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: font.body, fontWeight: 700, fontSize: 13.5, color: color.ink }}>{title}</div>
          {subtitle && <div style={{ fontFamily: font.body, fontSize: 11.5, color: color.muted, marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Banner({ tone = "amber", children }) {
  const tones = {
    amber: { bg: color.amberTint, fg: "#8A6100" },
    coral: { bg: color.coralTint, fg: color.coralDeep },
    mint: { bg: color.mintTint, fg: "#0B8F68" },
  }[tone];
  return (
    <div style={{ background: tones.bg, color: tones.fg, fontFamily: font.body, fontSize: 12.5, borderRadius: 10, padding: "10px 14px", marginBottom: 14, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div style={{ fontFamily: font.body, fontSize: 13.5, color: color.muted, padding: "40px 4px", textAlign: "center" }}>{children}</div>
  );
}

// --- Semi-circular gauge: current value vs. brief target ------------------
export function TargetGauge({ label, value, target, unit = "%", max, higherIsBetter = true, sub }) {
  const effectiveMax = max ?? Math.max(target * 1.3, value * 1.15, 1);
  const clamped = Math.max(0, Math.min(value, effectiveMax));
  const size = 180;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const r = 72;
  const startAngle = Math.PI; // 180deg (left)
  const endAngle = 0; // 0deg (right)
  const angleFor = (v) => startAngle - (v / effectiveMax) * (startAngle - endAngle);

  const arcPoint = (angle) => [cx + r * Math.cos(angle), cy - r * Math.sin(angle)];
  const describeArc = (fromV, toV) => {
    const [x1, y1] = arcPoint(angleFor(fromV));
    const [x2, y2] = arcPoint(angleFor(toV));
    const large = Math.abs(angleFor(fromV) - angleFor(toV)) > Math.PI ? 1 : 0;
    return `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
  };

  const met = higherIsBetter ? value >= target : value <= target;
  const accent = met ? color.mint : color.coral;
  const [needleX, needleY] = arcPoint(angleFor(clamped));
  const [targetX, targetY] = arcPoint(angleFor(Math.min(target, effectiveMax)));

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size / 2 + 34} viewBox={`0 0 ${size} ${size / 2 + 34}`}>
        <path d={describeArc(0, effectiveMax)} fill="none" stroke={color.line} strokeWidth="12" strokeLinecap="round" />
        <path d={describeArc(0, clamped)} fill="none" stroke={accent} strokeWidth="12" strokeLinecap="round" />
        {/* target tick */}
        <line
          x1={cx + (r - 10) * Math.cos(angleFor(Math.min(target, effectiveMax)))}
          y1={cy - (r - 10) * Math.sin(angleFor(Math.min(target, effectiveMax)))}
          x2={cx + (r + 10) * Math.cos(angleFor(Math.min(target, effectiveMax)))}
          y2={cy - (r + 10) * Math.sin(angleFor(Math.min(target, effectiveMax)))}
          stroke={color.ink}
          strokeWidth="2.5"
        />
        <circle cx={targetX} cy={targetY} r="2.5" fill={color.ink} />
        <text x={cx} y={cy - 6} textAnchor="middle" fontFamily={font.display} fontWeight="700" fontSize="24" fill={color.ink}>
          {typeof value === "number" ? value.toFixed(1) : value}
          {unit}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontFamily={font.mono} fontSize="9.5" fill={color.muted}>
          target {target}
          {unit}
        </text>
      </svg>
      <div style={{ fontFamily: font.body, fontWeight: 700, fontSize: 12.5, color: color.ink, textAlign: "center" }}>{label}</div>
      {sub && <div style={{ fontFamily: font.body, fontSize: 11, color: color.muted, textAlign: "center", maxWidth: 180 }}>{sub}</div>}
      <span
        style={{
          fontFamily: font.mono,
          fontSize: 10.5,
          fontWeight: 700,
          color: met ? "#0B8F68" : color.coralDeep,
          background: met ? color.mintTint : color.coralTint,
          borderRadius: 999,
          padding: "2px 9px",
          marginTop: 2,
        }}
      >
        {met ? "TARGET MET" : "BELOW TARGET"}
      </span>
    </div>
  );
}

// --- Horizontal comparison bar: optimized/actual vs. naive baseline ------
export function ComparisonBar({ label, optimizedLabel, optimizedValue, naiveLabel, naiveValue, format = (v) => v, lowerIsBetter = false }) {
  const max = Math.max(optimizedValue, naiveValue, 1);
  const better = lowerIsBetter ? optimizedValue <= naiveValue : optimizedValue >= naiveValue;
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <div style={{ fontFamily: font.body, fontWeight: 700, fontSize: 12.5, color: color.ink, marginBottom: 8 }}>{label}</div>}
      <BarRow tone={better ? "mint" : "coral"} name={optimizedLabel} value={optimizedValue} max={max} format={format} />
      <BarRow tone="neutral" name={naiveLabel} value={naiveValue} max={max} format={format} />
    </div>
  );
}

function BarRow({ tone, name, value, max, format }) {
  const pct = Math.max(2, (value / max) * 100);
  const bg = tone === "mint" ? color.mint : tone === "coral" ? color.coral : color.line;
  const fg = tone === "neutral" ? color.inkSoft : "#fff";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <div style={{ width: 130, fontFamily: font.body, fontSize: 11.5, color: color.muted, flexShrink: 0 }}>{name}</div>
      <div style={{ flex: 1, background: color.line, borderRadius: 8, height: 22, position: "relative", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: bg, borderRadius: 8, transition: "width 0.4s ease" }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 10,
            height: "100%",
            display: "flex",
            alignItems: "center",
            fontFamily: font.mono,
            fontSize: 11,
            fontWeight: 700,
            color: pct > 22 ? fg : color.ink,
          }}
        >
          {format(value)}
        </div>
      </div>
    </div>
  );
}

// --- Simple checklist row for pass/fail brief requirements -----------------
export function TargetRow({ label, met, detail }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${color.line}` }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: met ? color.mintTint : color.coralTint,
          color: met ? "#0B8F68" : color.coralDeep,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: font.body,
          fontWeight: 700,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {met ? "✓" : "!"}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 12.5, color: color.ink }}>{label}</div>
        {detail && <div style={{ fontFamily: font.body, fontSize: 11, color: color.muted }}>{detail}</div>}
      </div>
    </div>
  );
}
