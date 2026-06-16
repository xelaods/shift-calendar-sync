"""
Pydantic スキーマ（リクエスト・レスポンスの型定義）
"""
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ─── シフト ───

class ShiftBase(BaseModel):
    date: date
    start_time: str = Field(..., pattern=r"^\d{1,2}:\d{2}$", example="09:00")
    end_time: str = Field(..., pattern=r"^\d{1,2}:\d{2}$", example="17:00")
    store_name: str = Field(default="ドン・キホーテ")
    note: Optional[str] = ""


class ShiftCreate(ShiftBase):
    """手動追加時のリクエスト"""
    pass


class ShiftUpdate(BaseModel):
    """シフト編集リクエスト（全フィールドオプション）"""
    date: Optional[date] = None
    start_time: Optional[str] = Field(None, pattern=r"^\d{1,2}:\d{2}$")
    end_time: Optional[str] = Field(None, pattern=r"^\d{1,2}:\d{2}$")
    store_name: Optional[str] = None
    note: Optional[str] = None


class ShiftResponse(ShiftBase):
    """シフトレスポンス"""
    id: int
    source: str  # "auto" | "manual"
    synced_to_gcal: bool
    gcal_event_id: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── 同期 ───

class SyncRequest(BaseModel):
    """シフト同期リクエスト"""
    year: Optional[int] = None
    month: Optional[int] = None
    sync_to_gcal: bool = True
    force_first_run: bool = False  # Trueの場合は初回モードを強制実行


class SyncResponse(BaseModel):
    """同期結果レスポンス"""
    scraped: int
    added_to_db: int
    gcal_added: int
    gcal_skipped: int
    gcal_errors: int
    message: str


# ─── 認証 ───

class AuthVerifyRequest(BaseModel):
    """シフコン認証情報の検証リクエスト"""
    staff_id: str
    password: str


class AuthVerifyResponse(BaseModel):
    success: bool
    message: str


# ─── 統計 ───

class MonthlyStats(BaseModel):
    """月別統計レスポンス"""
    year: int
    month: int
    total_shifts: int
    total_hours: float
    estimated_income: float  # 時給 × 勤務時間
    hourly_wage: float       # 使用した時給設定
    shift_dates: List[date]
    daily_hours: dict        # { "2026-06-01": 8.0, ... }


# ─── FCM通知 ───

class FcmTokenRegister(BaseModel):
    """FCMトークン登録リクエスト"""
    token: str
    device_name: Optional[str] = None


class FcmTokenResponse(BaseModel):
    success: bool
    message: str


class NotificationScheduleRequest(BaseModel):
    """通知スケジュールリクエスト"""
    notify_time: str = Field(default="08:00", pattern=r"^\d{2}:\d{2}$",
                              description="通知を送る時刻 (HH:MM)")
    days_before: int = Field(default=1, ge=0, le=7,
                              description="何日前に通知するか (0=当日, 1=前日)")


# ─── 設定 ───

class SettingsUpdate(BaseModel):
    """設定更新リクエスト"""
    hourly_wage: Optional[float] = Field(None, ge=0, description="時給（円）")
    notify_enabled: Optional[bool] = None
    notify_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    notify_days_before: Optional[int] = Field(None, ge=0, le=7)


class SettingsResponse(BaseModel):
    hourly_wage: float = 1050.0
    notify_enabled: bool = True
    notify_time: str = "08:00"
    notify_days_before: int = 1
