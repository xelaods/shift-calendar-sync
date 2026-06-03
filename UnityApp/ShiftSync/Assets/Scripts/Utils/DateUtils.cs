using System;
using UnityEngine;

namespace ShiftSync.Utils
{
    /// <summary>
    /// 日付関連のユーティリティ
    /// </summary>
    public static class DateUtils
    {
        private static readonly string[] JpWeekDays = { "日", "月", "火", "水", "木", "金", "土" };

        /// <summary>"2026-06-01" → DateTime</summary>
        public static DateTime ParseDate(string dateStr)
        {
            return DateTime.Parse(dateStr);
        }

        /// <summary>DateTime → "2026-06-01"</summary>
        public static string FormatApiDate(DateTime dt)
        {
            return dt.ToString("yyyy-MM-dd");
        }

        /// <summary>DateTime → "6月1日（月）"</summary>
        public static string FormatJapanese(DateTime dt)
        {
            string wd = JpWeekDays[(int)dt.DayOfWeek];
            return $"{dt.Month}月{dt.Day}日（{wd}）";
        }

        /// <summary>DateTime → "06/01（月）"</summary>
        public static string FormatShort(DateTime dt)
        {
            string wd = JpWeekDays[(int)dt.DayOfWeek];
            return $"{dt:MM/dd}（{wd}）";
        }

        /// <summary>"09:00" と "17:00" から勤務時間の文字列を作る → "09:00〜17:00 (8.0h)"</summary>
        public static string FormatShiftTime(string startTime, string endTime)
        {
            float hours = CalcWorkHours(startTime, endTime);
            return $"{startTime}〜{endTime} ({hours:F1}h)";
        }

        /// <summary>勤務時間（時間）を計算する</summary>
        public static float CalcWorkHours(string startTime, string endTime)
        {
            var start = TimeSpan.Parse(startTime);
            var end   = TimeSpan.Parse(endTime);
            if (end <= start) end = end.Add(TimeSpan.FromHours(24));
            return (float)(end - start).TotalHours;
        }

        /// <summary>今月の1日</summary>
        public static DateTime FirstDayOfMonth(int year, int month)
            => new DateTime(year, month, 1);

        /// <summary>今月の最終日</summary>
        public static DateTime LastDayOfMonth(int year, int month)
            => new DateTime(year, month, DateTime.DaysInMonth(year, month));

        /// <summary>指定月の日数</summary>
        public static int DaysInMonth(int year, int month)
            => DateTime.DaysInMonth(year, month);

        /// <summary>指定月の第1週オフセット（0=日曜, 1=月曜, ...）</summary>
        public static int FirstDayOfWeekOffset(int year, int month)
            => (int)FirstDayOfMonth(year, month).DayOfWeek;

        /// <summary>月表示用の文字列 → "2026年6月"</summary>
        public static string FormatYearMonth(int year, int month)
            => $"{year}年{month}月";

        /// <summary>土曜かどうか</summary>
        public static bool IsSaturday(DateTime dt) => dt.DayOfWeek == DayOfWeek.Saturday;

        /// <summary>日曜かどうか</summary>
        public static bool IsSunday(DateTime dt) => dt.DayOfWeek == DayOfWeek.Sunday;
    }
}
