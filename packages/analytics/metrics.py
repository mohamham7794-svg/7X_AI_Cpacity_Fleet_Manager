"""RMSE / MAE / MAPE / weighted-MAPE / R² (§4, used by forecasting/evaluation.py)."""
from __future__ import annotations

import math

from packages.analytics.schemas import EvaluationMetrics

_EPS = 1e-9


def rmse(y_true: list[float], y_pred: list[float]) -> float:
    n = len(y_true)
    return math.sqrt(sum((t - p) ** 2 for t, p in zip(y_true, y_pred)) / n)


def mae(y_true: list[float], y_pred: list[float]) -> float:
    n = len(y_true)
    return sum(abs(t - p) for t, p in zip(y_true, y_pred)) / n


def mape(y_true: list[float], y_pred: list[float]) -> float:
    """Mean absolute percentage error. Rows where the true value is ~0 are
    skipped (they'd blow up the percentage) rather than crashing or forcing
    a divide-by-near-zero into the mean."""
    errs = [abs((t - p) / t) for t, p in zip(y_true, y_pred) if abs(t) > _EPS]
    if not errs:
        return 0.0
    return sum(errs) / len(errs)


def weighted_mape(y_true: list[float], y_pred: list[float]) -> float:
    """sum(|actual - pred|) / sum(|actual|) — robust to individual near-zero rows."""
    denom = sum(abs(t) for t in y_true)
    if denom < _EPS:
        return 0.0
    return sum(abs(t - p) for t, p in zip(y_true, y_pred)) / denom


def r2(y_true: list[float], y_pred: list[float]) -> float:
    n = len(y_true)
    mean_y = sum(y_true) / n
    ss_res = sum((t - p) ** 2 for t, p in zip(y_true, y_pred))
    ss_tot = sum((t - mean_y) ** 2 for t in y_true)
    if ss_tot < _EPS:
        return 1.0 if ss_res < _EPS else 0.0
    return 1.0 - ss_res / ss_tot


def evaluate(model_name: str, y_true: list[float], y_pred: list[float]) -> EvaluationMetrics:
    return EvaluationMetrics(
        model_name=model_name,
        rmse=rmse(y_true, y_pred),
        mae=mae(y_true, y_pred),
        mape=mape(y_true, y_pred),
        weighted_mape=weighted_mape(y_true, y_pred),
        r2=r2(y_true, y_pred),
    )
