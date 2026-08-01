import warnings
from datetime import datetime, timedelta

import pytest

from packages.analytics.metrics import mae, mape, r2, rmse, weighted_mape
from packages.analytics.schemas import EnsembleWeights, ShipmentRecord
from packages.forecasting.api import evaluate_model, forecast, train
from packages.forecasting.evaluation import naive_lag24_baseline
from packages.forecasting.features import build_features, records_to_frame
from scripts.generate_synthetic_data import generate

warnings.filterwarnings("ignore")


def _synthetic_records(n_stores=2, n_days=20, seed=1):
    rows = generate(n_stores=n_stores, n_days=n_days, seed=seed)
    return [ShipmentRecord(**r) for r in rows]


# ---------------------------------------------------------------------------
# Metric correctness (pure math, no training required)
# ---------------------------------------------------------------------------


def test_metrics_are_zero_for_perfect_predictions():
    y = [10.0, 20.0, 30.0, 0.0]
    assert rmse(y, y) == pytest.approx(0.0)
    assert mae(y, y) == pytest.approx(0.0)
    assert mape(y, y) == pytest.approx(0.0)
    assert weighted_mape(y, y) == pytest.approx(0.0)
    assert r2(y, y) == pytest.approx(1.0)


def test_mape_known_value():
    y_true = [100.0, 200.0]
    y_pred = [110.0, 180.0]
    # |10/100| = 0.10, |20/200| = 0.10 -> mean = 0.10
    assert mape(y_true, y_pred) == pytest.approx(0.10)


def test_weighted_mape_known_value():
    y_true = [100.0, 200.0]
    y_pred = [110.0, 180.0]
    # sum(|err|)=30, sum(|actual|)=300 -> 0.10
    assert weighted_mape(y_true, y_pred) == pytest.approx(0.10)


def test_mape_skips_near_zero_true_values_without_blowing_up():
    y_true = [0.0, 100.0]
    y_pred = [5.0, 90.0]
    # the 0.0 row is skipped; only the second row (|10/100|=0.10) counts
    assert mape(y_true, y_pred) == pytest.approx(0.10)


def test_ensemble_weights_must_sum_to_one():
    EnsembleWeights(lightgbm=0.4, catboost=0.3, xgboost=0.2, prophet=0.1)  # ok
    with pytest.raises(ValueError):
        EnsembleWeights(lightgbm=0.5, catboost=0.3, xgboost=0.2, prophet=0.1)


# ---------------------------------------------------------------------------
# Ensemble weighting math against a hand-built EnsembleModel-shaped breakdown
# ---------------------------------------------------------------------------


def test_ensemble_weighted_average_matches_spec_weights():
    from packages.forecasting.models import EnsembleModel

    model = EnsembleModel()
    model._available = {"lightgbm": True, "catboost": True, "xgboost": True, "prophet": True}
    model._lgbm = _ConstPredictor(100.0)
    model._catboost = _ConstPredictor(200.0)
    model._xgboost = _ConstPredictor(300.0)

    import pandas as pd

    df = pd.DataFrame(
        {
            "store_id": ["S1"],
            "timestamp": [datetime(2025, 1, 1)],
            "hour": [0], "day": [1], "week": [1], "month": [1],
            "lag_1": [0.0], "lag_24": [0.0], "lag_168": [0.0],
            "rolling_mean_24": [0.0], "rolling_std_24": [0.0], "weather_severity": [1.0],
            "is_holiday": [False], "is_weekend": [False], "is_promo": [False], "is_event": [False],
        }
    )
    preds, breakdowns = model.predict(df)
    # no prophet in this synthetic setup -> weights renormalize over the 3 present models
    total_w = 0.40 + 0.30 + 0.20
    expected = (100 * 0.40 + 200 * 0.30 + 300 * 0.20) / total_w
    assert preds[0] == pytest.approx(expected)


class _ConstPredictor:
    def __init__(self, value):
        self.value = value

    def predict(self, X):
        return [self.value] * len(X)


# ---------------------------------------------------------------------------
# End-to-end regression test: ensemble beats naive lag-24 baseline on MAPE
# ---------------------------------------------------------------------------


def test_ensemble_beats_naive_lag24_baseline_on_synthetic_data():
    records = _synthetic_records(n_stores=2, n_days=20, seed=1)
    model, features_df = train(records)
    metrics = evaluate_model(model, features_df)
    by_name = {m.model_name: m for m in metrics}
    assert by_name["ensemble"].mape < by_name["naive_lag24"].mape


def test_forecast_produces_requested_horizon_and_positive_values():
    records = _synthetic_records(n_stores=1, n_days=15, seed=3)
    model, features_df = train(records)
    results = forecast(model, features_df, store_id="STORE_001", horizon_hours=12)
    assert len(results) == 12
    assert all(r.predicted_shipments >= 0 for r in results)
    # timestamps must be strictly increasing and contiguous hourly steps
    for a, b in zip(results, results[1:]):
        assert (b.timestamp - a.timestamp) == timedelta(hours=1)


def test_forecast_unknown_store_raises():
    records = _synthetic_records(n_stores=1, n_days=10, seed=2)
    model, features_df = train(records)
    with pytest.raises(ValueError):
        forecast(model, features_df, store_id="NOT_A_REAL_STORE", horizon_hours=5)
