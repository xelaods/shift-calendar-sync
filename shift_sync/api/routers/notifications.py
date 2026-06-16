"""
FCMプッシュ通知エンドポイント
"""
import os
import json
from typing import List, Optional
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import extract

from ..database import get_db
from ..models import FcmToken, Shift, UserSettings
from ..schemas import FcmTokenRegister, FcmTokenResponse, NotificationScheduleRequest

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/register", response_model=FcmTokenResponse)
def register_fcm_token(body: FcmTokenRegister, db: Session = Depends(get_db)):
    """
    iPhoneアプリから FCM トークンを登録する。
    既に存在する場合は更新日時のみ更新する。
    """
    existing = db.query(FcmToken).filter(FcmToken.token == body.token).first()
    if existing:
        existing.device_name = body.device_name
        existing.updated_at = datetime.utcnow()
        db.commit()
        return FcmTokenResponse(success=True, message="FCMトークンを更新しました")

    token = FcmToken(
        token=body.token,
        device_name=body.device_name,
    )
    db.add(token)
    db.commit()
    return FcmTokenResponse(success=True, message="FCMトークンを登録しました")


@router.delete("/unregister")
def unregister_fcm_token(token: str, db: Session = Depends(get_db)):
    """FCM トークンを削除する（アプリアンインストール時など）"""
    existing = db.query(FcmToken).filter(FcmToken.token == token).first()
    if existing:
        db.delete(existing)
        db.commit()
    return {"success": True}


@router.post("/send/tomorrow")
def send_tomorrow_notification(db: Session = Depends(get_db)):
    """
    翌日のシフトがある場合に全デバイスへプッシュ通知を送信する。
    APScheduler から定期的に呼び出されることを想定。
    """
    tomorrow = date.today() + timedelta(days=1)
    shifts = (
        db.query(Shift)
        .filter(Shift.date == tomorrow)
        .all()
    )

    if not shifts:
        return {"sent": 0, "message": "翌日のシフトなし"}

    # シフト情報を文字列化
    shift_info = ", ".join(
        f"{s.start_time}〜{s.end_time}" for s in shifts
    )
    title = "🗓 明日シフトあります！"
    body_text = f"{tomorrow.strftime('%m/%d')} {shift_info}"

    tokens = [t.token for t in db.query(FcmToken).all()]
    if not tokens:
        return {"sent": 0, "message": "登録済みデバイスなし"}

    sent = _send_fcm_multicast(tokens, title, body_text)
    return {"sent": sent, "message": f"{len(tokens)}台に通知送信"}


@router.post("/send/today")
def send_today_notification(db: Session = Depends(get_db)):
    """当日のシフトリマインダーを送信する"""
    today = date.today()
    shifts = (
        db.query(Shift)
        .filter(Shift.date == today)
        .all()
    )

    if not shifts:
        return {"sent": 0, "message": "今日のシフトなし"}

    shift_info = ", ".join(f"{s.start_time}〜{s.end_time}" for s in shifts)
    title = "⏰ 今日のシフト"
    body_text = f"{today.strftime('%m/%d')} {shift_info}"

    tokens = [t.token for t in db.query(FcmToken).all()]
    if not tokens:
        return {"sent": 0, "message": "登録済みデバイスなし"}

    sent = _send_fcm_multicast(tokens, title, body_text)
    return {"sent": sent, "message": f"{len(tokens)}台に通知送信"}


def _send_fcm_multicast(tokens: List[str], title: str, body: str) -> int:
    """
    FCM HTTP v1 API でマルチキャスト送信する。
    FIREBASE_CREDENTIALS_JSON 環境変数にサービスアカウントJSON文字列を設定すること。
    """
    firebase_creds_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    if not firebase_creds_json:
        print("[FCM] FIREBASE_CREDENTIALS_JSON が未設定です。通知をスキップします。")
        return 0

    try:
        import firebase_admin
        from firebase_admin import credentials, messaging

        # Firebase Admin SDK を初期化（未初期化の場合のみ）
        if not firebase_admin._apps:
            cred_dict = json.loads(firebase_creds_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)

        # マルチキャスト送信
        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(sound="default", badge=1)
                )
            ),
        )
        response = messaging.send_each_for_multicast(message)
        print(f"[FCM] 送信完了: 成功={response.success_count}, 失敗={response.failure_count}")
        return response.success_count

    except Exception as e:
        print(f"[FCM] 送信エラー: {e}")
        return 0
