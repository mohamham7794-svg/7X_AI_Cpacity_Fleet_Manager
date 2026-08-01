"""Data validation + feature engineering pipeline (§6 Phase 1, feature list
from §4): hour, day, week, month, holiday flag, weekend flag, lag-1,
lag-24, lag-168, rolling mean/std, weather, promotions, events, store_id.
"""
from __future__ import annotations

import pandas as pd

from packages.analytics.schemas import ShipmentRecord

FEATURE_COLUMNS = [
    "hour", "day", "week", "month", "is_holiday", "is_weekend",
    "lag_1", "lag_24", "lag_168",
    "rolling_mean_24", "rolling_std_24",
    "weather_severity", "is_promo", "is_event", "store_id",
]

WEATHER_SEVERITY_MAP = {"clear": 1.0, "rain": 0.85, "sandstorm": 0.65, "extreme_heat": 0.9}


class DataValidationError(Exception):
    pass


def validate_records(records: list[ShipmentRecord]) -> None:
    """Schema checks + duplicate-timestamp-per-store check. ShipmentRecord
    itself enforces field types/ranges (Pydantic); this layer checks the
    cross-record invariants schemas alone can't."""
    if not records:
        raise DataValidationError("no shipment records provided")
    seen: set[tuple[str, object]] = set()
    for r in records:
        key = (r.store_id, r.timestamp)
        if key in seen:
            raise DataValidationError(f"duplicate timestamp {r.timestamp} for store {r.store_id}")
        seen.add(key)


def records_to_frame(records: list[ShipmentRecord]) -> pd.DataFrame:
    validate_records(records)
    df = pd.DataFrame([r.model_dump() for r in records])
    df = df.sort_values(["store_id", "timestamp"]).reset_index(drop=True)
    return df


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Builds the feature list from §4 per store_id, handling missing
    values by forward/back-filling lag/rolling windows (a cold-start store
    with insufficient history gets NaN-safe defaults, not crashes)."""
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values(["store_id", "timestamp"])

    df["hour"] = df["timestamp"].dt.hour
    df["day"] = df["timestamp"].dt.day
    df["week"] = df["timestamp"].dt.isocalendar().week.astype(int)
    df["month"] = df["timestamp"].dt.month

    if "weather" in df.columns:
        df["weather_severity"] = df["weather"].map(WEATHER_SEVERITY_MAP).fillna(1.0)
    elif "weather_severity" not in df.columns:
        df["weather_severity"] = 1.0

    for col in ("is_promo", "is_event", "is_holiday", "is_weekend"):
        if col not in df.columns:
            df[col] = False
        df[col] = df[col].fillna(False).astype(bool)

    grouped = df.groupby("store_id", group_keys=False)["shipments"]
    df["lag_1"] = grouped.shift(1)
    df["lag_24"] = grouped.shift(24)
    df["lag_168"] = grouped.shift(168)
    df["rolling_mean_24"] = grouped.transform(lambda s: s.shift(1).rolling(24, min_periods=1).mean())
    df["rolling_std_24"] = grouped.transform(lambda s: s.shift(1).rolling(24, min_periods=1).std())

    # Cold-start rows (no history yet) get filled with that store's running
    # mean rather than left as NaN, so downstream models never see NaN.
    for col in ("lag_1", "lag_24", "lag_168", "rolling_mean_24", "rolling_std_24"):
        df[col] = df.groupby("store_id")[col].transform(lambda s: s.fillna(s.mean()))
        df[col] = df[col].fillna(0.0)

    return df.reset_index(drop=True)
