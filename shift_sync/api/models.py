"""
データベースモデル (SQLAlchemy ORM)
"""
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Date, Boolean, DateTime, Float, Text
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Shift(Base):
    """シフトテーブル"""
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, index=True)
    start_time = Column(String(5), nullable=False)   # "09:00"
    end_time = Column(String(5), nullable=False)     # "17:00"
    store_name = Column(String(100), nullable=False, default="ドン・キホーテ")
    note = Column(Text, default="")
    source = Column(String(20), nullable=False, default="auto")  # "auto" | "manual"
    synced_to_gcal = Column(Boolean, default=False)
    gcal_event_id = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "store_name": self.store_name,
            "note": self.note,
            "source": self.source,
            "synced_to_gcal": self.synced_to_gcal,
            "gcal_event_id": self.gcal_event_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class FcmToken(Base):
    """FCMトークンテーブル（プッシュ通知用）"""
    __tablename__ = "fcm_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String(500), nullable=False, unique=True)
    device_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserSettings(Base):
    """ユーザー設定テーブル"""
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), nullable=False, unique=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
