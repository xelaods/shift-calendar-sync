"""
APScheduler による定期タスク
- 毎朝 8:00: 翌日・当日シフトの通知送信
- 毎週月曜 6:00: 当月・翌月シフトの自動同期
"""
import os
import logging
from datetime import datetime, timedelta, date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .database import SessionLocal

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler(timezone="Asia/Tokyo")


def _get_db():
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


def job_notify_shifts():
    """
    通知ジョブ: 翌日・当日のシフトがある場合に通知送信。
    設定の notify_days_before に応じて翌日または当日を判断。
    """
    db = SessionLocal()
    try:
        from .models import Shift, FcmToken, UserSettings
        from .routers.notifications import _send_fcm_multicast

        # 設定を取得
        def _get_setting(key: str, default: str) -> str:
            s = db.query(UserSettings).filter(UserSettings.key == key).first()
            return s.value if s and s.value else default

        notify_enabled = _get_setting("notify_enabled", "true").lower() == "true"
        if not notify_enabled:
            logger.info("[Scheduler] 通知が無効のためスキップ")
            return

        days_before = int(_get_setting("notify_days_before", "1"))
        target_date = date.today() + timedelta(days=days_before)

        shifts = (
            db.query(Shift)
            .filter(Shift.date == target_date)
            .all()
        )

        if not shifts:
            logger.info(f"[Scheduler] {target_date} のシフトなし。通知スキップ")
            return

        shift_info = ", ".join(f"{s.start_time}〜{s.end_time}" for s in shifts)
        if days_before == 0:
            title = "⏰ 今日のシフト"
            body = f"{target_date.strftime('%m/%d')} {shift_info}"
        elif days_before == 1:
            title = "🗓 明日シフトあります！"
            body = f"{target_date.strftime('%m/%d')} {shift_info}"
        else:
            title = f"📅 {days_before}日後にシフトあります"
            body = f"{target_date.strftime('%m/%d')} {shift_info}"

        tokens = [t.token for t in db.query(FcmToken).all()]
        if tokens:
            sent = _send_fcm_multicast(tokens, title, body)
            logger.info(f"[Scheduler] 通知送信完了: {sent}/{len(tokens)} 台")
        else:
            logger.info("[Scheduler] 登録済みデバイスなし")

    except Exception as e:
        logger.error(f"[Scheduler] 通知ジョブエラー: {e}")
    finally:
        db.close()


def job_auto_sync():
    """
    自動同期ジョブ: 当月・翌月のシフトをスクレイプしてDBに保存。
    毎週月曜 6:00 に実行。
    """
    db = SessionLocal()
    try:
        import sys
        shift_sync_dir = os.path.join(os.path.dirname(__file__), "..")
        sys.path.insert(0, os.path.abspath(shift_sync_dir))

        from scraper import ShifuconScraper
        from .models import Shift

        today = date.today()
        months_to_sync = [
            (today.year, today.month),
        ]
        # 翌月も追加
        if today.month == 12:
            months_to_sync.append((today.year + 1, 1))
        else:
            months_to_sync.append((today.year, today.month + 1))

        scraper = ShifuconScraper(headless=True)
        all_shifts = scraper.get_shifts_for_months(months_to_sync)

        added = 0
        for entry in all_shifts:
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
                added += 1

        db.commit()
        logger.info(f"[Scheduler] 自動同期完了: {len(all_shifts)}件取得, {added}件追加")

    except Exception as e:
        logger.error(f"[Scheduler] 自動同期エラー: {e}")
    finally:
        db.close()


def start_scheduler():
    """スケジューラを起動する（FastAPI startup イベントから呼ぶ）"""
    # 通知: 設定の notify_time に従って実行（デフォルト毎朝8:00）
    # 簡易実装: 毎朝 8:00 固定（設定変更は再起動が必要）
    notify_time = os.getenv("NOTIFY_TIME", "08:00")
    notify_hour, notify_minute = map(int, notify_time.split(":"))

    scheduler.add_job(
        job_notify_shifts,
        CronTrigger(hour=notify_hour, minute=notify_minute, timezone="Asia/Tokyo"),
        id="notify_shifts",
        replace_existing=True,
    )

    # 自動同期: 毎週月曜 6:00
    scheduler.add_job(
        job_auto_sync,
        CronTrigger(day_of_week="mon", hour=6, minute=0, timezone="Asia/Tokyo"),
        id="auto_sync",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("[Scheduler] スケジューラ起動完了")


def stop_scheduler():
    """スケジューラを停止する（FastAPI shutdown イベントから呼ぶ）"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("[Scheduler] スケジューラ停止")
