"""
シフト CRUD エンドポイント
"""
import sys
import os
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import extract

# 親ディレクトリのモジュールを参照
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from ..database import get_db
from ..models import Shift
from ..schemas import (
    ShiftCreate, ShiftUpdate, ShiftResponse,
    SyncRequest, SyncResponse,
)

router = APIRouter(prefix="/shifts", tags=["shifts"])


@router.get("", response_model=List[ShiftResponse])
def list_shifts(
    year: Optional[int] = Query(None, description="年"),
    month: Optional[int] = Query(None, description="月"),
    db: Session = Depends(get_db),
):
    """シフト一覧を取得する。year/month で絞り込み可能。"""
    q = db.query(Shift)
    if year:
        q = q.filter(extract("year", Shift.date) == year)
    if month:
        q = q.filter(extract("month", Shift.date) == month)
    shifts = q.order_by(Shift.date, Shift.start_time).all()
    return shifts


@router.get("/{year}/{month}", response_model=List[ShiftResponse])
def get_shifts_by_month(
    year: int,
    month: int,
    db: Session = Depends(get_db),
):
    """指定年月のシフト一覧を取得する。"""
    shifts = (
        db.query(Shift)
        .filter(
            extract("year", Shift.date) == year,
            extract("month", Shift.date) == month,
        )
        .order_by(Shift.date, Shift.start_time)
        .all()
    )
    return shifts


@router.post("", response_model=ShiftResponse, status_code=201)
def create_shift(body: ShiftCreate, db: Session = Depends(get_db)):
    """手動でシフトを追加する。"""
    # 重複チェック
    existing = (
        db.query(Shift)
        .filter(
            Shift.date == body.date,
            Shift.start_time == body.start_time,
            Shift.end_time == body.end_time,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="同じシフトがすでに登録されています")

    shift = Shift(
        date=body.date,
        start_time=body.start_time,
        end_time=body.end_time,
        store_name=body.store_name,
        note=body.note or "",
        source="manual",
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


@router.put("/{shift_id}", response_model=ShiftResponse)
def update_shift(
    shift_id: int,
    body: ShiftUpdate,
    db: Session = Depends(get_db),
):
    """シフトを編集する。"""
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="シフトが見つかりません")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(shift, key, value)

    db.commit()
    db.refresh(shift)
    return shift


@router.delete("/{shift_id}", status_code=204)
def delete_shift(shift_id: int, db: Session = Depends(get_db)):
    """シフトを削除する。"""
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="シフトが見つかりません")
    db.delete(shift)
    db.commit()


@router.delete("/all", status_code=200)
def delete_all_shifts(db: Session = Depends(get_db)):
    """DBに登録されているすべてのシフトを削除する。"""
    count = db.query(Shift).count()
    db.query(Shift).delete()
    db.commit()
    return {"deleted": count, "message": f"{count}件のシフトを削除しました"}


@router.post("/sync", response_model=SyncResponse)
def sync_shifts(
    body: SyncRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    シフコンからシフトをスクレイプし、DBとGoogleカレンダーに同期する。
    時間がかかるためバックグラウンドタスクとして実行する。
    """
    from datetime import datetime
    now = datetime.now()
    year = body.year or now.year
    month = body.month or now.month

    # バックグラウンドでスクレイプ・同期を実行
    background_tasks.add_task(_run_sync, year, month, body.sync_to_gcal, db)

    return SyncResponse(
        scraped=0,
        added_to_db=0,
        gcal_added=0,
        gcal_skipped=0,
        gcal_errors=0,
        message=f"{year}年{month}月のシフト同期を開始しました。しばらくお待ちください。",
    )


@router.post("/sync/blocking", response_model=SyncResponse)
def sync_shifts_blocking(
    body: SyncRequest,
    db: Session = Depends(get_db),
):
    """
    同期を同期的（ブロッキング）に実行する。
    小さい月や初回テスト用。タイムアウトに注意。
    """
    from datetime import datetime
    now = datetime.now()
    year = body.year or now.year
    month = body.month or now.month
    return _run_sync(year, month, body.sync_to_gcal, db, force_first_run=body.force_first_run)


def _run_sync(year: int, month: int, sync_to_gcal: bool, db: Session,
              force_first_run: bool = False) -> SyncResponse:
    """実際のスクレイプ・同期処理（初回/通常モード自動切替）"""
    import sys, os
    from datetime import date, timedelta, datetime as _dt

    shift_sync_dir = os.path.join(os.path.dirname(__file__), "..", "..")
    sys.path.insert(0, os.path.abspath(shift_sync_dir))

    FLAG_FILE       = os.path.abspath(os.path.join(shift_sync_dir, "first_run_done.flag"))
    FIRST_RUN_START = date(2026, 1, 1)
    NORMAL_RUN_DAYS = 5

    from scraper import ShifuconScraper

    # force_first_run=True の場合はフラグを無視して初回モードで実行
    is_first_run = force_first_run or not os.path.exists(FLAG_FILE)
    today        = date.today()
    date_to      = today + timedelta(days=NORMAL_RUN_DAYS)

    scraper = ShifuconScraper(headless=True)

    if is_first_run:
        # ─── 初回: 2026/1/1 〜 今日+5日 ───
        date_from = FIRST_RUN_START
        print(f"[API] 初回モード: {date_from} 〜 {date_to}")

        def _make_month_list(start: date, end: date):
            months, y, m = [], start.year, start.month
            while (y, m) <= (end.year, end.month):
                months.append((y, m))
                m += 1
                if m > 12:
                    m, y = 1, y + 1
            return months

        month_list = _make_month_list(date_from, date_to)
        if len(month_list) == 1:
            y, m = month_list[0]
            scraped_shifts = scraper.get_shifts(year=y, month=m,
                                                date_from=date_from, date_to=date_to)
        else:
            scraped_shifts = scraper.get_shifts_for_months(month_list,
                                                           date_from=date_from,
                                                           date_to=date_to)
    else:
        # ─── 2回目以降: 今日 〜 今日+5日 ───
        date_from = today
        print(f"[API] 通常モード: {date_from} 〜 {date_to}")
        scraped_shifts = scraper.get_shifts(year=year, month=month,
                                            date_from=date_from, date_to=date_to)

    # ─── DB 保存 ───
    added_to_db = 0
    for entry in scraped_shifts:
        existing = (
            db.query(Shift)
            .filter(
                Shift.date == entry.date,
                Shift.start_time == entry.start_time,
                Shift.end_time == entry.end_time,
            )
            .first()
        )
        if not existing:
            shift = Shift(
                date=entry.date,
                start_time=entry.start_time,
                end_time=entry.end_time,
                store_name=entry.store_name,
                note=entry.note,
                source="auto",
            )
            db.add(shift)
            added_to_db += 1

    db.commit()

    # ─── 初回フラグを作成 ───
    if is_first_run:
        with open(FLAG_FILE, "w") as f:
            f.write(_dt.now().isoformat())
        print(f"[API] 初回フラグを保存しました: {FLAG_FILE}")

    # ─── GCal 同期 ───
    gcal_added = gcal_skipped = gcal_errors = 0
    if sync_to_gcal and scraped_shifts:
        try:
            from calendar_sync import GoogleCalendarSync
            cal = GoogleCalendarSync()
            result = cal.sync_shifts(scraped_shifts)
            gcal_added   = result.get("added", 0)
            gcal_skipped = result.get("skipped", 0)
            gcal_errors  = result.get("errors", 0)
        except Exception as e:
            gcal_errors = 1
            print(f"[API] Googleカレンダー同期エラー: {e}")

    mode_label = "初回" if is_first_run else "通常"
    return SyncResponse(
        scraped=len(scraped_shifts),
        added_to_db=added_to_db,
        gcal_added=gcal_added,
        gcal_skipped=gcal_skipped,
        gcal_errors=gcal_errors,
        message=f"[{mode_label}] {len(scraped_shifts)}件取得, DB+{added_to_db}件, GCal+{gcal_added}件",
    )



@router.delete("/gcal/all", status_code=200)
def delete_all_gcal_events():
    """
    Googleカレンダーに登録されているすべてのシフトイベントを削除する。
    """
    import sys, os
    shift_sync_dir = os.path.join(os.path.dirname(__file__), "..", "..")
    sys.path.insert(0, os.path.abspath(shift_sync_dir))

    try:
        from calendar_sync import GoogleCalendarSync
        cal = GoogleCalendarSync()
        result = cal.delete_all_shift_events()
        return {
            "deleted": result.get("deleted", 0),
            "errors": result.get("errors", 0),
            "message": f"Googleカレンダーのシフトイベントを{result.get('deleted', 0)}件削除しました",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"カレンダー削除エラー: {str(e)}")

