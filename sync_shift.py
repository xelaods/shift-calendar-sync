import os
import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime, timedelta
import json
import sys


# Windowsコンソールの文字化け・エンコード回避
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


# ============================================================
#  設定 (環境変数または直接入力)
# ============================================================
LOGIN_ID = os.getenv("LOGIN_ID", "0332388")
PASSWORD = os.getenv("PASSWORD", "hs628496")
GAS_WEB_APP_URL = os.getenv("GAS_WEB_APP_URL", "https://script.google.com/macros/s/AKfycbxhVGQlXnysiCC_yeYNRz8O5hNd_TI3qwE8dQsvYD_5fFkl5OAHTWnB320jptjapRv9/exec")
SYNC_DAYS = int(os.getenv("SYNC_DAYS", "30"))


LOGIN_URL = "https://shifucon.ppihgroup.com/staffpage/"
LOGIN_ACTION_URL = "https://shifucon.ppihgroup.com/frontparts/login_check.php"


def get_shift_data():
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    })


    print("1. ログインページを取得中...")
    res = session.get(LOGIN_URL)
    if res.status_code != 200:
        print(f"❌ ログインページの取得に失敗しました (Status: {res.status_code})")
        print("Response Headers:", dict(res.headers))
        print("Response Body:", res.text[:2000])
        return []


    soup = BeautifulSoup(res.text, "html.parser")
    transaction_id_elem = soup.find("input", {"name": "transactionid"})
    url_elem = soup.find("input", {"name": "url"})


    if not transaction_id_elem:
        print("❌ transactionidの取得に失敗しました")
        return []


    transaction_id = transaction_id_elem.get("value", "")
    url_val = url_elem.get("value", "") if url_elem else ""


    print(f"2. ログイン実行中 ({LOGIN_ID})...")
    payload = {
        "login_email": LOGIN_ID,
        "login_pass": PASSWORD,
        "transactionid": transaction_id,
        "mode": "login",
        "url": url_val,
        "is_tablet": ""
    }


    login_res = session.post(LOGIN_ACTION_URL, data=payload, allow_redirects=True)
    if "login_email" in login_res.text and "from_hour0" not in login_res.text:
        print("❌ ログインに失敗しました。IDとパスワードを確認してください。")
