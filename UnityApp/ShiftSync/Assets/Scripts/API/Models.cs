using System;
using System.Collections.Generic;

namespace ShiftSync.API
{
    // ─── シフト ───

    [Serializable]
    public class ShiftData
    {
        public int id;
        public string date;          // "2026-06-01"
        public string start_time;    // "09:00"
        public string end_time;      // "17:00"
        public string store_name;
        public string note;
        public string source;        // "auto" | "manual"
        public bool synced_to_gcal;
        public string gcal_event_id;
        public string created_at;

        /// <summary>date 文字列を DateTime に変換する</summary>
        public DateTime GetDate()
        {
            return DateTime.Parse(date);
        }

        /// <summary>勤務時間（時間）を計算する</summary>
        public float GetWorkHours()
        {
            var start = TimeSpan.Parse(start_time);
            var end   = TimeSpan.Parse(end_time);
            if (end <= start) end = end.Add(TimeSpan.FromHours(24));
            return (float)(end - start).TotalHours;
        }
    }

    [Serializable]
    public class ShiftListResponse
    {
        public ShiftData[] shifts;
    }

    [Serializable]
    public class ShiftCreateRequest
    {
        public string date;
        public string start_time;
        public string end_time;
        public string store_name = "ドン・キホーテ";
        public string note       = "";
    }

    [Serializable]
    public class ShiftUpdateRequest
    {
        public string date;
        public string start_time;
        public string end_time;
        public string store_name;
        public string note;
    }

    // ─── 同期 ───

    [Serializable]
    public class SyncRequest
    {
        public int? year;
        public int? month;
        public bool sync_to_gcal = true;
    }

    [Serializable]
    public class SyncResponse
    {
        public int scraped;
        public int added_to_db;
        public int gcal_added;
        public int gcal_skipped;
        public int gcal_errors;
        public string message;
    }

    // ─── 統計 ───

    [Serializable]
    public class MonthlyStats
    {
        public int year;
        public int month;
        public int total_shifts;
        public float total_hours;
        public float estimated_income;
        public float hourly_wage;
        public string[] shift_dates;
        public DailyHoursEntry[] daily_hours_list; // JSON辞書は別途パース
    }

    [Serializable]
    public class DailyHoursEntry
    {
        public string date;
        public float hours;
    }

    // ─── 設定 ───

    [Serializable]
    public class SettingsData
    {
        public float hourly_wage;
        public bool notify_enabled;
        public string notify_time;
        public int notify_days_before;
    }

    [Serializable]
    public class SettingsUpdateRequest
    {
        public float? hourly_wage;
        public bool?  notify_enabled;
        public string notify_time;
        public int?   notify_days_before;
    }

    // ─── FCM通知 ───

    [Serializable]
    public class FcmTokenRegisterRequest
    {
        public string token;
        public string device_name;
    }

    [Serializable]
    public class FcmTokenResponse
    {
        public bool   success;
        public string message;
    }

    // ─── 汎用エラー ───

    [Serializable]
    public class ApiError
    {
        public string detail;
    }
}
