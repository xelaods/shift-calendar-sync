using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using ShiftSync.API;
using ShiftSync.Utils;

namespace ShiftSync.UI
{
    /// <summary>
    /// 統計・グラフ画面のマネージャー
    /// 月収計算・勤務時間集計・棒グラフを表示する
    ///
    /// [設計方針] BarChartBar はプレハブを使わず
    /// BuildBarChart() 内でコードから動的生成する。
    /// これにより prefab アサイン漏れの問題を根本的に回避する。
    /// </summary>
    public class StatsManager : MonoBehaviour
    {
        [Header("ヘッダー")]
        [SerializeField] private TextMeshProUGUI monthLabel;
        [SerializeField] private Button prevMonthButton;
        [SerializeField] private Button nextMonthButton;

        [Header("サマリーカード")]
        [SerializeField] private TextMeshProUGUI totalShiftsLabel;
        [SerializeField] private TextMeshProUGUI totalHoursLabel;
        [SerializeField] private TextMeshProUGUI estimatedIncomeLabel;
        [SerializeField] private TextMeshProUGUI hourlyWageLabel;

        [Header("棒グラフ")]
        [SerializeField] private Transform barChartContainer;
        // barPrefab は不要 — コードで直接生成する

        [Header("棒グラフ外観")]
        [SerializeField] private Color barColor        = new(0.25f, 0.55f, 1.0f, 1f);
        [SerializeField] private Color barLabelColor   = new(0.65f, 0.65f, 0.75f, 1f);
        [SerializeField] private float maxBarHeight    = 180f;
        [SerializeField] private float barWidth        = 16f;

        [Header("ローディング")]
        [SerializeField] private GameObject loadingOverlay;

        private int _year;
        private int _month;

        private void Start()
        {
            var now = DateTime.Now;
            _year  = now.Year;
            _month = now.Month;

            prevMonthButton.onClick.AddListener(OnPrevMonth);
            nextMonthButton.onClick.AddListener(OnNextMonth);

            LoadStats(_year, _month);
        }

        private void OnPrevMonth()
        {
            _month--;
            if (_month < 1) { _month = 12; _year--; }
            LoadStats(_year, _month);
        }

        private void OnNextMonth()
        {
            _month++;
            if (_month > 12) { _month = 1; _year++; }
            LoadStats(_year, _month);
        }

        // ── データ読み込み ──────────────────────────────────────────

        private void LoadStats(int year, int month)
        {
            monthLabel.text = DateUtils.FormatYearMonth(year, month);
            ShowLoading();

            StartCoroutine(ApiClient.Instance.GetMonthlyStats(year, month,
                onSuccess: stats =>
                {
                    HideLoading();
                    ApplyStats(stats);
                },
                onError: err =>
                {
                    HideLoading();
                    Debug.LogWarning($"[Stats] 取得エラー: {err}");
                }
            ));
        }

        // ── 統計適用 ────────────────────────────────────────────────

        private void ApplyStats(MonthlyStats stats)
        {
            totalShiftsLabel.text     = $"{stats.total_shifts}回";
            totalHoursLabel.text      = $"{stats.total_hours:F1}時間";
            estimatedIncomeLabel.text = $"¥{stats.estimated_income:#,0}";
            hourlyWageLabel.text      = $"時給 ¥{stats.hourly_wage:#,0}";

            BuildBarChart(stats);
        }

        // ── 棒グラフ構築（コードで直接生成） ──────────────────────

        private void BuildBarChart(MonthlyStats stats)
        {
            // 既存バーを全削除
            foreach (Transform child in barChartContainer)
                Destroy(child.gameObject);

            if (stats.daily_hours_list == null || stats.daily_hours_list.Length == 0)
                return;

            // 最大時間を求める
            float maxHours = 0f;
            foreach (var entry in stats.daily_hours_list)
                if (entry.hours > maxHours) maxHours = entry.hours;

            if (maxHours <= 0f) return;

            foreach (var entry in stats.daily_hours_list)
            {
                float ratio = Mathf.Clamp01(entry.hours / maxHours);
                var   dt    = DateTime.Parse(entry.date);
                CreateBarGo($"{dt.Day}", ratio, entry.hours);
            }
        }

        /// <summary>
        /// 棒グラフ 1本分の GameObject をコードで生成する。
        /// BarChartBar コンポーネントは付けず、純粋な UI 要素で構成。
        /// </summary>
        private void CreateBarGo(string dayLabel, float fillRatio, float hours)
        {
            // ── ルート（縦並び）────────────────────────────────────
            var barRoot = new GameObject($"Bar_{dayLabel}");
            barRoot.transform.SetParent(barChartContainer, false);

            var vlg = barRoot.AddComponent<VerticalLayoutGroup>();
            vlg.childAlignment       = TextAnchor.LowerCenter;
            vlg.spacing              = 2f;
            vlg.childForceExpandWidth  = true;
            vlg.childForceExpandHeight = false;
            vlg.padding              = new RectOffset(1, 1, 0, 0);

            var le = barRoot.AddComponent<LayoutElement>();
            le.minWidth       = barWidth + 2;
            le.preferredWidth = barWidth + 2;
            le.flexibleWidth  = 1f;

            // ── 時間ラベル（上）──────────────────────────────────
            var hoursGo = new GameObject("HoursLabel");
            hoursGo.transform.SetParent(barRoot.transform, false);
            var hoursLe = hoursGo.AddComponent<LayoutElement>();
            hoursLe.preferredHeight = 16f; hoursLe.flexibleHeight = 0f;
            var hoursTmp = hoursGo.AddComponent<TextMeshProUGUI>();
            hoursTmp.text = hours > 0f ? $"{hours:F1}h" : "";
            hoursTmp.fontSize = 7f;
            hoursTmp.color = barLabelColor;
            hoursTmp.alignment = TextAlignmentOptions.Center;
            hoursTmp.enableWordWrapping = false;

            // ── バー本体──────────────────────────────────────────
            var fillGo = new GameObject("Fill");
            fillGo.transform.SetParent(barRoot.transform, false);
            var fillLe = fillGo.AddComponent<LayoutElement>();
            fillLe.preferredHeight = maxBarHeight * fillRatio;
            fillLe.minHeight       = fillRatio > 0f ? 2f : 0f;
            fillLe.flexibleHeight  = 0f;
            var fillImg = fillGo.AddComponent<Image>();
            fillImg.color = barColor;

            // ── 日付ラベル（下）──────────────────────────────────
            var dayGo = new GameObject("DayLabel");
            dayGo.transform.SetParent(barRoot.transform, false);
            var dayLe = dayGo.AddComponent<LayoutElement>();
            dayLe.preferredHeight = 16f; dayLe.flexibleHeight = 0f;
            var dayTmp = dayGo.AddComponent<TextMeshProUGUI>();
            dayTmp.text = dayLabel;
            dayTmp.fontSize = 8f;
            dayTmp.color = barLabelColor;
            dayTmp.alignment = TextAlignmentOptions.Center;
            dayTmp.enableWordWrapping = false;
        }

        private void ShowLoading() => loadingOverlay?.SetActive(true);
        private void HideLoading() => loadingOverlay?.SetActive(false);
    }
}
