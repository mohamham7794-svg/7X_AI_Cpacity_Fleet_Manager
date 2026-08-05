"""Transactional data layer (§2: 'PostgreSQL — use SQLite locally if
Postgres isn't available, but keep the SQLAlchemy layer swappable').

DATABASE_URL env var controls which backend is used — defaults to a local
SQLite file so the API runs with zero external services, but swapping to
Postgres is just changing the env var (e.g.
postgresql+psycopg2://user:pass@host/db).
"""
from __future__ import annotations

import json
import os
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, UniqueConstraint, create_engine, select
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from packages.analytics.schemas import RawEvent, ShipmentRecord

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./data/app.db")
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


class ShipmentRecordORM(Base):
    __tablename__ = "shipment_records"
    id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    shipments = Column(Float, nullable=False)
    weather = Column(String, nullable=True)
    weather_severity = Column(Float, default=1.0)
    is_promo = Column(Boolean, default=False)
    is_event = Column(Boolean, default=False)
    is_holiday = Column(Boolean, default=False)
    is_weekend = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("store_id", "timestamp", name="uq_store_ts"),)


class RawEventORM(Base):
    """Raw events posted by the Wasel frontend (apps/web/src/events.js).
    Kept verbatim for later funnel analysis; 'order_placed' events are also
    rolled up into ShipmentRecordORM immediately so the forecaster can use
    them without waiting on a separate batch job."""

    __tablename__ = "raw_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String, unique=True, index=True, nullable=False)
    type = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    session_id = Column(String, nullable=True)
    store_id = Column(String, index=True, nullable=True)
    order_id = Column(String, nullable=True)
    payload = Column(String, nullable=True)  # JSON-encoded extra fields


def init_db() -> None:
    if DATABASE_URL.startswith("sqlite:///"):
        path = DATABASE_URL.replace("sqlite:///", "")
        if path not in (":memory:",) and os.path.dirname(path):
            os.makedirs(os.path.dirname(path), exist_ok=True)
    Base.metadata.create_all(engine)


def upsert_records(records: list[ShipmentRecord]) -> int:
    """Inserts new (store_id, timestamp) rows; silently skips ones that
    already exist rather than overwriting — an explicit re-ingest/replace
    endpoint can be added later if that's ever needed."""
    session = SessionLocal()
    inserted = 0
    try:
        for r in records:
            exists = session.execute(
                select(ShipmentRecordORM.id).where(
                    ShipmentRecordORM.store_id == r.store_id, ShipmentRecordORM.timestamp == r.timestamp
                )
            ).scalar_one_or_none()
            if exists is not None:
                continue
            session.add(
                ShipmentRecordORM(
                    store_id=r.store_id, timestamp=r.timestamp, shipments=r.shipments,
                    weather=r.weather, weather_severity=r.weather_severity, is_promo=r.is_promo,
                    is_event=r.is_event, is_holiday=r.is_holiday, is_weekend=r.is_weekend,
                )
            )
            inserted += 1
        session.commit()
        return inserted
    finally:
        session.close()


def get_records(store_id: str) -> list[ShipmentRecord]:
    session = SessionLocal()
    try:
        rows = session.execute(
            select(ShipmentRecordORM)
            .where(ShipmentRecordORM.store_id == store_id)
            .order_by(ShipmentRecordORM.timestamp)
        ).scalars().all()
        return [
            ShipmentRecord(
                store_id=row.store_id, timestamp=row.timestamp, shipments=row.shipments,
                weather=row.weather, weather_severity=row.weather_severity, is_promo=row.is_promo,
                is_event=row.is_event, is_holiday=row.is_holiday, is_weekend=row.is_weekend,
            )
            for row in rows
        ]
    finally:
        session.close()


def list_store_ids() -> list[str]:
    session = SessionLocal()
    try:
        rows = session.execute(select(ShipmentRecordORM.store_id).distinct()).all()
        return sorted(r[0] for r in rows)
    finally:
        session.close()


def insert_event(event: RawEvent) -> bool:
    """Stores a raw event. Idempotent on event_id — a retried/duplicate
    POST from the frontend (e.g. after a flaky network) is a no-op rather
    than double-counting. Returns False if the event_id was already seen."""
    session = SessionLocal()
    try:
        exists = session.execute(
            select(RawEventORM.id).where(RawEventORM.event_id == event.event_id)
        ).scalar_one_or_none()
        if exists is not None:
            return False

        extra = event.model_dump(
            exclude={"event_id", "type", "timestamp", "session_id", "store_id", "order_id"},
            exclude_none=True,
            mode="json",
        )
        session.add(
            RawEventORM(
                event_id=event.event_id,
                type=event.type,
                timestamp=event.timestamp,
                session_id=event.session_id,
                store_id=event.store_id,
                order_id=event.order_id,
                payload=json.dumps(extra) if extra else None,
            )
        )
        session.commit()
        return True
    finally:
        session.close()


def rollup_order_placed(store_id: str, timestamp: datetime) -> None:
    """Folds one 'order_placed' event into the hourly ShipmentRecord bucket
    for its store, incrementing the count if the bucket already exists.
    This is what lets live Wasel traffic feed the same forecasting path
    that packages/forecasting reads for synthetic/bulk-loaded data."""
    hour = timestamp.replace(minute=0, second=0, microsecond=0)
    session = SessionLocal()
    try:
        row = session.execute(
            select(ShipmentRecordORM).where(
                ShipmentRecordORM.store_id == store_id, ShipmentRecordORM.timestamp == hour
            )
        ).scalar_one_or_none()
        if row is None:
            session.add(
                ShipmentRecordORM(
                    store_id=store_id,
                    timestamp=hour,
                    shipments=1.0,
                    is_weekend=hour.weekday() >= 5,
                )
            )
        else:
            row.shipments += 1.0
        session.commit()
    finally:
        session.close()
