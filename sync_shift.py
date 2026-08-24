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
SYNC_DAYS = int(os.getenv("SYNC_DAYS", "5"))

LOGIN_URL = "https://shifucon.ppihgroup.com/staffpage/"
LOGIN_ACTION_URL = "https://shifucon.ppihgroup.com/frontparts/login_check.php"

def parse_shifts_from_soup(soup, today, end_date, seen_dates, shifts):
    found_any = False
    for i in range(14):
        date_elem = soup.find("input", {"id": f"select_date{i}"}) or soup.find("input", {"name": f"select_date{i}"})
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

        # 指定期間（今日〜今日+SYNC_DAYS日）の範囲外はスキップ
        if not (today <= shift_date < end_date):
            continue

        date_key = f"{year:04d}-{month:02d}-{day:02d}"
        if date_key in seen_dates:
            continue

        holiday_type_elem = soup.find("input", {"id": f"holiday_type{i}"}) or soup.find("input", {"name": f"holiday_type{i}"})
        shift_type_elem = soup.find("input", {"id": f"shift_type{i}"}) or soup.find("input", {"name": f"shift_type{i}"})
        from_h_elem = soup.find("input", {"id": f"from_hour{i}"}) or soup.find("input", {"name": f"from_hour{i}"})
        from_m_elem = soup.find("input", {"id": f"from_minutes{i}"}) or soup.find("input", {"name": f"from_minutes{i}"})
        to_h_elem = soup.find("input", {"id": f"to_hour{i}"}) or soup.find("input", {"name": f"to_hour{i}"})
        to_m_elem = soup.find("input", {"id": f"to_minutes{i}"}) or soup.find("input", {"name": f"to_minutes{i}"})

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
            
            # 24時以上の深夜終了対応 (例: 24:00 -> 翌00:00, 26:00 -> 翌02:00)
            end_h_int = int(to_h)
            days_add = 0
            if end_h_int >= 24:
                days_add = end_h_int // 24
                end_h_int = end_h_int % 24
            
            end_dt = datetime(year, month, day, end_h_int, int(to_m)) + timedelta(days=days_add)

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

    return found_any

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

    # メインページ取得
    page_res = session.get(LOGIN_URL, timeout=15)
    page_soup = BeautifulSoup(page_res.text, "html.parser")

    shifts = []
    seen_dates = set()
    today = datetime.now().date()
    end_date = today + timedelta(days=SYNC_DAYS)

    print(f"   同期対象期間: {today.strftime('%Y/%m/%d')} 〜 {(end_date - timedelta(days=1)).strftime('%Y/%m/%d')} ({SYNC_DAYS}日間)")

    # 初期表示の開始日を確認
    d0_elem = page_soup.find("input", {"id": "select_date0"}) or page_soup.find("input", {"name": "select_date0"})
    if d0_elem:
        d0_val = d0_elem.get("value", "")
        if d0_val and len(d0_val) == 8:
            d0_date = datetime(int(d0_val[:4]), int(d0_val[4:6]), int(d0_val[6:8])).date()
            
            # もし初期表示の開始日が今日より未来なら、今日が含まれるスパンまで date_back
            if d0_date > today:
                print("   ⏪ 今日が含まれる期間へ遡ります (date_back)...")
                form1 = page_soup.find("form", {"id": "form1"}) or page_soup.find("form", {"name": "form1"})
                if form1:
                    form_data = {}
                    for inp in form1.find_all("input"):
                        if inp.get("name"):
                            form_data[inp.get("name")] = inp.get("value", "")
                    form_data["mode"] = "date_back"
                    back_res = session.post(LOGIN_URL, data=form_data, timeout=15)
                    page_soup = BeautifulSoup(back_res.text, "html.parser")

    # 現在のページ（今週分）からシフト抽出
    parse_shifts_from_soup(page_soup, today, end_date, seen_dates, shifts)

    # 必要に応じて次のスパン（date_next）も取得
    d13_elem = page_soup.find("input", {"id": "select_date13"}) or page_soup.find("input", {"name": "select_date13"})
    if d13_elem:
        d13_val = d13_elem.get("value", "")
        if d13_val and len(d13_val) == 8:
            d13_date = datetime(int(d13_val[:4]), int(d13_val[4:6]), int(d13_val[6:8])).date()
            if d13_date < end_date:
                form1 = page_soup.find("form", {"id": "form1"}) or page_soup.find("form", {"name": "form1"})
                if form1:
                    form_data = {}
                    for inp in form1.find_all("input"):
                        if inp.get("name"):
                            form_data[inp.get("name")] = inp.get("value", "")
                    form_data["mode"] = "date_next"
                    next_res = session.post(LOGIN_URL, data=form_data, timeout=15)
                    next_soup = BeautifulSoup(next_res.text, "html.parser")
                    parse_shifts_from_soup(next_soup, today, end_date, seen_dates, shifts)

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
