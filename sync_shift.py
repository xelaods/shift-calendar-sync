import os
import sys
import re
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup

# Windowsコンソールの文字化け回避
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
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja-JP,ja;q=0.9",
    })

    print("1. ログインページを取得中...")
    try:
        res = session.get(LOGIN_URL, timeout=15)
    except Exception as e:
        print(f"❌ ログインページへの接続に失敗しました: {e}")
        sys.exit(1)

    if res.status_code != 200:
        print(f"❌ ログインページの取得に失敗しました (Status: {res.status_code})")
        sys.exit(1)

    soup = BeautifulSoup(res.text, "html.parser")
    transaction_id_elem = soup.find("input", {"name": "transactionid"})
    url_elem = soup.find("input", {"name": "url"})

    if not transaction_id_elem:
        print("❌ transactionidの取得に失敗しました")
        sys.exit(1)

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

    try:
        login_res = session.post(LOGIN_ACTION_URL, data=payload, allow_redirects=True, timeout=15)
    except Exception as e:
        print(f"❌ ログイン通信中にエラーが発生しました: {e}")
        sys.exit(1)

    if "login_email" in login_res.text and "from_hour0" not in login_res.text:
        print("❌ ログインに失敗しました。IDとパスワードを確認してください。")
        sys.exit(1)

    print("✅ ログイン成功！")

    shifts = []
    seen_dates = set()
    today = datetime.now().date()
    end_date = today + timedelta(days=SYNC_DAYS)
    pages = (SYNC_DAYS // 14) + 1
    current_fetch_date = today

    for page in range(pages):
        date_str = current_fetch_date.strftime("%Y%m%d")
        page_url = f"{LOGIN_URL}?select_date={date_str}"
        print(f"   シフトデータ取得中 ({current_fetch_date.strftime('%Y/%m/%d')}〜)...")

        page_res = session.get(page_url, timeout=15)
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
            shift_date = datetime(year, month, day).date()

            # 指定期間外はスキップ
            if not (today <= shift_date < end_date):
                continue

            date_key = f"{year:04d}-{month:02d}-{day:02d}"
            if date_key in seen_dates:
                continue

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

                seen_dates.add(date_key)
                shift_item = {
                    "date": date_key,
                    "start": start_dt.strftime("%Y-%m-%dT%H:%M:00+09:00"),
                    "end": end_dt.strftime("%Y-%m-%dT%H:%M:00+09:00"),
                    "time_str": f"{from_h}:{from_m}〜{to_h}:{to_m}"
                }
                shifts.append(shift_item)
                print(f"     📅 {year}/{month:02d}/{day:02d}: {from_h}:{from_m}〜{to_h}:{to_m}")

        if not found_any:
            break
        current_fetch_date += timedelta(days=14)
        if current_fetch_date >= end_date:
            break

    return shifts

def sync_to_gas(shifts):
    if not shifts:
        print("⚠️ 送信するシフトデータがありません")
        return

    print(f"\n3. Googleカレンダーへ同期中 ({len(shifts)} 件のシフト)...")
    res = requests.post(GAS_WEB_APP_URL, json={"shifts": shifts}, timeout=15)
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
    else:
        print(f"ℹ️ 本日より {SYNC_DAYS} 日間の対象シフトはありませんでした。")
    print("=== 終了 ===")
