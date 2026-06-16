"""
設定エンドポイント
時給・通知設定などを管理する
"""
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import UserSettings
from ..schemas import SettingsUpdate, SettingsResponse

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULTS = {
    "hourly_wage": "1050.0",
    "notify_enabled": "true",
    "notify_time": "08:00",
    "notify_days_before": "1",
}


def _get_setting(db: Session, key: str) -> str | None:
    s = db.query(UserSettings).filter(UserSettings.key == key).first()
    return s.value if s else DEFAULTS.get(key)


def _set_setting(db: Session, key: str, value: str):
    s = db.query(UserSettings).filter(UserSettings.key == key).first()
    if s:
        s.value = value
    else:
        s = UserSettings(key=key, value=value)
        db.add(s)
    db.commit()


@router.get("", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    """現在の設定を取得する"""
    return SettingsResponse(
        hourly_wage=float(_get_setting(db, "hourly_wage") or 1050.0),
        notify_enabled=(_get_setting(db, "notify_enabled") or "true").lower() == "true",
        notify_time=_get_setting(db, "notify_time") or "08:00",
        notify_days_before=int(_get_setting(db, "notify_days_before") or 1),
    )


@router.put("", response_model=SettingsResponse)
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db)):
    """設定を更新する"""
    if body.hourly_wage is not None:
        _set_setting(db, "hourly_wage", str(body.hourly_wage))
    if body.notify_enabled is not None:
        _set_setting(db, "notify_enabled", str(body.notify_enabled).lower())
    if body.notify_time is not None:
        _set_setting(db, "notify_time", body.notify_time)
    if body.notify_days_before is not None:
        _set_setting(db, "notify_days_before", str(body.notify_days_before))

    return get_settings(db=db)
