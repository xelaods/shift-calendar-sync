"""
既存のシフトイベントを全削除するスクリプト
"""
import os, sys
os.chdir(os.path.dirname(__file__))
sys.path.insert(0, os.path.dirname(__file__))

from calendar_sync import GoogleCalendarSync
from config import GOOGLE_CALENDAR_ID, SHIFT_EVENT_TAG

sync = GoogleCalendarSync()

time_min = "2026-01-01T00:00:00Z"
time_max = "2027-01-01T00:00:00Z"

deleted = 0
page_token = None

while True:
    result = sync.service.events().list(
        calendarId=GOOGLE_CALENDAR_ID,
        timeMin=time_min,
        timeMax=time_max,
        singleEvents=True,
        maxResults=250,
        pageToken=page_token,
    ).execute()

    for event in result.get("items", []):
        ext = event.get("extendedProperties", {}).get("private", {})
        if ext.get("source") == SHIFT_EVENT_TAG:
            sync.service.events().delete(
                calendarId=GOOGLE_CALENDAR_ID,
                eventId=event["id"],
            ).execute()
            print(f"  削除: {event.get('summary', '')} ({event['start'].get('dateTime', '')[:10]})")
            deleted += 1

    page_token = result.get("nextPageToken")
    if not page_token:
        break

print(f"\n合計 {deleted} 件のシフトイベントを削除しました")
