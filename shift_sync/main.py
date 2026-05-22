"""
シフコン → Google カレンダー 自動同期
エントリーポイント

動作モード:
  - 初回実行: 2026年1月1日〜当日+5日分のシフトをすべて取得・登録
  - 2回目以降: 当日〜5日後のシフトのみ取得・登録
"""
import os
import sys
import argparse
from datetime import datetime, date, timedelta

from scraper import ShifuconScraper
from calendar_sync import GoogleCalendarSync

# 初回実行済みフラグファイル
FLAG_FILE = os.path.join(os.path.dirname(__file__), "first_run_done.flag")

# 初回取得の開始日
FIRST_RUN_START = date(2026, 1, 1)

# 通常実行での取得日数（今日から何日先まで）
NORMAL_RUN_DAYS = 5


def make_month_list(start: date, end: date) -> list[tuple[int, int]]:
    """start〜end の期間にまたがる (year, month) のリストを返す"""
    months = []
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        months.append((y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months


def main():
    parser = argparse.ArgumentParser(
        description="シフコンからシフトを取得してGoogleカレンダーに登録します"
    )
    parser.add_argument(
        "--visible", action="store_true",
        help="ブラウザを表示モードで起動（デバッグ用）"
    )
    parser.add_argument(
        "--reset", action="store_true",
        help="初回実行フラグをリセットして全件再取得する"
    )
    args = parser.parse_args()

    # リセット
    if args.reset and os.path.exists(FLAG_FILE):
        os.remove(FLAG_FILE)
        print("[メイン] 初回実行フラグをリセットしました。全件再取得します。")

    is_first_run = not os.path.exists(FLAG_FILE)
    today = date.today()

    print("=" * 55)
    print("  シフコン → Google カレンダー 同期ツール")
    if is_first_run:
        print(f"  モード: 初回実行（{FIRST_RUN_START} 〜 {today + timedelta(days=NORMAL_RUN_DAYS)}）")
    else:
        print(f"  モード: 通常実行（{today} 〜 {today + timedelta(days=NORMAL_RUN_DAYS)}）")
    print("=" * 55)

    # ─── 1. 取得期間の決定 ───
    if is_first_run:
        date_from = FIRST_RUN_START
        date_to   = today + timedelta(days=NORMAL_RUN_DAYS)
    else:
        date_from = today
        date_to   = today + timedelta(days=NORMAL_RUN_DAYS)

    # 取得対象月リストを作成
    month_list = make_month_list(date_from, date_to)
    print(f"\n対象期間: {date_from} 〜 {date_to}")
    print(f"対象月: {', '.join(f'{y}/{m:02d}' for y, m in month_list)}")

    # ─── 2. シフト取得 ───
    try:
        scraper = ShifuconScraper(headless=not args.visible)

        if len(month_list) == 1:
            y, m = month_list[0]
            shifts = scraper.get_shifts(year=y, month=m,
                                        date_from=date_from, date_to=date_to)
        else:
            shifts = scraper.get_shifts_for_months(month_list,
                                                   date_from=date_from,
                                                   date_to=date_to)
    except RuntimeError as e:
        print(f"\n[エラー] スクレイピング失敗: {e}")
        print("  ヒント: --visible オプションでブラウザを表示して確認してください")
        sys.exit(1)

    if not shifts:
        print("\nシフトが見つかりませんでした。")
        sys.exit(0)

    print(f"\n取得したシフト一覧 ({len(shifts)} 件):")
    for s in shifts:
        print(f"  {s.date} ({_weekday_ja(s.date)})  {s.start_time}〜{s.end_time}  @{s.store_name}")

    # ─── 3. カレンダーに登録 ───
    print("\nGoogle カレンダーに登録中...")
    try:
        sync = GoogleCalendarSync()
        result = sync.sync_shifts(shifts)
    except FileNotFoundError as e:
        print(f"\n[エラー] {e}")
        sys.exit(1)

    # ─── 4. 初回実行フラグを保存 ───
    if is_first_run and result["errors"] == 0:
        with open(FLAG_FILE, "w") as f:
            f.write(datetime.now().isoformat())
        print(f"\n[メイン] 初回実行完了フラグを保存しました: {FLAG_FILE}")
        print("  次回以降は当日から5日分のみ取得します。")

    # ─── 5. 結果表示 ───
    print("\n" + "=" * 55)
    print("  ✅ 完了!")
    print(f"  追加: {result['added']} 件")
    print(f"  スキップ（既登録）: {result['skipped']} 件")
    if result["errors"] > 0:
        print(f"  ⚠️  エラー: {result['errors']} 件")
    print("=" * 55)


def _weekday_ja(d: date) -> str:
    return ["月", "火", "水", "木", "金", "土", "日"][d.weekday()]


if __name__ == "__main__":
    main()
