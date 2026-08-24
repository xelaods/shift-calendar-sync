import os
import sys
import time
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup

# Selenium
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

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

def create_driver(headless=True):
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,900")
    options.add_argument("--lang=ja-JP")
    options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36")
    
    # ボット検知回避
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-logging", "enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    driver = webdriver.Chrome(options=options)
    driver.set_page_load_timeout(30)
    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"}
    )
    return driver

def get_shift_data():
    print("1. ブラウザを起動中...")
    driver = create_driver(headless=True)
    shifts = []
    seen_dates = set()

    try:
        print(f"2. ログインページへアクセス中 ({LOGIN_URL})...")
        driver.get(LOGIN_URL)
        time.sleep(2)

        # ログインフォーム入力
        print(f"3. ログイン情報入力中 ({LOGIN_ID})...")
        print(f"   現在のURL: {driver.current_url}")
        print(f"   タイトル: {driver.title}")
        
        # IDフィールドを探す
        id_elem = None
        for sel in ["login_email", "login_id", "staff_id"]:
            try:
                id_elem = driver.find_element(By.NAME, sel)
                break
            except Exception:
                pass
        if not id_elem:
            try:
                id_elem = driver.find_element(By.CSS_SELECTOR, "input[type='text']")
            except Exception:
                pass

        # パスワードフィールドを探す
        pw_elem = None
        for sel in ["login_pass", "password"]:
            try:
                pw_elem = driver.find_element(By.NAME, sel)
                break
            except Exception:
                pass
        if not pw_elem:
            try:
                pw_elem = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
            except Exception:
                pass

        if not id_elem or not pw_elem:
            print("--- ページソース (先頭 1000文字) ---")
            print(driver.page_source[:1000])
            print("---------------------------------")
            raise RuntimeError("ログインフォームの入力欄が見つかりませんでした")

        id_elem.clear()
        id_elem.send_keys(LOGIN_ID)
        pw_elem.clear()
        pw_elem.send_keys(PASSWORD)

        # サブミット
        pw_elem.submit()
        time.sleep(3)

        if "login_check" in driver.current_url or "login" in driver.title.lower():
            if "from_hour0" not in driver.page_source:
                raise RuntimeError("ログインに失敗しました。IDとパスワードを確認してください。")

        print("✅ ログイン成功！")

        today = datetime.now().date()
        end_date = today + timedelta(days=SYNC_DAYS)
        pages = (SYNC_DAYS // 14) + 1
        current_fetch_date = today

        for p in range(pages):
            date_str = current_fetch_date.strftime("%Y%m%d")
            page_url = f"{LOGIN_URL}?select_date={date_str}"
            print(f"   シフトデータ取得中 ({current_fetch_date.strftime('%Y/%m/%d')}〜)...")

            driver.get(page_url)
            time.sleep(2)

            soup = BeautifulSoup(driver.page_source, "html.parser")
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

                # 指定期間外はスキップ
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

    finally:
        driver.quit()

    return shifts

def sync_to_gas(shifts):
    if not shifts:
        print("⚠️ 送信するシフトデータがありません")
        return

    if GAS_WEB_APP_URL == "YOUR_GAS_WEB_APP_URL_HERE" or not GAS_WEB_APP_URL.startswith("https://"):
        print("\n❌ GASのWebアプリURLが設定されていません。")
        return

    print(f"\n4. Googleカレンダーへ同期中 ({len(shifts)} 件のシフト)...")
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
    try:
        shifts = get_shift_data()
        if shifts:
            sync_to_gas(shifts)
        else:
            print(f"ℹ️ 本日より {SYNC_DAYS} 日間の対象シフトはありませんでした。")
    except Exception as e:
        print(f"❌ 処理中にエラーが発生しました: {e}")
        sys.exit(1)
    print("=== 終了 ===")
