using System.Collections;
using Unity.Notifications.iOS;
using UnityEngine;
using ShiftSync.API;

namespace ShiftSync.UI
{
    /// <summary>
    /// iOS ローカル通知の管理 [Unity 6 + com.unity.mobile.notifications 2.4.x 対応]
    /// </summary>
    public class NotificationManager : MonoBehaviour
    {
        public static NotificationManager Instance { get; private set; }

        [Header("通知設定")]
        [SerializeField] private string categoryId = "shift_reminder";

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private IEnumerator Start()
        {
            yield return RequestPermission();
        }

        // ── 通知許可リクエスト ──────────────────────────────────────

        /// <summary>iOS 通知許可をリクエストする</summary>
        public IEnumerator RequestPermission()
        {
            // com.unity.mobile.notifications 2.4.x では using でリソース解放が推奨
            using var req = new AuthorizationRequest(
                AuthorizationOption.Alert |
                AuthorizationOption.Badge |
                AuthorizationOption.Sound,
                registerForRemoteNotifications: true
            );

            while (!req.IsFinished)
                yield return null;

            if (req.Granted)
            {
                Debug.Log("[通知] 許可を取得しました");
                if (!string.IsNullOrEmpty(req.DeviceToken))
                    StartCoroutine(RegisterTokenToBackend(req.DeviceToken));
            }
            else
            {
                Debug.LogWarning($"[通知] 許可が拒否されました: {req.Error}");
            }
        }

        private IEnumerator RegisterTokenToBackend(string token)
        {
            yield return ApiClient.Instance.RegisterFcmToken(
                token,
                SystemInfo.deviceName,
                onSuccess: res => Debug.Log($"[通知] トークン登録成功: {res.message}"),
                onError:   err => Debug.LogWarning($"[通知] トークン登録失敗: {err}")
            );
        }

        // ── ローカル通知スケジュール ────────────────────────────────

        /// <summary>指定日時にローカル通知をスケジュールする</summary>
        public void ScheduleNotification(string title, string body, System.DateTime fireAt)
        {
            var notification = new iOSNotification
            {
                Title              = title,
                Body               = body,
                CategoryIdentifier = categoryId,
                ShowInForeground   = false,
                Trigger = new iOSNotificationCalendarTrigger
                {
                    Year    = fireAt.Year,
                    Month   = fireAt.Month,
                    Day     = fireAt.Day,
                    Hour    = fireAt.Hour,
                    Minute  = fireAt.Minute,
                    Second  = 0,
                    Repeats = false,
                },
            };

            iOSNotificationCenter.ScheduleNotification(notification);
            Debug.Log($"[通知] スケジュール: {title} → {fireAt:MM/dd HH:mm}");
        }

        // ── 全通知再スケジュール ────────────────────────────────────

        /// <summary>APIから設定・シフトを取得し今後の通知を再スケジュールする</summary>
        public void RescheduleNotifications()
        {
            iOSNotificationCenter.RemoveAllScheduledNotifications();
            StartCoroutine(FetchAndSchedule());
        }

        private IEnumerator FetchAndSchedule()
        {
            var now = System.DateTime.Now;

            // 設定取得
            SettingsData settings = null;
            yield return ApiClient.Instance.GetSettings(
                onSuccess: s => settings = s,
                onError:   _ => { }
            );

            if (settings == null || !settings.notify_enabled) yield break;

            // 当月・翌月のシフト取得
            int thisYear  = now.Year;
            int thisMonth = now.Month;
            int nextYear  = thisMonth == 12 ? thisYear + 1 : thisYear;
            int nextMonth = thisMonth == 12 ? 1 : thisMonth + 1;

            ShiftData[] thisMonthShifts = null;
            ShiftData[] nextMonthShifts = null;

            yield return ApiClient.Instance.GetShifts(thisYear, thisMonth,
                onSuccess: s => thisMonthShifts = s, onError: _ => { });
            yield return ApiClient.Instance.GetShifts(nextYear, nextMonth,
                onSuccess: s => nextMonthShifts = s, onError: _ => { });

            int daysBefore = settings.notify_days_before;
            if (!System.TimeSpan.TryParse(settings.notify_time, out var notifyTime))
                notifyTime = System.TimeSpan.FromHours(8);

            void Schedule(ShiftData[] shifts)
            {
                if (shifts == null) return;
                foreach (var shift in shifts)
                {
                    var shiftDate  = shift.GetDate();
                    var notifyDate = shiftDate.AddDays(-daysBefore).Add(notifyTime);
                    if (notifyDate <= now) continue;

                    string title = daysBefore switch
                    {
                        0 => "⏰ 今日のシフトがあります",
                        1 => "🗓 明日シフトがあります",
                        _ => $"📅 {daysBefore}日後にシフトがあります",
                    };
                    string body = $"{shiftDate:MM/dd} {shift.start_time}〜{shift.end_time}";
                    ScheduleNotification(title, body, notifyDate);
                }
            }

            Schedule(thisMonthShifts);
            Schedule(nextMonthShifts);
            Debug.Log("[通知] 再スケジュール完了");
        }
    }
}
