#!/usr/bin/env python3
"""Synthetic multi-store hourly shipment history generator (§6 Phase 1).

SYNTHETIC DATA ONLY — no real company names, store IDs, or figures. Produces
deterministic (via --seed) hourly shipment counts with:
  - daily seasonality (peak mid-day/evening)
  - weekly seasonality (weekends busier)
  - monthly/holiday effects
  - weather knock-on effects
  - promo/event demand bumps
  - per-store productivity variance

Usage:
    python scripts/generate_synthetic_data.py --stores 5 --days 120 --seed 42 \
        --out data/raw/synthetic_shipments.csv
"""
from __future__ import annotations

import argparse
import csv
import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

# A small fixed set of illustrative, clearly-fictional weather states.
WEATHER_STATES = ["clear", "rain", "sandstorm", "extreme_heat"]
WEATHER_SEVERITY = {"clear": 1.0, "rain": 0.85, "sandstorm": 0.65, "extreme_heat": 0.9}

# UAE-style fixed public holidays for synthetic seasonality (illustrative
# dates only — not tied to any real lunar-calendar computation).
FIXED_HOLIDAYS_MMDD = {(1, 1), (12, 2), (12, 3)}


@dataclass
class StoreProfile:
    store_id: str
    base_demand: float
    productivity: float
    route_length_factor: float
    weekend_multiplier: float


def _make_store_profiles(n_stores: int, rng: random.Random) -> list[StoreProfile]:
    profiles = []
    for i in range(n_stores):
        profiles.append(
            StoreProfile(
                store_id=f"STORE_{i+1:03d}",
                base_demand=rng.uniform(60, 160),
                productivity=rng.uniform(0.65, 1.10),
                route_length_factor=rng.uniform(0.55, 0.95),
                weekend_multiplier=rng.uniform(1.15, 1.45),
            )
        )
    return profiles


def _hour_of_day_multiplier(hour: int) -> float:
    # Two humps: late morning and early evening, low overnight.
    morning = math.exp(-((hour - 11) ** 2) / (2 * 3.0 ** 2))
    evening = math.exp(-((hour - 19) ** 2) / (2 * 2.5 ** 2))
    return 0.15 + 0.85 * max(morning, evening)


def _month_seasonality(month: int) -> float:
    # Mild seasonal wave (e.g. higher in Nov-Jan style shopping season for
    # a synthetic dataset), purely illustrative.
    return 1.0 + 0.15 * math.sin((month - 10) / 12 * 2 * math.pi)


def generate(
    n_stores: int, n_days: int, seed: int, start_date: datetime | None = None
) -> list[dict]:
    rng = random.Random(seed)
    start_date = start_date or datetime(2025, 1, 1)
    profiles = _make_store_profiles(n_stores, rng)

    rows: list[dict] = []
    for profile in profiles:
        for day_offset in range(n_days):
            day = start_date + timedelta(days=day_offset)
            is_weekend = day.weekday() >= 4  # Fri/Sat weekend, UAE-style
            is_holiday = (day.month, day.day) in FIXED_HOLIDAYS_MMDD
            weather = rng.choices(WEATHER_STATES, weights=[0.65, 0.15, 0.10, 0.10])[0]
            is_promo = rng.random() < 0.05
            is_event = rng.random() < 0.02

            for hour in range(24):
                ts = day.replace(hour=hour, minute=0, second=0, microsecond=0)
                base = profile.base_demand * profile.productivity
                demand = base * _hour_of_day_multiplier(hour) * _month_seasonality(day.month)
                if is_weekend:
                    demand *= profile.weekend_multiplier
                if is_holiday:
                    demand *= 1.6
                if is_promo:
                    demand *= 1.35
                if is_event:
                    demand *= 1.5
                demand *= WEATHER_SEVERITY[weather]
                noise = rng.gauss(1.0, 0.08)
                shipments = max(0.0, demand * noise)

                rows.append(
                    {
                        "store_id": profile.store_id,
                        "timestamp": ts.isoformat(),
                        "shipments": round(shipments, 2),
                        "weather": weather,
                        "is_promo": is_promo,
                        "is_event": is_event,
                        "is_holiday": is_holiday,
                        "is_weekend": is_weekend,
                    }
                )
    return rows


def write_csv(rows: list[dict], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stores", type=int, default=5, help="number of synthetic stores")
    parser.add_argument("--days", type=int, default=120, help="number of days of hourly history")
    parser.add_argument("--seed", type=int, default=42, help="deterministic RNG seed")
    parser.add_argument(
        "--out", type=str, default="data/raw/synthetic_shipments.csv", help="output CSV path"
    )
    args = parser.parse_args()

    rows = generate(n_stores=args.stores, n_days=args.days, seed=args.seed)
    out_path = Path(args.out)
    write_csv(rows, out_path)
    print(f"Wrote {len(rows)} synthetic hourly rows for {args.stores} stores to {out_path}")


if __name__ == "__main__":
    main()
