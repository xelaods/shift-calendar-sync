"""
debug_span.py: _get_current_span のデバッグ
保存済みの debug_shift_page.html をローカルで開いてテストする
"""
import re
import glob
import os
import time
from datetime import date
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By

# ChromeDriver パス
wdm_base = os.path.join(os.path.expanduser("~"), ".wdm", "drivers", "chromedriver")
exes = glob.glob(os.path.join(wdm_base, "**", "chromedriver.exe"), recursive=True)
exes.sort(key=os.path.getmtime, reverse=True)
driver_path = exes[0]

options = Options()
options.add_argument("--headless=new")
options.add_argument("--window-size=1280,900")
options.add_experimental_option("excludeSwitches", ["enable-logging"])
service = Service(executable_path=driver_path)
driver = webdriver.Chrome(service=service, options=options)

html_path = os.path.abspath("debug_shift_page.html")
driver.get(f"file:///{html_path}")
time.sleep(1)

print("=== .staffpage-index-date-from-to .text を探す ===")
els = driver.find_elements(By.CSS_SELECTOR, ".staffpage-index-date-from-to .text")
print(f"要素数: {len(els)}")
for el in els:
    t = el.text
    ih = el.get_attribute("innerHTML")
    print(f"  text={t!r}")
    print(f"  innerHTML={ih!r}")

print()
print("=== JavaScript で取得 ===")
js_text = driver.execute_script(
    "var el = document.querySelector('.staffpage-index-date-from-to .text');"
    "return el ? el.textContent : 'NOT FOUND';"
)
print(f"JS textContent: {js_text!r}")

print()
print("=== ページソースから正規表現で抽出 ===")
content = driver.page_source
# date-back 前後 500 文字を確認
m = re.search(r'.{0,200}date-back.{0,200}', content)
if m:
    print(f"date-back 周辺: {m.group()!r}")

# スパン日付パターン
patterns = [
    r'(\d{4})/(\d{1,2})/(\d{1,2})[^~\u301c\uff5e\d]*(~|\u301c|\uff5e)(\d{1,2})/(\d{1,2})',
    r'(\d{4})/(\d{1,2})/(\d{1,2}).{0,10}?(\d{1,2})/(\d{1,2})',
]
for pat in patterns:
    m2 = re.search(pat, content)
    if m2:
        print(f"パターン {pat[:40]!r} → {m2.group()!r}")
        break
else:
    print("パターンなし")

driver.quit()
print("完了")
