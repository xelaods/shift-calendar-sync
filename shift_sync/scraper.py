"""
シフコン（shifucon.ppihgroup.com）からシフト情報をスクレイピングするモジュール
Selenium + Chrome WebDriver を使用
"""
import re
import time
import glob
import os
from datetime import datetime, date
from dataclasses import dataclass
from typing import Optional

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

from config import SHIFUCON_BASE_URL, SHIFUCON_STAFF_ID, SHIFUCON_PASSWORD


@dataclass
class ShiftEntry:
    """シフト1件分のデータ"""
    date: date
    start_time: str       # "09:00" 形式
    end_time: str         # "17:00" 形式
    store_name: str       # 店舗名
    note: str = ""        # 備考

    def __repr__(self):
        return f"ShiftEntry({self.date} {self.start_time}〜{self.end_time} @{self.store_name})"


class ShifuconScraper:
    """シフコンスクレイパー（Selenium使用）"""

    def __init__(self, headless: bool = True):
        self.headless = headless

    def _find_chromedriver_exe(self) -> str:
        """webdriver-manager がダウンロードした chromedriver.exe の実パスを返す"""
        # webdriver-manager は install() で正しくない (notices) ファイルパスを返すことがある
        # そのため .wdm キャッシュから直接 exe を探す
        wdm_base = os.path.join(os.path.expanduser("~"), ".wdm", "drivers", "chromedriver")
        exes = glob.glob(os.path.join(wdm_base, "**", "chromedriver.exe"), recursive=True)
        if exes:
            # 最新バージョンのものを使用
            exes.sort(key=os.path.getmtime, reverse=True)
            print(f"[スクレイパー] ChromeDriver: {exes[0]}")
            return exes[0]
        # fallback: webdriver-manager に任せる
        raw = ChromeDriverManager().install()
        # もし .exe でなければ同ディレクトリの exe を探す
        if not raw.endswith(".exe"):
            d = os.path.dirname(raw)
            candidates = glob.glob(os.path.join(d, "chromedriver*.exe"))
            if candidates:
                return candidates[0]
        return raw

    def _create_driver(self) -> webdriver.Chrome:
        """Chrome WebDriverを作成して返す（Windows/Linux両対応）"""
        import sys
        options = Options()
        if self.headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1280,900")
        options.add_argument("--lang=ja")
        # ボット検出を回避するための設定
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                             "AppleWebKit/537.36 (KHTML, like Gecko) "
                             "Chrome/148.0.0.0 Safari/537.36")
        options.add_experimental_option("excludeSwitches", ["enable-logging", "enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        if sys.platform == "win32":
            # Windows: wdm キャッシュから chromedriver.exe を検索
            driver_path = self._find_chromedriver_exe()
            service = Service(executable_path=driver_path)
            driver = webdriver.Chrome(service=service, options=options)
        else:
            # Linux/Mac (GitHub Actions など): Selenium Manager が自動検出
            print("[スクレイパー] Linux環境: Selenium Manager で ChromeDriver を自動検出します")
            driver = webdriver.Chrome(options=options)

        # ページロードタイムアウトを60秒に設定（デフォルトは30秒）
        driver.set_page_load_timeout(60)
        # navigator.webdriver フラグを隠す
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"}
        )
        return driver

    def get_shifts(self,
                   year: Optional[int] = None,
                   month: Optional[int] = None,
                   date_from: Optional[date] = None,
                   date_to: Optional[date] = None) -> list[ShiftEntry]:
        """
        指定月のシフト一覧を取得する。
        year/month を省略した場合は当月を取得。
        date_from/date_to を指定するとその範囲内のシフトのみを返す。
        """
        now = datetime.now()
        if year is None:
            year = now.year
        if month is None:
            month = now.month

        print(f"[スクレイパー] {year}年{month}月のシフトを取得中...")

        driver = self._create_driver()
        try:
            shifts = self._scrape(driver, year, month, date_from=date_from, date_to=date_to)
        finally:
            driver.quit()

        print(f"[スクレイパー] {len(shifts)} 件のシフトを取得しました")
        return shifts

    def _is_page_alive(self, driver: webdriver.Chrome) -> bool:
        """ページが正常に読み込まれているか確認する（エラーページでないか）"""
        try:
            # Chromeのエラーページは chrome-error:// スキームか、通常のURLでHTMLに特定テキストが含まれる
            current_url = driver.current_url
            if current_url.startswith("chrome-error://") or current_url == "data:,":
                return False
            # ページソースにエラーキーワードがあるか確認（高速チェック）
            src = driver.execute_script("return document.title || ''")
            if "shifucon" in src.lower() or "staffpage" in current_url:
                return True
            # date-back ボタンの存在でシフトページであることを確認
            driver.find_element(By.ID, "date-back")
            return True
        except Exception:
            return False

    def _recover_session(self, driver: webdriver.Chrome,
                          resume_span: tuple) -> Optional[tuple[date, date]]:
        """
        接続エラー後にセッションを再確立して指定スパン付近に移動する。
        成功したら現在のスパンを返す。失敗したら None を返す。
        """
        print("[スクレイパー] セッション回復を試みます...")
        try:
            wait = WebDriverWait(driver, 20)
            self._login(driver)
            self._go_to_shift_page(driver, wait)

            # 再ログイン後の初期スパンを取得
            for _r in range(5):
                span = self._get_current_span(driver)
                if span is not None:
                    break
                time.sleep(2)
            else:
                print("[スクレイパー] セッション回復後もスパン取得できず")
                return None

            print(f"[スクレイパー] 回復後初期スパン: {span[0]} 〜 {span[1]}")

            # resume_span の近くまで移動（前進のみ）
            # resume_span が初期より前なら戻れないので初期から開始
            if span[0] > resume_span[0]:
                print(f"[スクレイパー] 回復後スパン {span[0]} > resume {resume_span[0]}。初期スパンから開始")
            return span
        except Exception as e:
            print(f"[スクレイパー] セッション回復失敗: {e}")
            return None

    def get_shifts_for_months(self,
                              month_list: list[tuple[int, int]],
                              date_from: Optional[date] = None,
                              date_to: Optional[date] = None) -> list[ShiftEntry]:
        """
        複数月のシフトをまとめて取得する（ブラウザを1回だけ起動して効率化）。
        month_list: [(year, month), ...]
        date_from/date_to: この範囲外のシフトはスキップ
        """
        if not month_list:
            return []

        # 最小・最大の年月から期間を特定してスパン移動で全取得する
        from calendar import monthrange
        sorted_months = sorted(month_list)
        first_y, first_m = sorted_months[0]
        last_y,  last_m  = sorted_months[-1]
        min_date = date(first_y, first_m, 1)
        max_date = date(last_y, last_m, monthrange(last_y, last_m)[1])  # 月末日

        all_shifts: list[ShiftEntry] = []
        driver = self._create_driver()
        try:
            wait = WebDriverWait(driver, 15)
            self._login(driver)
            self._go_to_shift_page(driver, wait)

            # 初期位置まで移動
            current_span = self._get_current_span(driver)

            # リトライ: 読み込みタイミングの問題で None の場合は少し待つ
            for _retry in range(5):
                if current_span is not None:
                    break
                print(f"[スクレイパー] スパン取得失敗。リトライ {_retry+1}/5...")
                time.sleep(2)
                current_span = self._get_current_span(driver)

            if current_span is None:
                print("[スクレイパー] スパンを取得できませんでした。スクレイピングを中断します")
                raise RuntimeError("シフトページのスパン情報を取得できませんでした。--visible で確認してください")

            print(f"[スクレイパー] 初期スパン: {current_span[0]} 〜 {current_span[1]}")

            # ─── 過去へ遡る（min_date まで date-back）───
            if current_span:
                while current_span[0] > min_date:
                    # ページ生存確認
                    if not self._is_page_alive(driver):
                        print("[スクレイパー] ページがエラー状態。セッション回復を試みます")
                        recovered = self._recover_session(driver, current_span)
                        if recovered is None:
                            print("[スクレイパー] 回復失敗。現在スパンから前進開始します")
                            break
                        current_span = recovered
                        # 回復後は前進フェーズへ移行（過去には戻らない）
                        break

                    new_span = self._click_nav_and_wait(driver, "date-back", current_span)

                    # ページが死んでいる場合は回復を試みる
                    if new_span is None and not self._is_page_alive(driver):
                        print("[スクレイパー] date-back 後にページ切断。セッション回復を試みます")
                        recovered = self._recover_session(driver, current_span)
                        if recovered is not None:
                            current_span = recovered
                        break

                    if new_span is None:
                        print(f"[スクレイパー] date-back 後にスパン取得失敗。{current_span[0]} から開始します")
                        break
                    # スパンが変化しなければボタンが無効（これ以上戻れない）
                    if new_span[0] >= current_span[0]:
                        print(f"[スクレイパー] date-back ボタンが無効（上限到達）。{current_span[0]} から開始します")
                        break
                    current_span = new_span
                    print(f"[スクレイパー] 戻り先スパン: {current_span[0]} 〜 {current_span[1]}")
                    # サーバー負荷軽減のため待機（3秒）
                    time.sleep(3)

            # ─── 範囲内を順番にめくる（date-next）───
            while current_span and current_span[0] <= max_date:
                # ページ生存確認
                if not self._is_page_alive(driver):
                    print("[スクレイパー] ページがエラー状態（前進中）。セッション回復を試みます")
                    recovered = self._recover_session(driver, current_span)
                    if recovered is None:
                        print("[スクレイパー] 回復失敗。取得を中断します")
                        break
                    # 回復後スパンが current_span より先なら current_span を更新
                    if recovered[0] > current_span[0]:
                        print(f"[スクレイパー] 回復後スパン {recovered[0]} へスキップ")
                        current_span = recovered
                    # 回復後も前進ナビで current_span 付近まで移動
                    while current_span and recovered[0] > current_span[0]:
                        current_span = recovered  # とりあえず回復後から再開
                        break

                # 現在のスパンのデータを取得
                shifts = self._parse_shifts(driver, current_span[0].year, current_span[0].month,
                                            date_from=date_from, date_to=date_to)
                all_shifts.extend(shifts)
                print(f"[スクレイパー] {current_span[0]} 〜 {current_span[1]} を解析: {len(shifts)}件")

                # 次のスパンへ
                new_span = self._click_nav_and_wait(driver, "date-next", current_span)

                if new_span is None and not self._is_page_alive(driver):
                    print("[スクレイパー] date-next 後にページ切断。セッション回復を試みます")
                    recovered = self._recover_session(driver, current_span)
                    if recovered is None:
                        print("[スクレイパー] 回復失敗。取得を中断します")
                        break
                    new_span = recovered

                if new_span is None:
                    print("[スクレイパー] date-next 後にスパン取得失敗。取得完了とみなします")
                    break
                current_span = new_span
                print(f"[スクレイパー] 次スパン: {current_span[0]} 〜 {current_span[1]}")
        finally:
            driver.quit()

        # 重複除去・ソート
        seen = set()
        unique: list[ShiftEntry] = []
        for s in all_shifts:
            key = (s.date, s.start_time, s.end_time)
            if key not in seen:
                seen.add(key)
                unique.append(s)

        unique.sort(key=lambda s: (s.date, s.start_time))
        print(f"[スクレイパー] 合計 {len(unique)} 件のシフトを取得しました")
        return unique

    def _click_nav_and_wait(self, driver: webdriver.Chrome,
                             btn_id: str,
                             old_span: tuple) -> Optional[tuple[date, date]]:
        """
        ナビゲーションボタン (date-back / date-next) をクリックし、
        ページ遷移が完了して新しいスパンが読み込まれるまで待つ。

        eccube.setModeAndSubmit を使ったフォームサブミット（フルページ遷移）のため、
        遷移中の例外はスキップして最大60秒ポーリングする。

        old_span の開始日と異なるスパンが取得できたら返す。
        タイムアウト (60秒) した場合は None を返す。
        """
        old_start_str = old_span[0].strftime("%Y%m%d") if old_span else None

        try:
            btn = driver.find_element(By.ID, btn_id)
            # JavaScript クリックを優先（jQuery イベントハンドラを発火させる）
            try:
                driver.execute_script("arguments[0].click();", btn)
            except Exception:
                btn.click()
        except NoSuchElementException:
            print(f"[スクレイパー] ボタン #{btn_id} が見つかりません")
            return None
        except TimeoutException:
            # フォームサブミットによるページ遷移のタイムアウト → 続行
            print(f"[スクレイパー] ボタン #{btn_id} クリック中にページロードタイムアウト（ポーリング継続）")
        except Exception as e:
            print(f"[スクレイパー] ボタン #{btn_id} クリック中にエラー: {e}")
            return None

        # フォームサブミット後のページ遷移が始まるまで少し待つ
        time.sleep(3)

        # 最大60秒、1秒ごとにポーリング
        # ページ遷移中の例外 (StaleElementReferenceException 等) はスキップして継続
        for attempt in range(60):
            try:
                span = self._get_current_span(driver)
                if span and (old_start_str is None or
                             span[0].strftime("%Y%m%d") != old_start_str):
                    print(f"[スクレイパー] {attempt+1}秒後にスパン更新を確認")
                    return span
            except Exception:
                # ページ遷移中は例外が発生しうるのでスキップ
                pass
            time.sleep(1)

        # タイムアウト: 最後の試みを返す
        print(f"[スクレイパー] ボタン #{btn_id} 後のスパン更新が60秒以内に確認できませんでした")
        try:
            return self._get_current_span(driver)
        except Exception:
            return None

    def _scrape(self, driver: webdriver.Chrome, year: int, month: int,
                date_from: Optional[date] = None,
                date_to: Optional[date] = None) -> list[ShiftEntry]:
        """ログイン〜シフト取得の一連の処理（単月用）"""
        wait = WebDriverWait(driver, 15)
        self._login(driver)
        self._go_to_shift_page(driver, wait)
        self._navigate_to_month(driver, wait, year, month)
        return self._parse_shifts(driver, year, month, date_from=date_from, date_to=date_to)

    def _login(self, driver: webdriver.Chrome):
        """ログインページへのアクセスとログイン処理"""
        print("[スクレイパー] ログインページにアクセス中...")

        # タイムアウトに備えてリトライ
        last_exc = None
        for attempt in range(3):
            try:
                driver.get(SHIFUCON_BASE_URL)
                last_exc = None
                break
            except Exception as e:
                last_exc = e
                print(f"[スクレイパー] ページ読み込み失敗（{attempt+1}/3）: {e}")
                if attempt < 2:
                    print("[スクレイパー] 5秒後にリトライします...")
                    time.sleep(5)
        if last_exc:
            raise last_exc

        time.sleep(3)

        inputs = driver.find_elements(By.TAG_NAME, "input")
        print(f"[スクレイパー] 入力フィールド ({len(inputs)}件):")
        for inp in inputs:
            print(f"  - name={inp.get_attribute('name')!r}  "
                  f"type={inp.get_attribute('type')!r}  "
                  f"placeholder={inp.get_attribute('placeholder')!r}")

        id_field = self._find_id_field(driver)
        pw_field = self._find_password_field(driver)

        if not id_field or not pw_field:
            driver.save_screenshot("debug_login.png")
            raise RuntimeError(
                "ログインフォームのフィールドが見つかりません。"
                "debug_login.png を確認してください。"
            )

        id_field.clear()
        id_field.send_keys(SHIFUCON_STAFF_ID)
        pw_field.clear()
        pw_field.send_keys(SHIFUCON_PASSWORD)

        submit = self._find_submit_button(driver)
        if submit:
            submit.click()
        else:
            pw_field.submit()

        time.sleep(3)

        current_url = driver.current_url
        print(f"[スクレイパー] ログイン後URL: {current_url}")
        if "ログイン" in driver.title and "staffpage" in current_url:
            driver.save_screenshot("debug_after_login.png")
            raise RuntimeError(
                "ログインに失敗しました。IDまたはパスワードを確認してください。\n"
                "スクリーンショット: debug_after_login.png"
            )
        print("[スクレイパー] ログイン成功！")

    def _find_id_field(self, driver: webdriver.Chrome):
        """IDフィールドを見つける"""
        selectors = [
            (By.NAME, "login_id"),
            (By.NAME, "staff_id"),
            (By.NAME, "id"),
            (By.ID, "login_id"),
            (By.ID, "staff_id"),
            (By.CSS_SELECTOR, "input[placeholder*='ID']"),
            (By.CSS_SELECTOR, "input[placeholder*='id']"),
            (By.CSS_SELECTOR, "input[name*='id']:not([type='hidden'])"),
            (By.CSS_SELECTOR, "input[type='text']"),
        ]
        for by, sel in selectors:
            try:
                el = driver.find_element(by, sel)
                print(f"[スクレイパー] IDフィールド発見: {by}={sel!r}")
                return el
            except NoSuchElementException:
                continue
        return None

    def _find_password_field(self, driver: webdriver.Chrome):
        """パスワードフィールドを見つける"""
        selectors = [
            (By.CSS_SELECTOR, "input[type='password']"),
            (By.NAME, "password"),
            (By.NAME, "pass"),
            (By.NAME, "passwd"),
            (By.CSS_SELECTOR, "input[name*='pass']"),
        ]
        for by, sel in selectors:
            try:
                el = driver.find_element(by, sel)
                print(f"[スクレイパー] パスワードフィールド発見: {by}={sel!r}")
                return el
            except NoSuchElementException:
                continue
        return None

    def _find_submit_button(self, driver: webdriver.Chrome):
        """ログインボタンを見つける"""
        selectors = [
            (By.CSS_SELECTOR, "input[type='submit']"),
            (By.CSS_SELECTOR, "button[type='submit']"),
            (By.XPATH, "//button[contains(text(),'ログイン')]"),
            (By.XPATH, "//input[@value='ログイン']"),
            (By.XPATH, "//button[contains(text(),'login')]"),
        ]
        for by, sel in selectors:
            try:
                return driver.find_element(by, sel)
            except NoSuchElementException:
                continue
        return None

    def _go_to_shift_page(self, driver: webdriver.Chrome, wait: WebDriverWait):
        """シフト表ページへ遷移する"""
        shift_selectors = [
            (By.XPATH, "//a[contains(text(),'シフト')]"),
            (By.XPATH, "//a[contains(text(),'スケジュール')]"),
            (By.XPATH, "//a[contains(@href,'shift')]"),
            (By.XPATH, "//a[contains(@href,'schedule')]"),
            (By.CSS_SELECTOR, "a.shift-link"),
            (By.CSS_SELECTOR, "nav a"),
        ]

        for by, sel in shift_selectors:
            try:
                link = driver.find_element(by, sel)
                href = link.get_attribute("href")
                print(f"[スクレイパー] シフトリンク発見: {href}")
                link.click()
                # date-back ボタンが表示されるまで待機（シフトページの目印）
                try:
                    wait.until(EC.presence_of_element_located((By.ID, "date-back")))
                    print("[スクレイパー] シフトページ読み込み完了")
                except TimeoutException:
                    time.sleep(2)
                return
            except NoSuchElementException:
                continue

        print("[スクレイパー] シフトリンクが見つかりません。現在のページで続行します")

    def _navigate_to_month(self, driver: webdriver.Chrome, wait: WebDriverWait,
                           target_year: int, target_month: int):
        """
        指定月のシフト表に移動する。

        シフコンは「2週間スパン」単位で表示される（例: 2026/05/24〜06/06）。
        ナビゲーションボタン: id="date-back"（前） / id="date-next"（次）
        目標月の1日がスパン内に含まれるまで移動する。
        """
        target_first = date(target_year, target_month, 1)

        for attempt in range(30):
            span = self._get_current_span(driver)
            if span is None:
                print("[スクレイパー] 現在の表示期間を特定できませんでした。現在ページで続行します")
                break

            span_start, span_end = span
            print(f"[スクレイパー] 現在スパン: {span_start} 〜 {span_end} （目標月: {target_year}/{target_month:02d}）")

            # 目標月の任意の日がスパン内に含まれていれば OK
            # （スパン開始が目標月以前 かつ スパン終了が目標月以降）
            if span_start.year == target_year and span_start.month == target_month:
                print(f"[スクレイパー] {target_year}年{target_month}月のスパンに到達しました")
                break
            if span_end.year == target_year and span_end.month == target_month:
                print(f"[スクレイパー] {target_year}年{target_month}月のスパンに到達しました")
                break
            # スパンが目標月をまたいでいる場合
            if span_start <= target_first <= span_end:
                print(f"[スクレイパー] {target_year}年{target_month}月のスパンに到達しました")
                break

            go_forward = target_first > span_end
            btn_id = "date-next" if go_forward else "date-back"

            try:
                btn = driver.find_element(By.ID, btn_id)
                btn.click()
                time.sleep(1)
            except NoSuchElementException:
                print(f"[スクレイパー] ナビゲーションボタン #{btn_id} が見つかりません（{attempt+1}回目）")
                break

        else:
            print("[スクレイパー] 月のナビゲーション上限に達しました")

    def _get_current_span(self, driver: webdriver.Chrome) -> Optional[tuple[date, date]]:
        """
        現在表示中の期間（スパン）の開始日・終了日を返す。

        優先順位:
        1. target_date_from / target_date_to 隠しinput（最も確実）
        2. .staffpage-index-date-from-to .text のテキスト
        3. ページソースから正規表現で抽出（フォールバック）

        レンダラータイムアウトなど気期ない例外が発生した場合は None を返す。
        """
        # ─── 1. 隠しinput target_date_from / target_date_to （YYYYMMDD形式） ───
        try:
            from_el = driver.find_element(By.ID, "target_date_from")
            to_el   = driver.find_element(By.ID, "target_date_to")
            from_val = from_el.get_attribute("value")  # e.g. "20260524"
            to_val   = to_el.get_attribute("value")    # e.g. "20260606"
            if from_val and to_val and len(from_val) == 8 and len(to_val) == 8:
                start = date(int(from_val[:4]), int(from_val[4:6]), int(from_val[6:8]))
                end   = date(int(to_val[:4]),   int(to_val[4:6]),   int(to_val[6:8]))
                return start, end
        except (NoSuchElementException, ValueError):
            pass
        except Exception:
            # TimeoutException などレンダラーエラー
            return None

        # ─── 2. div.text のテキスト ───
        try:
            text_els = driver.find_elements(By.CSS_SELECTOR,
                                            ".staffpage-index-date-from-to .text")
            for el in text_els:
                t = el.text.strip()
                if not t:
                    # el.text が空の場合は innerHTML を試す
                    t = el.get_attribute("textContent") or ""
                    t = t.strip()
                if t:
                    result = self._parse_span_text(t)
                    if result:
                        return result
        except Exception:
            pass

        # ─── 3. ページソースから正規表現で抽出 ───
        try:
            content = driver.page_source
        except Exception:
            return None

        # YYYYMMDD 形式の target_date_from / target_date_to
        m = re.search(r'name="target_date_from"[^>]*value="(\d{8})"', content)
        m2 = re.search(r'name="target_date_to"[^>]*value="(\d{8})"', content)
        if not m:  # id形式も試す
            m  = re.search(r'id="target_date_from"[^>]*value="(\d{8})"', content)
            m2 = re.search(r'id="target_date_to"[^>]*value="(\d{8})"', content)
        if m and m2:
            try:
                fv, tv = m.group(1), m2.group(1)
                start = date(int(fv[:4]), int(fv[4:6]), int(fv[6:8]))
                end   = date(int(tv[:4]), int(tv[4:6]), int(tv[6:8]))
                return start, end
            except ValueError:
                pass

        # YYYY/MM/DD〜MM/DD パターン
        m3 = re.search(
            r'(\d{4})/(\d{1,2})/(\d{1,2})[^~\u301c\uff5e\d]*(~|\u301c|\uff5e)(\d{1,2})/(\d{1,2})',
            content
        )
        if m3:
            try:
                y = int(m3.group(1))
                start = date(y, int(m3.group(2)), int(m3.group(3)))
                end_m, end_d = int(m3.group(5)), int(m3.group(6))
                end_y = y if end_m >= int(m3.group(2)) else y + 1
                end = date(end_y, end_m, end_d)
                return start, end
            except ValueError:
                pass

        return None

    def _parse_span_text(self, text: str) -> Optional[tuple[date, date]]:
        """"2026/05/24(土)〜06/06(土)" のような文字列をパースして (start, end) を返す"""
        # YYYY/MM/DD...〜MM/DD or YYYY/MM/DD...〜YYYY/MM/DD
        m = re.search(
            r'(\d{4})/(\d{1,2})/(\d{1,2}).*?[~〜](\d{4})/(\d{1,2})/(\d{1,2})',
            text
        )
        if m:
            start = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            end   = date(int(m.group(4)), int(m.group(5)), int(m.group(6)))
            return start, end

        m = re.search(
            r'(\d{4})/(\d{1,2})/(\d{1,2}).*?[~〜](\d{1,2})/(\d{1,2})',
            text
        )
        if m:
            y = int(m.group(1))
            start = date(y, int(m.group(2)), int(m.group(3)))
            end_m, end_d = int(m.group(4)), int(m.group(5))
            end_y = y if end_m >= int(m.group(2)) else y + 1
            end   = date(end_y, end_m, end_d)
            return start, end

        return None

    def _parse_shifts(self, driver: webdriver.Chrome, year: int, month: int,
                      date_from: Optional[date] = None,
                      date_to: Optional[date] = None) -> list[ShiftEntry]:
        """
        シフト表をパースしてShiftEntryリストを返す。
        date_from/date_to を指定するとその範囲内のシフトのみ返す。

        HTMLの構造:
          <button id="staffpage-index-shift{n}"><p>18:00<br>22:00</p></button>
          <input type="hidden" name="select_date{n}" value="20260524">
          <input type="hidden" name="shift_store_code{n}" value="009">
        """
        # デバッグ用にHTMLとスクリーンショットを保存
        with open("debug_shift_page.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        driver.save_screenshot("debug_shift_screen.png")
        print("[スクレイパー] debug_shift_page.html / debug_shift_screen.png に保存しました")

        shifts = []

        # ─── staffpage-index-shift{n} ボタンを全件取得 ───
        shift_buttons = driver.find_elements(
            By.CSS_SELECTOR, "[id^='staffpage-index-shift']"
        )
        print(f"[スクレイパー] staffpage-index-shift ボタン: {len(shift_buttons)} 件")

        for btn in shift_buttons:
            btn_id = btn.get_attribute("id")  # "staffpage-index-shift0"
            if not btn_id:
                continue

            # インデックスを抽出 (例: "staffpage-index-shift0" → "0")
            idx_match = re.search(r'(\d+)$', btn_id)
            if not idx_match:
                continue
            idx = idx_match.group(1)

            # <p> タグ内から開始・終了時刻を取得
            try:
                p_text = btn.find_element(By.TAG_NAME, "p").text.strip()
            except NoSuchElementException:
                continue

            if not p_text:
                continue

            # 時刻を抽出（改行 or スペース区切り）
            times = re.findall(r'\d{1,2}:\d{2}', p_text)
            if len(times) < 2:
                continue

            start_time = times[0]
            end_time   = times[1]

            # 対応する select_date{n} の value を取得（日付 YYYYMMDD）
            try:
                date_input = driver.find_element(By.NAME, f"select_date{idx}")
                date_val = date_input.get_attribute("value")  # "20260524"
            except NoSuchElementException:
                continue

            if not date_val or len(date_val) != 8:
                continue

            try:
                shift_date = date(int(date_val[:4]), int(date_val[4:6]), int(date_val[6:8]))
            except ValueError:
                continue

            # 日付フィルタ
            if date_from and shift_date < date_from:
                continue
            if date_to and shift_date > date_to:
                continue

            # 店舗コードを取得（あれば）
            store_name = "ドン・キホーテ"
            try:
                store_input = driver.find_element(By.NAME, f"shift_store_code{idx}")
                store_code = store_input.get_attribute("value")
                if store_code:
                    store_name = f"ドン・キホーテ (店舗:{store_code})"
            except NoSuchElementException:
                pass

            shifts.append(ShiftEntry(
                date=shift_date,
                start_time=start_time,
                end_time=end_time,
                store_name=store_name,
            ))
            print(f"  [パース] {shift_date} {start_time}〜{end_time} @{store_name}")

        # 重複除去・ソート
        seen = set()
        unique_shifts = []
        for s in shifts:
            key = (s.date, s.start_time, s.end_time)
            if key not in seen:
                seen.add(key)
                unique_shifts.append(s)

        return sorted(unique_shifts, key=lambda s: (s.date, s.start_time))
