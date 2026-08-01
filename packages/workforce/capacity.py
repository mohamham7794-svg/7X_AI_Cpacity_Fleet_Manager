"""Demand -> driver-requirement conversion (§4, §6 Phase 3):

    EffectiveCapacity = BaseCapacity x StoreProductivity x TrafficFactor
                         x WeatherFactor x RouteLengthFactor
    DriversNeeded = ceil(ForecastShipments / EffectiveCapacity)

Worked example (§4): Base=10, Productivity=0.82, Traffic=0.90, Route=0.75
-> Capacity=5.5 shipments/hr; Forecast=145 -> 27 drivers.
"""
from __future__ import annotations

import math

from packages.analytics.schemas import CapacityFactors, DriverRequirement, ForecastResult, StoreConfig


class CapacityConfigError(Exception):
    """Raised when a store's configured factors would produce zero or
    negative effective capacity — a silent divide-by-zero would otherwise
    make drivers_needed nonsensical (inf) instead of failing loudly."""


def effective_capacity(store_config: StoreConfig, weather_factor: float | None = None) -> float:
    weather = weather_factor if weather_factor is not None else store_config.weather_factor
    capacity = (
        store_config.base_capacity
        * store_config.store_productivity
        * store_config.traffic_factor
        * weather
        * store_config.route_length_factor
    )
    if capacity <= 0:
        raise CapacityConfigError(
            f"effective capacity for store_id={store_config.store_id!r} is {capacity} "
            "(<=0) — check base_capacity/productivity/traffic/weather/route factors"
        )
    return capacity


def convert(
    forecast: ForecastResult,
    store_config: StoreConfig,
    weather_factor: float | None = None,
) -> DriverRequirement:
    """Public API (§6 Phase 3): convert(forecast, store_config) -> DriverRequirement."""
    if forecast.store_id != store_config.store_id:
        raise ValueError(
            f"forecast.store_id={forecast.store_id!r} does not match "
            f"store_config.store_id={store_config.store_id!r}"
        )

    capacity = effective_capacity(store_config, weather_factor)
    weather = weather_factor if weather_factor is not None else store_config.weather_factor

    forecast_shipments = max(0.0, forecast.predicted_shipments)
    drivers_needed = math.ceil(forecast_shipments / capacity) if forecast_shipments > 0 else 0

    factors = CapacityFactors(
        base_capacity=store_config.base_capacity,
        store_productivity=store_config.store_productivity,
        traffic_factor=store_config.traffic_factor,
        weather_factor=weather,
        route_length_factor=store_config.route_length_factor,
        effective_capacity=capacity,
    )

    return DriverRequirement(
        store_id=forecast.store_id,
        timestamp=forecast.timestamp,
        forecast_shipments=forecast_shipments,
        drivers_needed=drivers_needed,
        capacity_used=capacity,
        factors_applied=factors,
    )
