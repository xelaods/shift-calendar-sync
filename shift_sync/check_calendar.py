"""
Googleカレンダーのシフトイベント確認スクリプト
"""
import os, sys
os.chdir(os.path.dirname(__file__))
sys.path.insert(0, os.path.dirname(__file__))

from calendar_sync import GoogleCalendarSync
from config import GOOGLE_CALENDAR_ID, SHIFT_EVENT_TAG

sync = GoogleCalendarSync()

# 2026年1月から7月までのイベントを確認
time_min = "2026-01-01T00:00:00Z"
time_max = "2026-07-01T00:00:00Z"

result = sync.service.events().list(
    calendarId=GOOGLE_CALENDAR_ID,
    timeMin=time_min,
    timeMax=time_max,
    singleEvents=True,
    orderBy="startTime",
    maxResults=300,
).execute()

items = result.get("items", [])
shift_events = [
    e for e in items
    if e.get("extendedProperties", {}).get("private", {}).get("source") == SHIFT_EVENT_TAG
]

print(f"カレンダーID: {GOOGLE_CALENDAR_ID}")
print(f"全イベント数（2026/1〜6）: {len(items)}")
print(f"シフトイベント数: {len(shift_events)}")
print()

if shift_events:
    print("登録済みシフト一覧:")
    for e in shift_events:
        start = e["start"].get("dateTime", e["start"].get("date", ""))
        print(f"  {start[:10]}  {e['summary']}")
else:
    print("シフトイベントは0件です（カレンダーIDを確認してください）")

print()
print("--- 非シフトイベント ---")
non_shift = [e for e in items if e not in shift_events]
print(f"非シフトイベント数: {len(non_shift)}")
for e in non_shift[:5]:
    start = e["start"].get("dateTime", e["start"].get("date", ""))
    print(f"  {start[:10]}  {e.get('summary', '(タイトルなし)')}")
