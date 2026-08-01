import pytest

from packages.analytics.schemas import EnsembleWeights, ShipmentRecord
from packages.forecasting.features import DataValidationError, build_features, records_to_frame
from scripts.generate_synthetic_data import generate


def test_shipment_record_rejects_negative_shipments():
    with pytest.raises(Exception):
        ShipmentRecord(store_id="S1", timestamp="2025-01-01T00:00:00", shipments=-5)


def test_ensemble_weights_sum_validation():
    EnsembleWeights()  # defaults sum to 1.0, should not raise
    with pytest.raises(ValueError):
        EnsembleWeights(lightgbm=0.9, catboost=0.3, xgboost=0.2, prophet=0.1)


def test_generator_is_deterministic_given_same_seed():
    rows_a = generate(n_stores=2, n_days=5, seed=7)
    rows_b = generate(n_stores=2, n_days=5, seed=7)
    assert rows_a == rows_b


def test_generator_differs_across_seeds():
    rows_a = generate(n_stores=2, n_days=5, seed=1)
    rows_b = generate(n_stores=2, n_days=5, seed=2)
    assert rows_a != rows_b


def test_generator_produces_expected_row_count():
    rows = generate(n_stores=3, n_days=10, seed=1)
    assert len(rows) == 3 * 10 * 24


def test_duplicate_timestamp_per_store_is_rejected():
    rows = generate(n_stores=1, n_days=1, seed=1)
    records = [ShipmentRecord(**r) for r in rows]
    records.append(records[0])  # duplicate (store_id, timestamp)
    with pytest.raises(DataValidationError):
        records_to_frame(records)


def test_feature_pipeline_produces_expected_columns_with_no_nans():
    rows = generate(n_stores=1, n_days=10, seed=1)
    records = [ShipmentRecord(**r) for r in rows]
    df = records_to_frame(records)
    features = build_features(df)

    for col in ("hour", "day", "week", "month", "lag_1", "lag_24", "lag_168",
                "rolling_mean_24", "rolling_std_24", "weather_severity",
                "is_promo", "is_event", "is_holiday", "is_weekend", "store_id"):
        assert col in features.columns
        assert not features[col].isna().any(), f"unexpected NaN in {col}"
