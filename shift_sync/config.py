"""
設定・定数管理モジュール
"""
import os
from dotenv import load_dotenv

load_dotenv()

# シフコン設定
SHIFUCON_BASE_URL = "https://shifucon.ppihgroup.com/staffpage/?"
SHIFUCON_STAFF_ID = os.getenv("SHIFUCON_STAFF_ID", "")
SHIFUCON_PASSWORD = os.getenv("SHIFUCON_PASSWORD", "")

# Google カレンダー設定
GOOGLE_CALENDAR_ID = os.getenv("GOOGLE_CALENDAR_ID", "primary")
SHIFT_EVENT_PREFIX = os.getenv("SHIFT_EVENT_PREFIX", "シフト")

# Google API スコープ
SCOPES = ["https://www.googleapis.com/auth/calendar"]

# 認証ファイルパス
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "credentials.json")
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token.json")

# イベント識別タグ（重複チェック用）
SHIFT_EVENT_TAG = "shifucon_auto_sync"
