"""SHAP feature importance on the forecasting ensemble (§6 Phase 6).

Explains *why* the forecast is what it is, in terms of the feature list
from §4 — this feeds the LLM explanation layer's "reasons" (which features
drove the number up/down), never the number itself.
"""
from __future__ import annotations

import pandas as pd

from packages.forecasting.models import EnsembleModel, _model_matrix


class ShapUnavailableError(Exception):
    pass


def explain_forecast(model: EnsembleModel, features_df: pd.DataFrame, top_n: int = 5) -> list[dict]:
    """Returns, per row in features_df, the top_n most influential features
    (name + signed SHAP value) driving that row's LightGBM prediction —
    LightGBM is the primary/highest-weighted model (40%), so it's used as
    the explainability backbone rather than explaining all four models."""
    try:
        import shap
    except ImportError as exc:
        raise ShapUnavailableError("shap is not installed") from exc

    if not model._available.get("lightgbm"):
        raise ShapUnavailableError("LightGBM model is not trained/available")

    X = _model_matrix(features_df, model._store_code_map)
    explainer = shap.TreeExplainer(model._lgbm)
    shap_values = explainer.shap_values(X)

    results = []
    for row_idx in range(len(X)):
        row_shap = shap_values[row_idx]
        pairs = sorted(zip(X.columns, row_shap), key=lambda p: abs(p[1]), reverse=True)[:top_n]
        results.append(
            {
                "feature_importance": [
                    {"feature": name, "shap_value": float(value)} for name, value in pairs
                ],
                "base_value": float(explainer.expected_value),
            }
        )
    return results
