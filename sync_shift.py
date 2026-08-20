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
SYNC_DAYS = int(os.getenv("SYNC_DAYS", "7"))

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
        return []

    print("✅ ログイン成功！")

    shifts = []
    target_date = datetime.now()
    end_date = target_date + timedelta(days=SYNC_DAYS)

    pages = (SYNC_DAYS // 14) + 2

    for page in range(pages):
        date_str = target_date.strftime("%Y%m%d")
        page_url = f"{LOGIN_URL}?select_date={date_str}"
        print(f"   シフトデータ取得中 ({target_date.strftime('%Y/%m/%d')}〜)...")

        page_res = session.get(page_url)
        page_soup = BeautifulSoup(page_res.text, "html.parser")

        found_any = False
        for i in range(14):
            date_elem = page_soup.find("input", {"id": f"select_date{i}"}) or page_soup.find("input", {"name": f"select_date{i}"})
            if not date_elem:
                break

            found_any = True
            d_str = date_elem.get("value", "")
            if not d_str or len(d_str) != 8:
                continue

            year = int(d_str[:4])
            month = int(d_str[4:6])
            day = int(d_str[6:8])

            holiday_type_elem = page_soup.find("input", {"id": f"holiday_type{i}"}) or page_soup.find("input", {"name": f"holiday_type{i}"})
            from_h_elem = page_soup.find("input", {"id": f"from_hour{i}"}) or page_soup.find("input", {"name": f"from_hour{i}"})
            from_m_elem = page_soup.find("input", {"id": f"from_minutes{i}"}) or page_soup.find("input", {"name": f"from_minutes{i}"})
            to_h_elem = page_soup.find("input", {"id": f"to_hour{i}"}) or page_soup.find("input", {"name": f"to_hour{i}"})
            to_m_elem = page_soup.find("input", {"id": f"to_minutes{i}"}) or page_soup.find("input", {"name": f"to_minutes{i}"})
            shift_type_elem = page_soup.find("input", {"id": f"shift_type{i}"}) or page_soup.find("input", {"name": f"shift_type{i}"})

            holiday_type = holiday_type_elem.get("value", "0") if holiday_type_elem else "0"
            shift_type = shift_type_elem.get("value", "0") if shift_type_elem else "0"
            from_h = from_h_elem.get("value", "") if from_h_elem else ""
            from_m = from_m_elem.get("value", "00") if from_m_elem else "00"
            to_h = to_h_elem.get("value", "") if to_h_elem else ""
            to_m = to_m_elem.get("value", "00") if to_m_elem else "00"

            is_off = (holiday_type == "1") or (shift_type == "2") or (not from_h and not to_h)

            if not is_off and from_h and to_h:
                from_m = from_m if from_m else "00"
                to_m = to_m if to_m else "00"

                start_dt = datetime(year, month, day, int(from_h), int(from_m))
                end_dt = datetime(year, month, day, int(to_h), int(to_m))

                if end_dt <= start_dt:
                    end_dt += timedelta(days=1)

                # +09:00 を付けてGASがJST（日本時間）として正しく解釈できるようにする
                shift_item = {
                    "date": f"{year:04d}-{month:02d}-{day:02d}",
                    "start": start_dt.strftime("%Y-%m-%dT%H:%M:00+09:00"),
                    "end": end_dt.strftime("%Y-%m-%dT%H:%M:00+09:00"),
                    "time_str": f"{from_h}:{from_m}〜{to_h}:{to_m}"
                }
                shifts.append(shift_item)
                print(f"     📅 {year}/{month:02d}/{day:02d}: {from_h}:{from_m}〜{to_h}:{to_m}")

        if not found_any:
            break

        target_date += timedelta(days=14)
        if target_date > end_date:
            break

    return shifts

def sync_to_gas(shifts):
    if not shifts:
        print("⚠️ 送信するシフトデータがありません")
        return

    if GAS_WEB_APP_URL == "YOUR_GAS_WEB_APP_URL_HERE" or not GAS_WEB_APP_URL.startswith("https://"):
        print("\n❌ GASのWebアプリURLが設定されていません。")
        print("   sync_shift.py の GAS_WEB_APP_URL にURLを設定してください。")
        return

    print(f"\n3. Googleカレンダーへ同期中 ({len(shifts)} 件のシフト)...")
    res = requests.post(GAS_WEB_APP_URL, json={"shifts": shifts})
    try:
        data = res.json()
        if data.get("status") == "success":
            print(f"🎉 同期完了！ (新規追加: {data.get('added')}件 / 更新: {data.get('updated')}件)")
        else:
            print(f"❌ 同期エラー: {data.get('message')}")
    except Exception as e:
        print(f"Response: {res.text}")

if __name__ == "__main__":
    print("=== シフト自動同期処理開始 ===")
    shifts = get_shift_data()
    if shifts:
        sync_to_gas(shifts)
    print("=== 終了 ===")
