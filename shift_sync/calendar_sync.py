"""
Google カレンダーへのシフト登録モジュール
"""
import os
import json
from datetime import datetime, date, timedelta
from typing import Optional

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import (
    GOOGLE_CALENDAR_ID,
    SHIFT_EVENT_PREFIX,
    SHIFT_EVENT_TAG,
    SCOPES,
    CREDENTIALS_FILE,
    TOKEN_FILE,
)
from scraper import ShiftEntry


class GoogleCalendarSync:
    """Google カレンダーへのシフト同期クラス"""

    def __init__(self):
        self.service = self._authenticate()

    def _authenticate(self):
        """認証を行いカレンダーサービスを返す。

        優先順位:
        1. SERVICE_ACCOUNT_JSON 環境変数（base64エンコード）— クラウドデプロイ推奨
        2. service_account.json ファイル — ローカル開発用
        3. credentials.json（OAuth2方式）— フォールバック
        """
        import os, base64, tempfile
        from google.oauth2 import service_account

        # ─── 1. 環境変数から読み込む（Render等のクラウド向け） ───
        sa_json_b64 = os.environ.get("SERVICE_ACCOUNT_JSON", "")
        if sa_json_b64:
            print("[カレンダー] 環境変数 SERVICE_ACCOUNT_JSON からサービスアカウント認証を行います...")
            try:
                sa_json = base64.b64decode(sa_json_b64).decode("utf-8")
                sa_info = json.loads(sa_json)
                creds = service_account.Credentials.from_service_account_info(
                    sa_info, scopes=SCOPES
                )
                print("[カレンダー] 環境変数からサービスアカウント認証成功！")
                return build("calendar", "v3", credentials=creds)
            except Exception as e:
                print(f"[カレンダー] 環境変数からの認証失敗: {e}")

        # ─── 2. ファイルから読み込む（ローカル開発） ───
        sa_file = os.path.join(os.path.dirname(__file__), "service_account.json")
        if os.path.exists(sa_file):
            print("[カレンダー] service_account.json からサービスアカウント認証を行います...")
            creds = service_account.Credentials.from_service_account_file(
                sa_file,
                scopes=SCOPES,
            )
            print("[カレンダー] サービスアカウント認証成功！")
            return build("calendar", "v3", credentials=creds)

        # ─── OAuth2 認証（フォールバック） ───
        print("[カレンダー] credentials.json を使用します...")
        creds: Optional[Credentials] = None
        if os.path.exists(TOKEN_FILE):
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                print("[カレンダー] トークンを更新中...")
                creds.refresh(Request())
            else:
                if not os.path.exists(CREDENTIALS_FILE):
                    raise FileNotFoundError(
                        "認証情報が見つかりません。\n"
                        "service_account.json が必要です。"
                    )
                print("[カレンダー] ブラウザで Google 認証を行います...")
                flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
                creds = flow.run_local_server(port=0)

            with open(TOKEN_FILE, "w") as token_file:
                token_file.write(creds.to_json())
            print(f"[カレンダー] 認証成功。トークンを {TOKEN_FILE} に保存しました。")

        return build("calendar", "v3", credentials=creds)


    def sync_shifts(self, shifts: list[ShiftEntry]) -> dict:
        """
        シフト一覧をGoogleカレンダーに同期する。
        戻り値: {"added": int, "skipped": int, "errors": int}
        """
        result = {"added": 0, "skipped": 0, "errors": 0}

        if not shifts:
            print("[カレンダー] 登録するシフトがありません")
            return result

        # 既存のシフトイベントを取得（重複チェック用）
        print("[カレンダー] 既存のシフトイベントを確認中...")
        existing = self._get_existing_shift_events(shifts)
        print(f"[カレンダー] 既存シフトイベント: {len(existing)} 件")

        for shift in shifts:
            try:
                event_key = self._make_event_key(shift)
                if event_key in existing:
                    print(f"  [スキップ] {shift.date} {shift.start_time}〜{shift.end_time} (既登録)")
                    result["skipped"] += 1
                    continue

                event = self._build_event(shift)
                created = self.service.events().insert(
                    calendarId=GOOGLE_CALENDAR_ID,
                    body=event,
                ).execute()
                print(f"  [追加] {shift.date} {shift.start_time}〜{shift.end_time} -> {created.get('htmlLink')}")
                result["added"] += 1

            except HttpError as e:
                print(f"  [エラー] {shift}: {e}")
                result["errors"] += 1

        return result

    def _get_existing_shift_events(self, shifts: list[ShiftEntry]) -> set[str]:
        """
        シフトの日付範囲内の既存イベントを取得し、
        重複チェック用のキーセットを返す。
        """
        if not shifts:
            return set()

        dates = [s.date for s in shifts]
        min_date = min(dates)
        max_date = max(dates)

        time_min = datetime.combine(min_date, datetime.min.time()).isoformat() + "Z"
        time_max = datetime.combine(max_date + timedelta(days=1), datetime.min.time()).isoformat() + "Z"

        existing_keys = set()
        page_token = None

        while True:
            events_result = self.service.events().list(
                calendarId=GOOGLE_CALENDAR_ID,
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy="startTime",
                pageToken=page_token,
            ).execute()

            for event in events_result.get("items", []):
                # 拡張プロパティで識別タグを確認
                ext_props = event.get("extendedProperties", {}).get("private", {})
                if ext_props.get("source") == SHIFT_EVENT_TAG:
                    key = ext_props.get("shift_key", "")
                    if key:
                        existing_keys.add(key)

            page_token = events_result.get("nextPageToken")
            if not page_token:
                break

        return existing_keys

    def _make_event_key(self, shift: ShiftEntry) -> str:
        """シフトの一意キーを生成（重複チェック用）"""
        return f"{shift.date.isoformat()}_{shift.start_time}_{shift.end_time}"

    @staticmethod
    def _parse_time_on_date(base_date: date, time_str: str) -> datetime:
        """
        "HH:MM" 形式の時刻を datetime に変換する。
        "24:00" など 24時以降の表記は翌日の 00:00 等として処理する。
        """
        h, m = map(int, time_str.split(":"))
        if h >= 24:
            # 24:00 → 翌日 00:00、 25:30 → 翌日 01:30 など
            return datetime.combine(base_date + timedelta(days=h // 24),
                                    datetime.min.time().replace(hour=h % 24, minute=m))
        return datetime.combine(base_date, datetime.min.time().replace(hour=h, minute=m))

    def delete_all_shift_events(self) -> dict:
        """
        ShiftSync タグが付いたGoogleカレンダーのイベントをすべて削除する。
        戻り値: {"deleted": int, "errors": int}
        """
        result = {"deleted": 0, "errors": 0}
        page_token = None

        print("[カレンダー] ShiftSync イベントを検索・削除中...")
        while True:
            events_result = self.service.events().list(
                calendarId=GOOGLE_CALENDAR_ID,
                singleEvents=True,
                maxResults=250,
                pageToken=page_token,
            ).execute()

            for event in events_result.get("items", []):
                ext_props = event.get("extendedProperties", {}).get("private", {})
                if ext_props.get("source") == SHIFT_EVENT_TAG:
                    try:
                        self.service.events().delete(
                            calendarId=GOOGLE_CALENDAR_ID,
                            eventId=event["id"],
                        ).execute()
                        print(f"  [削除] {event.get('summary', '')} ({event.get('id')})")
                        result["deleted"] += 1
                    except HttpError as e:
                        print(f"  [エラー] イベント削除失敗: {e}")
                        result["errors"] += 1

            page_token = events_result.get("nextPageToken")
            if not page_token:
                break

        print(f"[カレンダー] 削除完了: {result['deleted']}件")
        return result

    def _build_event(self, shift: ShiftEntry) -> dict:
        """Google カレンダーイベントのdictを生成する"""
        # 日本時間（JST, UTC+9）でイベントを作成
        start_dt = self._parse_time_on_date(shift.date, shift.start_time)
        end_dt   = self._parse_time_on_date(shift.date, shift.end_time)

        # 終了時刻が開始時刻より前の場合（深夜をまたぐシフト）は翌日扱い
        if end_dt <= start_dt:
            end_dt += timedelta(days=1)

        title = SHIFT_EVENT_PREFIX

        description_lines = [
            f"シフコンから自動取得したシフトです。",
            f"勤務時間: {shift.start_time}〜{shift.end_time}",
            f"店舗: {shift.store_name}",
        ]
        if shift.note:
            description_lines.append(f"備考: {shift.note}")

        return {
            "summary": title,
            "description": "\n".join(description_lines),
            "start": {
                "dateTime": start_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "Asia/Tokyo",
            },
            "end": {
                "dateTime": end_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "Asia/Tokyo",
            },
            "colorId": "5",  # バナナ（黄色）
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 60},   # 1時間前
                    {"method": "popup", "minutes": 1440}, # 前日
                ],
            },
            "extendedProperties": {
                "private": {
                    "source": SHIFT_EVENT_TAG,
                    "shift_key": self._make_event_key(shift),
                }
            },
        }
