"""
データベース接続管理
SQLite（開発）/ PostgreSQL（本番）両対応
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from .models import Base

# DATABASE_URL 環境変数で切り替え
# 開発: sqlite:///./shiftsync.db
# 本番: postgresql://user:pass@host/dbname
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./shiftsync.db"
)

# SQLite の場合は check_same_thread=False が必要
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,  # SQLログを出力したい場合は True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables():
    """テーブルを作成（起動時に呼び出す）"""
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI の Depends で使う DB セッションジェネレータ"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
