import React, { useEffect } from "react";
import { color, font } from "../../theme.jsx";
import { useScorecard } from "../../hooks/useScorecard.js";
import {
  MetricSubNav,
  MetricPageHeader,
  ControlsBar,
  Card,
  Banner,
  EmptyState,
  TargetGauge,
  ComparisonBar,
} from "./shared.jsx";

const TARGET_REDUCTION_PCT = 20;

export default function StaffingEfficiencyPage({ onNavigate }) {
  const sc = useScorecard(72);

  useEffect(() => {
    if (sc.storeId && !sc.data && !sc.loading) sc.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sc.storeId]);

  const eff = sc.data?.staffing_efficiency;
  const optimizedBad = eff ? eff.optimized_understaffed_hours + eff.optimized_overstaffed_hours : 0;
  const naiveBad = eff ? eff.naive_understaffed_hours + eff.naive_overstaffed_hours : 0;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 60px" }}>
      <MetricSubNav active="scorecard-staffing" onNavigate={onNavigate} />
      <MetricPageHeader
        eyebrow="Metric 2 of 4 · Optimizer"
        title="Staffing efficiency"
        description="Hours where the plan is either under-capacity (can't cover demand) or meaningfully over-capacity (>15% slack), optimizer's mixed plan vs. a naive hire-to-peak baseline over the same horizon."
        targetLabel="20% fewer over/understaffed hours"
      />

      <ControlsBar
        storeId={sc.storeId}
        setStoreId={sc.setStoreId}
        availableStores={sc.availableStores}
        storesLoadError={sc.storesLoadError}
        horizonHours={sc.horizonHours}
        setHorizonHours={sc.setHorizonHours}
        onRun={sc.run}
        loading={sc.loading}
      />

      {sc.error && <Banner tone="coral">{sc.error}</Banner>}
      {!eff && !sc.loading && !sc.error && (
        <EmptyState>Pick a store and hit "Run scorecard" — this calls <code>/v1/stores/&#123;id&#125;/scorecard</code>.</EmptyState>
      )}

      {eff && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "center" }}>
            <Card title="Fewer bad hours" subtitle="vs. brief target">
              <TargetGauge
                label="Reduction"
                value={eff.bad_hours_reduction_pct}
                target={TARGET_REDUCTION_PCT}
                max={100}
                sub={`${optimizedBad} bad hrs vs ${naiveBad} baseline`}
              />
            </Card>

            <Card title="Over/understaffed hours — optimized vs. naive hire-to-peak" subtitle="Lower is better">
              <ComparisonBar
                optimizedLabel="Optimized plan"
                optimizedValue={optimizedBad}
                naiveLabel="Naive hire-to-peak"
                naiveValue={naiveBad}
                format={(v) => `${v} hrs`}
                lowerIsBetter
              />
              <div style={{ fontFamily: font.body, fontSize: 12, color: color.muted, marginTop: 4 }}>
                Evaluated across {eff.hours_evaluated} forecast hours.
              </div>
            </Card>
          </div>

          <Card title="Breakdown" subtitle="Understaffed = capacity below forecast demand · Overstaffed = capacity >15% above demand">
            <BreakdownTable eff={eff} />
          </Card>
        </>
      )}
    </div>
  );
}

function BreakdownTable({ eff }) {
  const rows = [
    { label: "Optimized plan", under: eff.optimized_understaffed_hours, over: eff.optimized_overstaffed_hours, tone: "mint" },
    { label: "Naive hire-to-peak", under: eff.naive_understaffed_hours, over: eff.naive_overstaffed_hours, tone: "neutral" },
  ];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font.mono, fontSize: 12 }}>
      <thead>
        <tr style={{ textAlign: "left", color: color.muted }}>
          <th style={thStyle}>Plan</th>
          <th style={thStyle}>Understaffed hours</th>
          <th style={thStyle}>Overstaffed hours</th>
          <th style={thStyle}>Total bad hours</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} style={{ borderTop: `1px solid ${color.line}` }}>
            <td style={{ ...tdStyle, fontFamily: font.body, fontWeight: 700, color: color.ink }}>{r.label}</td>
            <td style={tdStyle}>
              <Badge tone={r.under > 0 ? "coral" : "mint"}>{r.under}</Badge>
            </td>
            <td style={tdStyle}>
              <Badge tone={r.over > 0 ? "amber" : "mint"}>{r.over}</Badge>
            </td>
            <td style={{ ...tdStyle, fontWeight: 700 }}>{r.under + r.over}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Badge({ tone, children }) {
  const tones = {
    mint: { bg: color.mintTint, fg: "#0B8F68" },
    coral: { bg: color.coralTint, fg: color.coralDeep },
    amber: { bg: color.amberTint, fg: "#8A6100" },
  }[tone];
  return (
    <span style={{ background: tones.bg, color: tones.fg, borderRadius: 999, padding: "2px 9px", fontWeight: 700 }}>{children}</span>
  );
}

const thStyle = { padding: "6px 10px", fontWeight: 600 };
const tdStyle = { padding: "6px 10px" };
