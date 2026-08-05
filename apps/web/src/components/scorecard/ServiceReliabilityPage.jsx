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
  TargetRow,
} from "./shared.jsx";

const TARGET_ON_TIME_PCT = 95;

export default function ServiceReliabilityPage({ onNavigate }) {
  const sc = useScorecard(72);

  useEffect(() => {
    if (sc.storeId && !sc.data && !sc.loading) sc.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sc.storeId]);

  const rel = sc.data?.reliability;
  const optimized = rel?.optimized;
  const naive = rel?.naive;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 60px" }}>
      <MetricSubNav active="scorecard-reliability" onNavigate={onNavigate} />
      <MetricPageHeader
        eyebrow="Metric 3 of 4 · Hour-by-hour simulator"
        title="Service reliability"
        description="On-time rate and store closures from the real hour-by-hour simulator (packages/simulation/engine.py), run against the optimized plan and against a naive hire-to-peak baseline."
        targetLabel="0 store closures · 95%+ on-time"
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
      {!optimized && !sc.loading && !sc.error && (
        <EmptyState>Pick a store and hit "Run scorecard" — this calls <code>/v1/stores/&#123;id&#125;/scorecard</code>.</EmptyState>
      )}

      {optimized && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <Card title="On-time rate" subtitle="optimized plan">
              <TargetGauge
                label="On-time"
                value={optimized.on_time_rate * 100}
                target={TARGET_ON_TIME_PCT}
                max={100}
                sub={`${optimized.late_deliveries_total.toFixed(0)} late deliveries`}
              />
            </Card>

            <Card title="Store closures" subtitle="hours with 0 available drivers during demand">
              <TargetGauge
                label="Closures"
                value={optimized.store_closures}
                target={0}
                max={Math.max(optimized.store_closures, naive.store_closures, 4)}
                unit=""
                higherIsBetter={false}
                sub="lower is better — 0 is the target"
              />
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Card title="Optimized vs. naive hire-to-peak">
                <ComparisonBar
                  label="On-time rate"
                  optimizedLabel="Optimized"
                  optimizedValue={optimized.on_time_rate * 100}
                  naiveLabel="Naive hire-to-peak"
                  naiveValue={naive.on_time_rate * 100}
                  format={(v) => `${v.toFixed(1)}%`}
                />
                <ComparisonBar
                  label="Store closures"
                  optimizedLabel="Optimized"
                  optimizedValue={optimized.store_closures}
                  naiveLabel="Naive hire-to-peak"
                  naiveValue={naive.store_closures}
                  format={(v) => `${v}`}
                  lowerIsBetter
                />
              </Card>
            </div>
          </div>

          <Card title="Brief checklist">
            <TargetRow
              label="0 store closures"
              met={optimized.store_closures === 0}
              detail={`Optimized plan: ${optimized.store_closures} closure hour(s) over the horizon`}
            />
            <TargetRow
              label="95%+ on-time delivery rate"
              met={optimized.on_time_rate >= 0.95}
              detail={`Optimized plan: ${(optimized.on_time_rate * 100).toFixed(1)}% on-time`}
            />
          </Card>

          <Card title="Simulation summary" subtitle="Full hour-by-hour output is available via POST /v1/simulate">
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font.mono, fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", color: color.muted }}>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>On-time rate</th>
                  <th style={thStyle}>Closures</th>
                  <th style={thStyle}>Late deliveries</th>
                  <th style={thStyle}>Avg. utilization</th>
                  <th style={thStyle}>Bottleneck hours</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Optimized", r: optimized },
                  { label: "Naive hire-to-peak", r: naive },
                ].map(({ label, r }) => (
                  <tr key={label} style={{ borderTop: `1px solid ${color.line}` }}>
                    <td style={{ ...tdStyle, fontFamily: font.body, fontWeight: 700, color: color.ink }}>{label}</td>
                    <td style={tdStyle}>{(r.on_time_rate * 100).toFixed(1)}%</td>
                    <td style={tdStyle}>{r.store_closures}</td>
                    <td style={tdStyle}>{r.late_deliveries_total.toFixed(0)}</td>
                    <td style={tdStyle}>{(r.utilization * 100).toFixed(0)}%</td>
                    <td style={tdStyle}>{r.bottleneck_hours.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

const thStyle = { padding: "6px 10px", fontWeight: 600 };
const tdStyle = { padding: "6px 10px" };
