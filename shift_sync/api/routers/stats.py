"""
統計エンドポイント
月別の勤務時間・推定月収などを計算して返す
"""
from datetime import date
from typing import List
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract

from ..database import get_db
from ..models import Shift, UserSettings
from ..schemas import MonthlyStats

router = APIRouter(prefix="/stats", tags=["stats"])


def _get_hourly_wage(db: Session) -> float:
    """DB から時給設定を取得する（未設定なら 1050 円）"""
    setting = db.query(UserSettings).filter(UserSettings.key == "hourly_wage").first()
    if setting and setting.value:
        try:
            return float(setting.value)
        except ValueError:
            pass
    return 1050.0


def _calc_hours(start_time: str, end_time: str) -> float:
    """開始・終了時刻から勤務時間（時間）を計算する"""
    def to_minutes(t: str) -> int:
        h, m = map(int, t.split(":"))
        return h * 60 + m

    start_min = to_minutes(start_time)
    end_min = to_minutes(end_time)
    if end_min <= start_min:
        end_min += 24 * 60  # 深夜またぎ

    return (end_min - start_min) / 60.0


@router.get("/{year}/{month}", response_model=MonthlyStats)
def get_monthly_stats(
    year: int,
    month: int,
    db: Session = Depends(get_db),
):
    """指定年月の統計情報を返す"""
    shifts = (
        db.query(Shift)
        .filter(
            extract("year", Shift.date) == year,
            extract("month", Shift.date) == month,
        )
        .order_by(Shift.date)
        .all()
    )

    hourly_wage = _get_hourly_wage(db)

    total_hours = 0.0
    shift_dates: List[date] = []
    daily_hours: dict = {}

    for shift in shifts:
        hours = _calc_hours(shift.start_time, shift.end_time)
        total_hours += hours
        shift_dates.append(shift.date)
        date_key = shift.date.isoformat()
        daily_hours[date_key] = daily_hours.get(date_key, 0.0) + hours

    estimated_income = total_hours * hourly_wage

    return MonthlyStats(
        year=year,
        month=month,
        total_shifts=len(shifts),
        total_hours=round(total_hours, 2),
        estimated_income=round(estimated_income, 0),
        hourly_wage=hourly_wage,
        shift_dates=shift_dates,
        daily_hours={k: round(v, 2) for k, v in daily_hours.items()},
    )


@router.get("/{year}", response_model=List[MonthlyStats])
def get_yearly_stats(
    year: int,
    db: Session = Depends(get_db),
):
    """指定年の月別統計一覧を返す（データがある月のみ）"""
    from sqlalchemy import func
    months_with_data = (
        db.query(extract("month", Shift.date).label("month"))
        .filter(extract("year", Shift.date) == year)
        .distinct()
        .all()
    )
    results = []
    for (month,) in sorted(months_with_data):
        stats = get_monthly_stats(year=year, month=int(month), db=db)
        results.append(stats)
    return results
