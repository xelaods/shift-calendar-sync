using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using ShiftSync.API;

namespace ShiftSync.UI
{
    /// <summary>
    /// カレンダーの1日分のセル
    /// </summary>
    public class CalendarDayCell : MonoBehaviour
    {
        [Header("UI要素")]
        [SerializeField] private TextMeshProUGUI dayLabel;
        [SerializeField] private GameObject shiftDot;        // シフトあり = 丸マーカー
        [SerializeField] private TextMeshProUGUI shiftTimeLabel; // "09:00〜17:00"
        [SerializeField] private Image background;
        [SerializeField] private Button button;

        // カラーパレット（インスペクターで調整可能）
        [Header("カラー")]
        [SerializeField] private Color colorNormal   = new Color(0.15f, 0.15f, 0.2f);
        [SerializeField] private Color colorToday    = new Color(0.2f, 0.5f, 1.0f, 0.3f);
        [SerializeField] private Color colorSunday   = new Color(1.0f, 0.3f, 0.3f, 0.15f);
        [SerializeField] private Color colorSaturday = new Color(0.3f, 0.6f, 1.0f, 0.15f);
        [SerializeField] private Color colorShift    = new Color(0.4f, 0.9f, 0.6f, 0.3f);

        [SerializeField] private Color textColorNormal   = Color.white;
        [SerializeField] private Color textColorSunday   = new Color(1f, 0.5f, 0.5f);
        [SerializeField] private Color textColorSaturday = new Color(0.5f, 0.8f, 1f);
        [SerializeField] private Color textColorToday    = Color.white;

        private Action _onTap;

        private void Awake()
        {
            if (button) button.onClick.AddListener(() => _onTap?.Invoke());
        }

        /// <summary>空のセル（前月・翌月の日付）として設定</summary>
        public void SetEmpty()
        {
            dayLabel.text     = "";
            if (shiftDot)          shiftDot.SetActive(false);
            if (shiftTimeLabel)    shiftTimeLabel.text = "";
            background.color  = Color.clear;
            if (button) button.interactable = false;
        }

        /// <summary>日付とシフト情報でセルを初期化する</summary>
        public void Setup(
            int day,
            bool isToday,
            bool isSunday,
            bool isSaturday,
            List<ShiftData> shifts,
            Action onTap)
        {
            _onTap = onTap;

            dayLabel.text = day.ToString();
            if (button) button.interactable = true;

            bool hasShift = shifts != null && shifts.Count > 0;

            // 背景色
            Color bg = colorNormal;
            if (hasShift)    bg = Color.Lerp(bg, colorShift, 0.8f);
            if (isSunday)    bg = Color.Lerp(bg, colorSunday, 0.5f);
            if (isSaturday)  bg = Color.Lerp(bg, colorSaturday, 0.5f);
            if (isToday)     bg = Color.Lerp(bg, colorToday, 0.7f);
            background.color = bg;

            // 文字色
            Color tc = textColorNormal;
            if (isSunday)   tc = textColorSunday;
            if (isSaturday) tc = textColorSaturday;
            if (isToday)    tc = textColorToday;
            dayLabel.color = tc;

            // シフトマーカー・時刻表示
            if (shiftDot) shiftDot.SetActive(hasShift);
            if (shiftTimeLabel)
            {
                shiftTimeLabel.text = hasShift
                    ? $"{shifts[0].start_time}〜{shifts[0].end_time}"
                    : "";
            }
        }
    }
}
