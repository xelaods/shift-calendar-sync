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
    /// シフト追加・編集フォーム画面
    /// </summary>
    public class ShiftEditManager : MonoBehaviour
    {
        [Header("フォームUI")]
        [SerializeField] private TextMeshProUGUI titleLabel;      // "シフト追加" or "シフト編集"
        [SerializeField] private TextMeshProUGUI dateLabel;       // 選択中の日付表示
        [SerializeField] private TMP_InputField startTimeInput;   // "09:00"
        [SerializeField] private TMP_InputField endTimeInput;     // "17:00"
        [SerializeField] private TMP_InputField storeNameInput;
        [SerializeField] private TMP_InputField noteInput;

        [Header("日付ピッカー")]
        [SerializeField] private Button prevDayButton;
        [SerializeField] private Button nextDayButton;

        [Header("アクションボタン")]
        [SerializeField] private Button saveButton;
        [SerializeField] private Button cancelButton;

        [Header("ローディング")]
        [SerializeField] private GameObject loadingOverlay;

        [Header("エラー表示")]
        [SerializeField] private TextMeshProUGUI errorLabel;

        // 内部状態
        private DateTime _selectedDate;
        private ShiftData _editTarget; // null なら新規追加モード

        private void Start()
        {
            saveButton.onClick.AddListener(OnSave);
            cancelButton.onClick.AddListener(OnCancel);
            prevDayButton?.onClick.AddListener(() => ChangeDate(-1));
            nextDayButton?.onClick.AddListener(() => ChangeDate(1));
            HideError();
        }

        /// <summary>新規追加モードで初期化</summary>
        public void InitForAdd(DateTime date)
        {
            _editTarget   = null;
            _selectedDate = date;
            titleLabel.text      = "シフト追加";
            startTimeInput.text  = "09:00";
            endTimeInput.text    = "17:00";
            storeNameInput.text  = "ドン・キホーテ";
            noteInput.text       = "";
            RefreshDateLabel();
        }

        /// <summary>編集モードで初期化</summary>
        public void InitForEdit(ShiftData shift)
        {
            _editTarget   = shift;
            _selectedDate = shift.GetDate();
            titleLabel.text      = "シフト編集";
            startTimeInput.text  = shift.start_time;
            endTimeInput.text    = shift.end_time;
            storeNameInput.text  = shift.store_name;
            noteInput.text       = shift.note ?? "";
            RefreshDateLabel();
        }

        private void ChangeDate(int days)
        {
            _selectedDate = _selectedDate.AddDays(days);
            RefreshDateLabel();
        }

        private void RefreshDateLabel()
        {
            dateLabel.text = DateUtils.FormatJapanese(_selectedDate);
        }

        private void OnSave()
        {
            if (!Validate()) return;
            ShowLoading();

            if (_editTarget == null)
                StartCoroutine(CreateShift());
            else
                StartCoroutine(UpdateShift());
        }

        private bool Validate()
        {
            HideError();
            if (!IsValidTime(startTimeInput.text))
            {
                ShowError("開始時刻の形式が正しくありません（例: 09:00）");
                return false;
            }
            if (!IsValidTime(endTimeInput.text))
            {
                ShowError("終了時刻の形式が正しくありません（例: 17:00）");
                return false;
            }
            return true;
        }

        private bool IsValidTime(string t)
        {
            var parts = t.Split(':');
            if (parts.Length != 2) return false;
            if (!int.TryParse(parts[0], out int h) ||
                !int.TryParse(parts[1], out int m)) return false;
            return h >= 0 && h <= 30 && m >= 0 && m < 60;
        }

        private IEnumerator CreateShift()
        {
            var body = new ShiftCreateRequest
            {
                date       = DateUtils.FormatApiDate(_selectedDate),
                start_time = startTimeInput.text.Trim(),
                end_time   = endTimeInput.text.Trim(),
                store_name = storeNameInput.text.Trim(),
                note       = noteInput.text.Trim(),
            };

            yield return ApiClient.Instance.CreateShift(body,
                onSuccess: _ =>
                {
                    HideLoading();
                    GoBackToCalendar();
                },
                onError: err =>
                {
                    HideLoading();
                    ShowError(err);
                }
            );
        }

        private IEnumerator UpdateShift()
        {
            var body = new ShiftUpdateRequest
            {
                date       = DateUtils.FormatApiDate(_selectedDate),
                start_time = startTimeInput.text.Trim(),
                end_time   = endTimeInput.text.Trim(),
                store_name = storeNameInput.text.Trim(),
                note       = noteInput.text.Trim(),
            };

            yield return ApiClient.Instance.UpdateShift(_editTarget.id, body,
                onSuccess: _ =>
                {
                    HideLoading();
                    GoBackToCalendar();
                },
                onError: err =>
                {
                    HideLoading();
                    ShowError(err);
                }
            );
        }

        private void OnCancel() => GoBackToCalendar();

        private void GoBackToCalendar()
        {
            SceneTransition.GoToCalendar();
        }

        private void ShowLoading() => loadingOverlay?.SetActive(true);
        private void HideLoading() => loadingOverlay?.SetActive(false);
        private void ShowError(string msg)
        {
            if (errorLabel)
            {
                errorLabel.text = msg;
                errorLabel.gameObject.SetActive(true);
            }
        }
        private void HideError()
        {
            if (errorLabel) errorLabel.gameObject.SetActive(false);
        }
    }
}
