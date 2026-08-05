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

const TARGET_ACCURACY_PCT = 95;

export default function DemandAccuracyPage({ onNavigate }) {
  const sc = useScorecard(72);

  useEffect(() => {
    if (sc.storeId && !sc.data && !sc.loading) sc.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sc.storeId]);

  const accuracy = sc.data?.accuracy;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 60px" }}>
      <MetricSubNav active="scorecard-accuracy" onNavigate={onNavigate} />
      <MetricPageHeader
        eyebrow="Metric 1 of 4 · Forecasting engine"
        title="Demand-forecast accuracy"
        description="How closely the LightGBM/CatBoost/XGBoost/Prophet ensemble matches real demand, versus a naive lag-24 (same hour, last week) baseline."
        targetLabel="95% demand-match accuracy"
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
      {!accuracy && !sc.loading && !sc.error && (
        <EmptyState>Pick a store and hit "Run scorecard" — this calls <code>/v1/stores/&#123;id&#125;/scorecard</code>.</EmptyState>
      )}

      {accuracy && (
        <>
          <Banner tone={accuracy.basis === "in_sample" ? "amber" : "mint"}>
            <strong>Basis: in-sample.</strong> This is the trained ensemble evaluated against the history it was
            trained on — it proves the ensemble fits real demand shape far better than the naive baseline. A true
            held-out backtest (predict, wait, compare to what actually happened) accrues automatically as more
            live orders flow in through <code>/v1/events</code>.
          </Banner>

          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "center" }}>
            <Card title="Ensemble accuracy" subtitle="1 − MAPE, vs. brief target">
              <TargetGauge
                label="Ensemble"
                value={accuracy.ensemble_accuracy_pct}
                target={TARGET_ACCURACY_PCT}
                max={100}
                sub={`MAPE ${(accuracy.ensemble_mape * 100).toFixed(1)}%`}
              />
            </Card>

            <Card title="Ensemble vs. naive lag-24 baseline" subtitle="Higher is better — the ensemble must clear this bar to justify the ML stack">
              <ComparisonBar
                optimizedLabel="Ensemble"
                optimizedValue={accuracy.ensemble_accuracy_pct}
                naiveLabel="Naive lag-24"
                naiveValue={accuracy.naive_lag24_accuracy_pct}
                format={(v) => `${v.toFixed(1)}%`}
              />
              <div style={{ fontFamily: font.body, fontSize: 12, color: color.muted, marginTop: 4 }}>
                {accuracy.ensemble_accuracy_pct > accuracy.naive_lag24_accuracy_pct
                  ? `Ensemble beats the naive baseline by ${(accuracy.ensemble_accuracy_pct - accuracy.naive_lag24_accuracy_pct).toFixed(1)} points.`
                  : "Ensemble did not beat the naive baseline on this run — check training data volume."}
              </div>
            </Card>
          </div>

          <Card title="Per-model breakdown" subtitle="Every model feeding the ensemble, plus the baseline it must beat">
            <ModelTable rows={accuracy.per_model} />
          </Card>
        </>
      )}
    </div>
  );
}

function ModelTable({ rows }) {
  const sorted = [...rows].sort((a, b) => a.mape - b.mape);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font.mono, fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: "left", color: color.muted }}>
            <th style={thStyle}>Model</th>
            <th style={thStyle}>Accuracy (1−MAPE)</th>
            <th style={thStyle}>MAPE</th>
            <th style={thStyle}>Weighted MAPE</th>
            <th style={thStyle}>RMSE</th>
            <th style={thStyle}>R²</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr key={m.model_name} style={{ borderTop: `1px solid ${color.line}` }}>
              <td style={{ ...tdStyle, fontWeight: 700, color: color.ink, fontFamily: font.body, textTransform: "capitalize" }}>
                {m.model_name.replace("_", " ")}
                {m.model_name === "ensemble" && (
                  <span style={{ marginLeft: 6, fontFamily: font.mono, fontSize: 9.5, color: "#0B8F68", background: color.mintTint, borderRadius: 999, padding: "1px 6px" }}>
                    used
                  </span>
                )}
                {m.model_name === "naive_lag24" && (
                  <span style={{ marginLeft: 6, fontFamily: font.mono, fontSize: 9.5, color: color.muted, background: color.line, borderRadius: 999, padding: "1px 6px" }}>
                    baseline
                  </span>
                )}
              </td>
              <td style={tdStyle}>{((1 - m.mape) * 100).toFixed(1)}%</td>
              <td style={tdStyle}>{(m.mape * 100).toFixed(1)}%</td>
              <td style={tdStyle}>{(m.weighted_mape * 100).toFixed(1)}%</td>
              <td style={tdStyle}>{m.rmse.toFixed(2)}</td>
              <td style={tdStyle}>{m.r2.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = { padding: "6px 10px", fontWeight: 600 };
const tdStyle = { padding: "6px 10px" };
