using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using ShiftSync.API;
using ShiftSync.Utils;

namespace ShiftSync.UI
{
    /// <summary>
    /// カレンダービュー画面のメインマネージャー
    /// 月表示カレンダーを描画し、シフトデータを重ねて表示する
    /// </summary>
    public class CalendarManager : MonoBehaviour
    {
        [Header("ヘッダー")]
        [SerializeField] private TextMeshProUGUI monthLabel;
        [SerializeField] private Button prevMonthButton;
        [SerializeField] private Button nextMonthButton;
        [SerializeField] private Button syncButton;

        [Header("カレンダーグリッド")]
        [SerializeField] private Transform calendarGrid;   // 7×6 の GridLayoutGroup
        [SerializeField] private CalendarDayCell dayCellPrefab;

        [Header("シフト詳細パネル")]
        [SerializeField] private GameObject detailPanel;
        [SerializeField] private TextMeshProUGUI detailDateLabel;
        [SerializeField] private TextMeshProUGUI detailTimeLabel;
        [SerializeField] private TextMeshProUGUI detailStoreLabel;
        [SerializeField] private TextMeshProUGUI detailHoursLabel;
        [SerializeField] private Button editShiftButton;
        [SerializeField] private Button deleteShiftButton;
        [SerializeField] private Button closeDetailButton;

        [Header("ローディング")]
        [SerializeField] private GameObject loadingOverlay;
        [SerializeField] private TextMeshProUGUI loadingLabel;

        [Header("追加ボタン")]
        [SerializeField] private Button addShiftButton;

        // 内部状態
        private int _year;
        private int _month;
        private List<ShiftData> _shifts = new();
        private ShiftData _selectedShift;
        private List<CalendarDayCell> _cells = new();

        private void Start()
        {
            var now = DateTime.Now;
            _year  = now.Year;
            _month = now.Month;

            prevMonthButton.onClick.AddListener(OnPrevMonth);
            nextMonthButton.onClick.AddListener(OnNextMonth);
            syncButton.onClick.AddListener(OnSync);
            closeDetailButton?.onClick.AddListener(() => detailPanel.SetActive(false));
            addShiftButton?.onClick.AddListener(OnAddShift);
            editShiftButton?.onClick.AddListener(OnEditShift);
            deleteShiftButton?.onClick.AddListener(OnDeleteShift);

            LoadMonth(_year, _month);
        }

        // ─── 月ナビゲーション ───

        private void OnPrevMonth()
        {
            _month--;
            if (_month < 1) { _month = 12; _year--; }
            LoadMonth(_year, _month);
        }

        private void OnNextMonth()
        {
            _month++;
            if (_month > 12) { _month = 1; _year++; }
            LoadMonth(_year, _month);
        }

        // ─── データ読み込み ───

        public void LoadMonth(int year, int month)
        {
            _year  = year;
            _month = month;
            monthLabel.text = DateUtils.FormatYearMonth(year, month);
            ShowLoading("シフトを読み込み中...");
            StartCoroutine(ApiClient.Instance.GetShifts(year, month,
                onSuccess: shifts =>
                {
                    _shifts = new List<ShiftData>(shifts ?? Array.Empty<ShiftData>());
                    HideLoading();
                    BuildCalendar();
                },
                onError: err =>
                {
                    HideLoading();
                    Debug.LogWarning($"[Calendar] シフト取得エラー: {err}");
                    BuildCalendar(); // エラーでもカレンダーは表示
                }
            ));
        }

        // ─── カレンダー描画 ───

        private void BuildCalendar()
        {
            // 既存セルをクリア
            foreach (var cell in _cells)
                Destroy(cell.gameObject);
            _cells.Clear();

            int firstOffset  = DateUtils.FirstDayOfWeekOffset(_year, _month);
            int daysInMonth  = DateUtils.DaysInMonth(_year, _month);
            int totalCells   = 42; // 7列×6行

            // シフトを日付でインデックス化
            var shiftByDay = new Dictionary<int, List<ShiftData>>();
            foreach (var s in _shifts)
            {
                int day = s.GetDate().Day;
                if (!shiftByDay.ContainsKey(day))
                    shiftByDay[day] = new List<ShiftData>();
                shiftByDay[day].Add(s);
            }

            var today = DateTime.Today;

            for (int i = 0; i < totalCells; i++)
            {
                int day = i - firstOffset + 1;
                var cell = Instantiate(dayCellPrefab, calendarGrid);
                _cells.Add(cell);

                if (day < 1 || day > daysInMonth)
                {
                    cell.SetEmpty();
                    continue;
                }

                var dt = new DateTime(_year, _month, day);
                bool isToday  = (dt == today);
                bool isHoliday = DateUtils.IsSunday(dt);
                bool isSat     = DateUtils.IsSaturday(dt);

                shiftByDay.TryGetValue(day, out var dayShifts);
                cell.Setup(day, isToday, isHoliday, isSat, dayShifts,
                    onTap: () => OnDayTapped(day, dayShifts));
            }
        }

        // ─── タップ処理 ───

        private void OnDayTapped(int day, List<ShiftData> shifts)
        {
            if (shifts == null || shifts.Count == 0)
            {
                // シフトなし → 追加ダイアログを開く
                OnAddShiftForDay(day);
                return;
            }

            // シフトあり → 詳細を表示
            var shift = shifts[0]; // 複数の場合は最初のシフト
            _selectedShift = shift;
            var dt = shift.GetDate();
            detailDateLabel.text  = DateUtils.FormatJapanese(dt);
            detailTimeLabel.text  = $"{shift.start_time}〜{shift.end_time}";
            detailStoreLabel.text = shift.store_name;
            detailHoursLabel.text = $"勤務: {shift.GetWorkHours():F1}時間";
            detailPanel.SetActive(true);
        }

        // ─── シフト同期 ───

        private void OnSync()
        {
            ShowLoading("シフコンと同期中...\n（数十秒かかります）");
            StartCoroutine(ApiClient.Instance.SyncShifts(_year, _month, syncToGcal: true,
                onSuccess: result =>
                {
                    HideLoading();
                    Debug.Log($"[Calendar] 同期完了: {result.message}");
                    LoadMonth(_year, _month);
                },
                onError: err =>
                {
                    HideLoading();
                    Debug.LogError($"[Calendar] 同期エラー: {err}");
                }
            ));
        }

        // ─── シフト追加・編集・削除 ───

        private void OnAddShift()
        {
            SceneTransition.OpenAddShift(DateTime.Today);
        }

        private void OnAddShiftForDay(int day)
        {
            var dt = new DateTime(_year, _month, day);
            SceneTransition.OpenAddShift(dt);
        }

        private void OnEditShift()
        {
            if (_selectedShift == null) return;
            detailPanel.SetActive(false);
            SceneTransition.OpenEditShift(_selectedShift);
        }

        private void OnDeleteShift()
        {
            if (_selectedShift == null) return;
            detailPanel.SetActive(false);
            ShowLoading("削除中...");
            StartCoroutine(ApiClient.Instance.DeleteShift(_selectedShift.id,
                onSuccess: () =>
                {
                    HideLoading();
                    LoadMonth(_year, _month);
                },
                onError: err =>
                {
                    HideLoading();
                    Debug.LogError($"[Calendar] 削除エラー: {err}");
                }
            ));
        }

        // ─── UI ヘルパー ───

        private void ShowLoading(string message = "読み込み中...")
        {
            if (loadingOverlay) loadingOverlay.SetActive(true);
            if (loadingLabel)   loadingLabel.text = message;
        }

        private void HideLoading()
        {
            if (loadingOverlay) loadingOverlay.SetActive(false);
        }
    }
}
