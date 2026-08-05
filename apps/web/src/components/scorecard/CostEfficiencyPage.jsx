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

const TARGET_SAVINGS_PER_SHIPMENT = 0.5; // AED

export default function CostEfficiencyPage({ onNavigate }) {
  const sc = useScorecard(72);

  useEffect(() => {
    if (sc.storeId && !sc.data && !sc.loading) sc.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sc.storeId]);

  const costData = sc.data?.cost;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 60px" }}>
      <MetricSubNav active="scorecard-cost" onNavigate={onNavigate} />
      <MetricPageHeader
        eyebrow="Metric 4 of 4 · MILP hiring optimizer"
        title="Cost efficiency"
        description="Cost per shipment for the optimizer's mixed permanent/temp/outsourced plan, versus naive_hire_to_peak_baseline() — the same lead-time-risk-aware baseline the optimizer's own objective is priced against."
        targetLabel="cut cost by AED 0.50 / shipment"
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
      {!costData && !sc.loading && !sc.error && (
        <EmptyState>Pick a store and hit "Run scorecard" — this calls <code>/v1/stores/&#123;id&#125;/scorecard</code>.</EmptyState>
      )}

      {costData && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "center" }}>
            <Card title="Savings per shipment" subtitle="vs. brief target">
              <TargetGauge
                label="AED saved / shipment"
                value={costData.savings_per_shipment}
                target={TARGET_SAVINGS_PER_SHIPMENT}
                unit=""
                max={Math.max(costData.savings_per_shipment * 1.4, TARGET_SAVINGS_PER_SHIPMENT * 1.4)}
                sub={`${costData.optimized_cost_per_shipment.toFixed(2)} vs ${costData.naive_cost_per_shipment.toFixed(2)} AED`}
              />
            </Card>

            <Card title="Cost per shipment — optimized vs. naive hire-to-peak">
              <ComparisonBar
                optimizedLabel="Optimized plan"
                optimizedValue={costData.optimized_cost_per_shipment}
                naiveLabel="Naive hire-to-peak"
                naiveValue={costData.naive_cost_per_shipment}
                format={(v) => `AED ${v.toFixed(2)}`}
                lowerIsBetter
              />
              <div style={{ fontFamily: font.body, fontSize: 12, color: color.muted, marginTop: 4 }}>
                Across {Math.round(costData.total_shipments).toLocaleString()} forecasted shipments over the horizon.
              </div>
            </Card>
          </div>

          <Card title="Total plan cost">
            <ComparisonBar
              optimizedLabel="Optimized plan"
              optimizedValue={costData.optimized_total_cost}
              naiveLabel="Naive hire-to-peak"
              naiveValue={costData.naive_total_cost}
              format={(v) => `AED ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              lowerIsBetter
            />
          </Card>

          <Card title="How this is priced" subtitle="No new numbers — this is the same objective the optimizer already minimizes">
            <ul style={{ fontFamily: font.body, fontSize: 12.5, color: color.inkSoft, margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Optimized cost = <code>packages/optimization/hiring.py optimize()</code>'s objective value (labor + understaffing penalty + lead-time risk premium).</li>
              <li>Naive baseline = <code>naive_hire_to_peak_baseline()</code> — every store permanently staffed to its peak hourly requirement, carrying the full 45-60 day permanent lead-time risk premium on every unit, same as the optimizer prices it.</li>
              <li>Cost per shipment divides each by the same forecasted shipment volume over the horizon, so the comparison isn't affected by demand size — only by staffing strategy.</li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
