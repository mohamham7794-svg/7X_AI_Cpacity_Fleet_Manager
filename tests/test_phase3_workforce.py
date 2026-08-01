from datetime import datetime

import pytest

from packages.analytics.schemas import ForecastResult, StoreConfig
from packages.workforce.capacity import CapacityConfigError, convert, effective_capacity


def test_worked_example_from_spec():
    # Base=10, Productivity=0.82, Traffic=0.90, Route=0.75 -> Capacity=5.5
    # Forecast=145 -> ceil(145/5.5) = 27 drivers
    cfg = StoreConfig(
        store_id="S1", base_capacity=10, store_productivity=0.82,
        traffic_factor=0.90, weather_factor=1.0, route_length_factor=0.75,
    )
    cap = effective_capacity(cfg)
    # 10 * 0.82 * 0.90 * 1.0 * 0.75 = 5.535 (spec prose rounds this to "5.5")
    assert cap == pytest.approx(5.535)
    assert round(cap, 1) == pytest.approx(5.5)

    forecast = ForecastResult(store_id="S1", timestamp=datetime(2025, 1, 1), predicted_shipments=145)
    req = convert(forecast, cfg)
    assert req.drivers_needed == 27
    assert req.capacity_used == pytest.approx(5.535)


def test_zero_forecast_needs_zero_drivers():
    cfg = StoreConfig(store_id="S1")
    forecast = ForecastResult(store_id="S1", timestamp=datetime(2025, 1, 1), predicted_shipments=0)
    req = convert(forecast, cfg)
    assert req.drivers_needed == 0


def test_negative_or_invalid_capacity_raises_clearly():
    cfg = StoreConfig(store_id="S1", base_capacity=10, store_productivity=0, traffic_factor=0.9,
                       weather_factor=1.0, route_length_factor=0.75)
    forecast = ForecastResult(store_id="S1", timestamp=datetime(2025, 1, 1), predicted_shipments=50)
    with pytest.raises(CapacityConfigError):
        convert(forecast, cfg)


def test_capacity_below_one_still_rounds_up_correctly():
    cfg = StoreConfig(store_id="S1", base_capacity=2, store_productivity=0.5, traffic_factor=0.8,
                       weather_factor=1.0, route_length_factor=0.6)
    # capacity = 2*0.5*0.8*1.0*0.6 = 0.48
    forecast = ForecastResult(store_id="S1", timestamp=datetime(2025, 1, 1), predicted_shipments=1)
    req = convert(forecast, cfg)
    assert req.capacity_used == pytest.approx(0.48)
    assert req.drivers_needed == 3  # ceil(1 / 0.48) = ceil(2.08) = 3


def test_weather_override_beats_store_config_default():
    cfg = StoreConfig(store_id="S1", weather_factor=1.0)
    forecast = ForecastResult(store_id="S1", timestamp=datetime(2025, 1, 1), predicted_shipments=100)
    req_clear = convert(forecast, cfg, weather_factor=1.0)
    req_storm = convert(forecast, cfg, weather_factor=0.65)
    assert req_storm.drivers_needed >= req_clear.drivers_needed


def test_mismatched_store_id_raises():
    cfg = StoreConfig(store_id="S1")
    forecast = ForecastResult(store_id="S2", timestamp=datetime(2025, 1, 1), predicted_shipments=10)
    with pytest.raises(ValueError):
        convert(forecast, cfg)
