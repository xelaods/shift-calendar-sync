using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using ShiftSync.API;

namespace ShiftSync.UI
{
    /// <summary>
    /// 設定画面のマネージャー
    /// 時給・通知設定・APIサーバーURL などを管理する
    /// </summary>
    public class SettingsManager : MonoBehaviour
    {
        [Header("APIサーバー設定")]
        [SerializeField] private TMP_InputField apiUrlInput;
        [SerializeField] private Button testConnectionButton;
        [SerializeField] private TextMeshProUGUI connectionStatusLabel;

        [Header("時給設定")]
        [SerializeField] private TMP_InputField hourlyWageInput;

        [Header("通知設定")]
        [SerializeField] private Toggle notifyEnabledToggle;
        [SerializeField] private TMP_InputField notifyTimeInput;   // "08:00"
        [SerializeField] private TMP_Dropdown   notifyDaysDropdown; // 当日/前日/2日前

        [Header("アクションボタン")]
        [SerializeField] private Button saveButton;
        [SerializeField] private Button cancelButton;
        [SerializeField] private Button requestNotifPermButton; // iOS通知許可リクエスト

        [Header("ローディング")]
        [SerializeField] private GameObject loadingOverlay;
        [SerializeField] private TextMeshProUGUI errorLabel;

        private void Start()
        {
            saveButton.onClick.AddListener(OnSave);
            cancelButton?.onClick.AddListener(OnCancel);
            testConnectionButton?.onClick.AddListener(OnTestConnection);
            requestNotifPermButton?.onClick.AddListener(OnRequestNotifPermission);

            LoadSettings();
        }

        private void LoadSettings()
        {
            apiUrlInput.text = SecureStorage.ApiBaseUrl;
            ShowLoading();

            StartCoroutine(ApiClient.Instance.GetSettings(
                onSuccess: settings =>
                {
                    HideLoading();
                    ApplySettings(settings);
                },
                onError: err =>
                {
                    HideLoading();
                    // APIに繋がらなくてもローカル設定で動く
                    hourlyWageInput.text = SecureStorage.HourlyWage.ToString("F0");
                    notifyEnabledToggle.isOn = true;
                    notifyTimeInput.text = "08:00";
                }
            ));
        }

        private void ApplySettings(SettingsData settings)
        {
            hourlyWageInput.text      = settings.hourly_wage.ToString("F0");
            notifyEnabledToggle.isOn  = settings.notify_enabled;
            notifyTimeInput.text      = settings.notify_time;
            if (notifyDaysDropdown)
                notifyDaysDropdown.value = settings.notify_days_before; // 0=当日,1=前日,...
        }

        private void OnSave()
        {
            // APIサーバーURLを保存
            var newUrl = apiUrlInput.text.TrimEnd('/');
            SecureStorage.ApiBaseUrl = newUrl;
            ApiClient.Instance.BaseUrl = newUrl;

            if (!float.TryParse(hourlyWageInput.text, out float wage) || wage < 0)
            {
                ShowError("時給を正しく入力してください");
                return;
            }
            SecureStorage.HourlyWage = wage;

            ShowLoading();

            int daysBefore = notifyDaysDropdown ? notifyDaysDropdown.value : 1;

            var body = new SettingsUpdateRequest
            {
                hourly_wage       = wage,
                notify_enabled    = notifyEnabledToggle.isOn,
                notify_time       = notifyTimeInput.text,
                notify_days_before = daysBefore,
            };

            StartCoroutine(ApiClient.Instance.UpdateSettings(body,
                onSuccess: _ =>
                {
                    HideLoading();
                    // 通知スケジュールを更新
                    NotificationManager.Instance?.RescheduleNotifications();
                    SceneTransition.GoToCalendar();
                },
                onError: err =>
                {
                    HideLoading();
                    ShowError($"保存エラー: {err}");
                }
            ));
        }

        private void OnCancel() => SceneTransition.GoToCalendar();

        private void OnTestConnection()
        {
            connectionStatusLabel.text = "接続中...";
            connectionStatusLabel.color = Color.gray;

            StartCoroutine(ApiClient.Instance.GetSettings(
                onSuccess: _ =>
                {
                    connectionStatusLabel.text  = "✓ 接続成功";
                    connectionStatusLabel.color = Color.green;
                },
                onError: err =>
                {
                    connectionStatusLabel.text  = $"✗ 接続失敗: {err}";
                    connectionStatusLabel.color = Color.red;
                }
            ));
        }

        private void OnRequestNotifPermission()
        {
            NotificationManager.Instance?.RequestPermission();
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
    }
}
