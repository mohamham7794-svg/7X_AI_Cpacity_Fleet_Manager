"""Forecast ensemble (§4, §6 Phase 2).

Weights: LightGBM 40%, CatBoost 30%, XGBoost 20%, Prophet 10%.

LightGBM/CatBoost/XGBoost are trained as one global tabular model across all
stores (store_id becomes a numeric code feature) using the feature list from
§4. Prophet is univariate and trained per-store on its own shipment history,
per the spec's "Prophet baseline" role. If a store has no Prophet model
(e.g. brand new store, cold start), that row's ensemble weight is
renormalized across the remaining available models rather than crashing.
"""
from __future__ import annotations

import warnings
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from packages.analytics.schemas import EnsembleWeights, ModelBreakdown
from packages.forecasting.features import FEATURE_COLUMNS

_NUMERIC_FEATURES = [
    "hour", "day", "week", "month", "lag_1", "lag_24", "lag_168",
    "rolling_mean_24", "rolling_std_24", "weather_severity",
]
_BOOL_FEATURES = ["is_holiday", "is_weekend", "is_promo", "is_event"]


def _model_matrix(df: pd.DataFrame, store_code_map: dict[str, int]) -> pd.DataFrame:
    X = df[_NUMERIC_FEATURES].copy()
    for col in _BOOL_FEATURES:
        X[col] = df[col].astype(int)
    X["store_code"] = df["store_id"].map(store_code_map).fillna(-1).astype(int)
    return X


@dataclass
class EnsembleModel:
    weights: EnsembleWeights = field(default_factory=EnsembleWeights)
    _lgbm: object = None
    _catboost: object = None
    _xgboost: object = None
    _prophet_by_store: dict = field(default_factory=dict)
    _store_code_map: dict = field(default_factory=dict)
    _available: dict = field(default_factory=dict)

    def fit(self, features_df: pd.DataFrame) -> "EnsembleModel":
        stores = sorted(features_df["store_id"].unique())
        self._store_code_map = {s: i for i, s in enumerate(stores)}
        X = _model_matrix(features_df, self._store_code_map)
        y = features_df["shipments"].astype(float)

        try:
            import lightgbm as lgb

            self._lgbm = lgb.LGBMRegressor(
                n_estimators=200, learning_rate=0.05, max_depth=-1, verbosity=-1
            )
            self._lgbm.fit(X, y)
            self._available["lightgbm"] = True
        except ImportError:
            self._available["lightgbm"] = False
            warnings.warn("lightgbm not available; excluded from ensemble")

        try:
            from catboost import CatBoostRegressor

            self._catboost = CatBoostRegressor(
                iterations=200, learning_rate=0.05, depth=6, verbose=False
            )
            self._catboost.fit(X, y)
            self._available["catboost"] = True
        except ImportError:
            self._available["catboost"] = False
            warnings.warn("catboost not available; excluded from ensemble")

        try:
            from xgboost import XGBRegressor

            self._xgboost = XGBRegressor(
                n_estimators=200, learning_rate=0.05, max_depth=6, verbosity=0
            )
            self._xgboost.fit(X, y)
            self._available["xgboost"] = True
        except ImportError:
            self._available["xgboost"] = False
            warnings.warn("xgboost not available; excluded from ensemble")

        try:
            from prophet import Prophet

            for store_id, sub in features_df.groupby("store_id"):
                if len(sub) < 48:
                    continue  # not enough history for a meaningful Prophet fit
                pdf = sub[["timestamp", "shipments"]].rename(columns={"timestamp": "ds", "shipments": "y"})
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    m = Prophet(daily_seasonality=True, weekly_seasonality=True, yearly_seasonality=False)
                    m.fit(pdf)
                self._prophet_by_store[store_id] = m
            self._available["prophet"] = True
        except ImportError:
            self._available["prophet"] = False
            warnings.warn("prophet not available; excluded from ensemble")

        return self

    def _prophet_predict(self, df: pd.DataFrame) -> pd.Series:
        preds = pd.Series(index=df.index, dtype=float)
        for store_id, sub in df.groupby("store_id"):
            model = self._prophet_by_store.get(store_id)
            if model is None:
                continue
            future = sub[["timestamp"]].rename(columns={"timestamp": "ds"})
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                fc = model.predict(future)
            preds.loc[sub.index] = fc["yhat"].values
        return preds

    def predict(self, features_df: pd.DataFrame) -> tuple[np.ndarray, list[ModelBreakdown]]:
        """Returns (ensemble_predictions, per-row ModelBreakdown list)."""
        X = _model_matrix(features_df, self._store_code_map)
        n = len(features_df)

        raw = {}
        if self._available.get("lightgbm"):
            raw["lightgbm"] = np.asarray(self._lgbm.predict(X), dtype=float)
        if self._available.get("catboost"):
            raw["catboost"] = np.asarray(self._catboost.predict(X), dtype=float)
        if self._available.get("xgboost"):
            raw["xgboost"] = np.asarray(self._xgboost.predict(X), dtype=float)
        if self._available.get("prophet"):
            raw["prophet"] = self._prophet_predict(features_df).to_numpy()

        weight_map = {
            "lightgbm": self.weights.lightgbm,
            "catboost": self.weights.catboost,
            "xgboost": self.weights.xgboost,
            "prophet": self.weights.prophet,
        }

        ensemble = np.zeros(n)
        breakdowns: list[ModelBreakdown] = []
        for i in range(n):
            present = {k: v[i] for k, v in raw.items() if not (k == "prophet" and np.isnan(v[i]))}
            total_w = sum(weight_map[k] for k in present) or 1.0
            row_pred = sum(present[k] * weight_map[k] for k in present) / total_w
            ensemble[i] = max(0.0, row_pred)
            breakdowns.append(
                ModelBreakdown(
                    lightgbm=present.get("lightgbm"),
                    catboost=present.get("catboost"),
                    xgboost=present.get("xgboost"),
                    prophet=present.get("prophet"),
                )
            )
        return ensemble, breakdowns
