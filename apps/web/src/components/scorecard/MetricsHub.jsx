import React, { useEffect } from "react";
import { color, font } from "../../theme.jsx";
import { useScorecard } from "../../hooks/useScorecard.js";
import { MetricSubNav, MetricPageHeader, ControlsBar, Card, Banner, EmptyState, TargetRow } from "./shared.jsx";

const TARGETS = {
  accuracy: 95,
  staffingReduction: 20,
  onTime: 95,
  savingsPerShipment: 0.5,
};

export default function MetricsHub({ onNavigate }) {
  const sc = useScorecard(72);

  useEffect(() => {
    if (sc.storeId && !sc.data && !sc.loading) sc.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sc.storeId]);

  const d = sc.data;

  const tiles = d && [
    {
      key: "scorecard-accuracy",
      label: "Demand accuracy",
      value: `${d.accuracy.ensemble_accuracy_pct.toFixed(1)}%`,
      target: `target ${TARGETS.accuracy}%`,
      met: d.accuracy.ensemble_accuracy_pct >= TARGETS.accuracy,
      detail: "Ensemble vs. naive lag-24, in-sample",
      accent: color.coral,
    },
    {
      key: "scorecard-staffing",
      label: "Staffing efficiency",
      value: `${d.staffing_efficiency.bad_hours_reduction_pct.toFixed(1)}%`,
      target: `target ${TARGETS.staffingReduction}% fewer bad hours`,
      met: d.staffing_efficiency.bad_hours_reduction_pct >= TARGETS.staffingReduction,
      detail: "Over/understaffed hours vs. naive hire-to-peak",
      accent: color.mint,
    },
    {
      key: "scorecard-reliability",
      label: "Service reliability",
      value: `${(d.reliability.optimized.on_time_rate * 100).toFixed(1)}%`,
      target: `target ${TARGETS.onTime}%+ on-time, 0 closures`,
      met: d.reliability.optimized.on_time_rate >= 0.95 && d.reliability.optimized.store_closures === 0,
      detail: `${d.reliability.optimized.store_closures} closure hour(s)`,
      accent: "#C98A00",
    },
    {
      key: "scorecard-cost",
      label: "Cost efficiency",
      value: `AED ${d.cost.savings_per_shipment.toFixed(2)}`,
      target: `target AED ${TARGETS.savingsPerShipment.toFixed(2)}/shipment`,
      met: d.cost.savings_per_shipment >= TARGETS.savingsPerShipment,
      detail: "Saved per shipment vs. naive hire-to-peak",
      accent: color.coralDeep,
    },
  ];

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 60px" }}>
      <MetricSubNav active="scorecard-hub" onNavigate={onNavigate} />
      <MetricPageHeader
        eyebrow="Hackathon brief scorecard"
        title="How this plan measures up"
        description="Four numbers the brief asks for, each computed live from the same forecast → driver-requirements → optimize → simulate pipeline the rest of the app uses. Tap any tile for the full breakdown."
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
      {!d && !sc.loading && !sc.error && (
        <EmptyState>Pick a store and hit "Run scorecard" to compute all four brief metrics for it.</EmptyState>
      )}

      {d && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
            {tiles.map((t) => (
              <button
                key={t.key}
                onClick={() => onNavigate(t.key)}
                style={{
                  textAlign: "left",
                  background: color.surface,
                  border: `1px solid ${color.line}`,
                  borderRadius: 14,
                  padding: "16px 16px 14px",
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: t.accent }} />
                <div style={{ fontFamily: font.mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: color.muted, marginBottom: 8 }}>
                  {t.label}
                </div>
                <div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 26, color: color.ink, lineHeight: 1.1 }}>{t.value}</div>
                <div style={{ fontFamily: font.body, fontSize: 11, color: color.muted, marginTop: 6 }}>{t.target}</div>
                <div style={{ fontFamily: font.body, fontSize: 11, color: color.muted, marginTop: 2 }}>{t.detail}</div>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 10,
                    fontFamily: font.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    color: t.met ? "#0B8F68" : color.coralDeep,
                    background: t.met ? color.mintTint : color.coralTint,
                    borderRadius: 999,
                    padding: "2px 9px",
                  }}
                >
                  {t.met ? "TARGET MET" : "BELOW TARGET"}
                </span>
                <div style={{ fontFamily: font.body, fontSize: 11, color: color.coral, marginTop: 10, fontWeight: 700 }}>
                  View full breakdown →
                </div>
              </button>
            ))}
          </div>

          <Card title="All four, at a glance">
            <TargetRow
              label="95% demand-match accuracy"
              met={d.accuracy.ensemble_accuracy_pct >= TARGETS.accuracy}
              detail={`Currently ${d.accuracy.ensemble_accuracy_pct.toFixed(1)}% (ensemble, in-sample)`}
            />
            <TargetRow
              label="20% fewer over/understaffed hours"
              met={d.staffing_efficiency.bad_hours_reduction_pct >= TARGETS.staffingReduction}
              detail={`Currently ${d.staffing_efficiency.bad_hours_reduction_pct.toFixed(1)}% fewer than naive hire-to-peak`}
            />
            <TargetRow
              label="0 store closures, 95%+ on-time"
              met={d.reliability.optimized.on_time_rate >= 0.95 && d.reliability.optimized.store_closures === 0}
              detail={`${d.reliability.optimized.store_closures} closures, ${(d.reliability.optimized.on_time_rate * 100).toFixed(1)}% on-time`}
            />
            <TargetRow
              label="Cut cost by AED 0.50 / shipment"
              met={d.cost.savings_per_shipment >= TARGETS.savingsPerShipment}
              detail={`Currently saving AED ${d.cost.savings_per_shipment.toFixed(2)} / shipment vs. naive hire-to-peak`}
            />
          </Card>
        </>
      )}
    </div>
  );
}
