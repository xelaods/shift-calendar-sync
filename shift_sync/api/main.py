"""
FastAPI エントリポイント
"""
import os
import sys
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 親ディレクトリ (shift_sync/) を Python パスに追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from .database import create_tables
from .scheduler import start_scheduler, stop_scheduler
from .routers import shifts, stats, notifications, settings as settings_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """起動・終了時の処理"""
    logger.info("ShiftSync API 起動中...")
    create_tables()
    start_scheduler()
    logger.info("ShiftSync API 起動完了")
    yield
    stop_scheduler()
    logger.info("ShiftSync API 停止")


app = FastAPI(
    title="ShiftSync API",
    description="シフコン → Google カレンダー同期 + iPhone アプリ向けAPI",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 設定 (開発中は全オリジン許可)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターを登録
app.include_router(shifts.router)
app.include_router(stats.router)
app.include_router(notifications.router)
app.include_router(settings_router.router)


@app.get("/", tags=["health"])
def root():
    return {
        "status": "ok",
        "service": "ShiftSync API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
def health():
    """ヘルスチェックエンドポイント（Unity Cloud Build / デプロイ監視用）"""
    return {"status": "healthy"}
