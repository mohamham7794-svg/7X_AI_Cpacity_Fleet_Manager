"""Evaluation module (§6 Phase 2): RMSE/MAE/MAPE/weighted-MAPE/R² per model
and for the ensemble, plus a naive lag-24 baseline for the regression test
acceptance criterion in §6 ('forecast beats a naive lag-24 baseline on
MAPE')."""
from __future__ import annotations

import pandas as pd

from packages.analytics.metrics import evaluate
from packages.analytics.schemas import EvaluationMetrics


def naive_lag24_baseline(features_df: pd.DataFrame) -> list[float]:
    """The naive baseline: predict this hour's shipments as last week-same-
    hour... actually lag-24 = same hour yesterday. Used as the bar the
    ensemble must beat."""
    return features_df["lag_24"].tolist()


def evaluate_all(
    y_true: list[float],
    predictions_by_model: dict[str, list[float]],
) -> list[EvaluationMetrics]:
    """predictions_by_model maps model name -> predictions list (e.g.
    {'lightgbm': [...], 'catboost': [...], 'ensemble': [...], 'naive_lag24': [...]})."""
    return [evaluate(name, y_true, preds) for name, preds in predictions_by_model.items()]
