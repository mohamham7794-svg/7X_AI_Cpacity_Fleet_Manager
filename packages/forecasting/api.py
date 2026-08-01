"""Public API for the forecasting package (§6 Phase 2):

    forecast(store_id, horizon_hours) -> list[ForecastResult]

Also exposes train() so callers (rolling replanner, API layer, notebooks)
can fit an EnsembleModel once and reuse it across many forecast() calls,
and log_training_run() for MLflow experiment tracking (params/metrics/
artifacts), per the spec's stack requirements.
"""
from __future__ import annotations

from datetime import timedelta

import pandas as pd

from packages.analytics.schemas import ForecastResult, ShipmentRecord
from packages.forecasting.evaluation import evaluate_all, naive_lag24_baseline
from packages.forecasting.features import build_features, records_to_frame
from packages.forecasting.models import EnsembleModel


def train(records: list[ShipmentRecord]) -> tuple[EnsembleModel, pd.DataFrame]:
    """Builds features from raw ShipmentRecords and fits the ensemble.
    Returns (model, features_df) — the caller typically keeps both to run
    forecast() afterwards without recomputing history features."""
    df = records_to_frame(records)
    features_df = build_features(df)
    model = EnsembleModel().fit(features_df)
    return model, features_df


def evaluate_model(model: EnsembleModel, features_df: pd.DataFrame) -> list:
    """Runs the trained ensemble against its own training features to
    produce per-model + ensemble + naive-baseline evaluation metrics."""
    y_true = features_df["shipments"].tolist()
    ensemble_pred, breakdowns = model.predict(features_df)

    preds_by_model: dict[str, list[float]] = {"ensemble": list(ensemble_pred)}
    for name in ("lightgbm", "catboost", "xgboost", "prophet"):
        vals = [getattr(b, name) for b in breakdowns]
        if any(v is not None for v in vals):
            preds_by_model[name] = [v if v is not None else 0.0 for v in vals]
    preds_by_model["naive_lag24"] = naive_lag24_baseline(features_df)

    return evaluate_all(y_true, preds_by_model)


def log_training_run(model: EnsembleModel, features_df: pd.DataFrame, run_name: str = "forecast_ensemble") -> None:
    """MLflow experiment tracking (params, metrics, artifacts). No-ops
    quietly if mlflow isn't configured/available — training must never
    fail just because tracking infra is down."""
    try:
        import mlflow
    except ImportError:
        return

    try:
        with mlflow.start_run(run_name=run_name):
            mlflow.log_params(
                {
                    "lightgbm_weight": model.weights.lightgbm,
                    "catboost_weight": model.weights.catboost,
                    "xgboost_weight": model.weights.xgboost,
                    "prophet_weight": model.weights.prophet,
                    "n_rows": len(features_df),
                    "n_stores": features_df["store_id"].nunique(),
                }
            )
            for m in evaluate_model(model, features_df):
                mlflow.log_metrics(
                    {
                        f"{m.model_name}_rmse": m.rmse,
                        f"{m.model_name}_mae": m.mae,
                        f"{m.model_name}_mape": m.mape,
                        f"{m.model_name}_weighted_mape": m.weighted_mape,
                        f"{m.model_name}_r2": m.r2,
                    }
                )
    except Exception:
        # Tracking is observability, not a hard dependency of forecasting —
        # never let an MLflow backend outage break Phase 2's public API.
        return


def forecast(
    model: EnsembleModel,
    history_features_df: pd.DataFrame,
    store_id: str,
    horizon_hours: int,
) -> list[ForecastResult]:
    """Recursive multi-step forecast: predicts one hour at a time, feeding
    each prediction back in as if it were observed so lag-1/lag-24/lag-168
    and rolling features stay valid for the next step."""
    working = history_features_df[history_features_df["store_id"] == store_id].copy()
    if working.empty:
        raise ValueError(f"no history available for store_id={store_id!r}")

    raw_cols = ["store_id", "timestamp", "shipments", "weather_severity", "is_promo", "is_event", "is_holiday", "is_weekend"]
    working = working[raw_cols].copy()

    last_ts = working["timestamp"].max()
    results: list[ForecastResult] = []

    for h in range(1, horizon_hours + 1):
        next_ts = last_ts + timedelta(hours=h)
        placeholder = {
            "store_id": store_id,
            "timestamp": next_ts,
            "shipments": float("nan"),
            "weather_severity": 1.0,
            "is_promo": False,
            "is_event": False,
            "is_holiday": False,
            "is_weekend": next_ts.weekday() >= 4,
        }
        temp_df = pd.concat([working, pd.DataFrame([placeholder])], ignore_index=True)
        feat = build_features(temp_df)
        last_row = feat.iloc[[-1]]

        pred, breakdowns = model.predict(last_row)
        predicted_shipments = float(pred[0])

        results.append(
            ForecastResult(
                store_id=store_id,
                timestamp=next_ts,
                predicted_shipments=predicted_shipments,
                model_breakdown=breakdowns[0],
            )
        )

        new_row = dict(placeholder)
        new_row["shipments"] = predicted_shipments
        working = pd.concat([working, pd.DataFrame([new_row])], ignore_index=True)

    return results
