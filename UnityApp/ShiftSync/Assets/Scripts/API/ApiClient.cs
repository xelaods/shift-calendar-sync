using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using Newtonsoft.Json;

namespace ShiftSync.API
{
    /// <summary>
    /// FastAPI バックエンドへの HTTP 通信クライアント
    /// [Unity 6 (6000.x) 対応版]
    ///
    /// Unity 6 変更点:
    ///   - UnityWebRequest は IDisposable を実装済み（using var で自動破棄）
    ///   - Awake() での DontDestroyOnLoad は引き続き有効
    /// </summary>
    public class ApiClient : MonoBehaviour
    {
        public static ApiClient Instance { get; private set; }

        [Header("API設定")]
        [Tooltip("バックエンドAPIのベースURL（例: https://shiftsync-api.onrender.com）")]
        public string BaseUrl = "http://localhost:8000";

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            var saved = SecureStorage.ApiBaseUrl;
            if (!string.IsNullOrEmpty(saved))
                BaseUrl = saved;
        }

        // ── シフト CRUD ─────────────────────────────────────────────

        public IEnumerator GetShifts(int year, int month,
            Action<ShiftData[]> onSuccess, Action<string> onError)
            => Get<ShiftData[]>($"{BaseUrl}/shifts/{year}/{month}", onSuccess, onError);

        public IEnumerator CreateShift(ShiftCreateRequest body,
            Action<ShiftData> onSuccess, Action<string> onError)
            => Post<ShiftData>($"{BaseUrl}/shifts", body, onSuccess, onError);

        public IEnumerator UpdateShift(int id, ShiftUpdateRequest body,
            Action<ShiftData> onSuccess, Action<string> onError)
            => Put<ShiftData>($"{BaseUrl}/shifts/{id}", body, onSuccess, onError);

        public IEnumerator DeleteShift(int id,
            Action onSuccess, Action<string> onError)
            => Delete($"{BaseUrl}/shifts/{id}", onSuccess, onError);

        // ── 同期 ────────────────────────────────────────────────────

        public IEnumerator SyncShifts(int year, int month, bool syncToGcal,
            Action<SyncResponse> onSuccess, Action<string> onError)
        {
            var body = new SyncRequest { year = year, month = month, sync_to_gcal = syncToGcal };
            yield return Post<SyncResponse>($"{BaseUrl}/shifts/sync/blocking", body, onSuccess, onError);
        }

        // ── 統計 ────────────────────────────────────────────────────

        public IEnumerator GetMonthlyStats(int year, int month,
            Action<MonthlyStats> onSuccess, Action<string> onError)
            => Get<MonthlyStats>($"{BaseUrl}/stats/{year}/{month}", onSuccess, onError);

        // ── 設定 ────────────────────────────────────────────────────

        public IEnumerator GetSettings(
            Action<SettingsData> onSuccess, Action<string> onError)
            => Get<SettingsData>($"{BaseUrl}/settings", onSuccess, onError);

        public IEnumerator UpdateSettings(SettingsUpdateRequest body,
            Action<SettingsData> onSuccess, Action<string> onError)
            => Put<SettingsData>($"{BaseUrl}/settings", body, onSuccess, onError);

        // ── 通知トークン登録 ────────────────────────────────────────

        public IEnumerator RegisterFcmToken(string token, string deviceName,
            Action<FcmTokenResponse> onSuccess, Action<string> onError)
        {
            var body = new FcmTokenRegisterRequest { token = token, device_name = deviceName };
            yield return Post<FcmTokenResponse>($"{BaseUrl}/notifications/register", body, onSuccess, onError);
        }

        // ── 内部汎用メソッド ─────────────────────────────────────────

        private IEnumerator Get<T>(string url,
            Action<T> onSuccess, Action<string> onError)
        {
            // Unity 6: using var で自動 Dispose
            using var req = UnityWebRequest.Get(url);
            req.SetRequestHeader("Accept", "application/json");
            yield return req.SendWebRequest();
            HandleResponse(req, onSuccess, onError);
        }

        private IEnumerator Post<T>(string url, object body,
            Action<T> onSuccess, Action<string> onError)
        {
            var payload = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(body));
            using var req = new UnityWebRequest(url, "POST")
            {
                uploadHandler   = new UploadHandlerRaw(payload),
                downloadHandler = new DownloadHandlerBuffer(),
            };
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Accept", "application/json");
            yield return req.SendWebRequest();
            HandleResponse(req, onSuccess, onError);
        }

        private IEnumerator Put<T>(string url, object body,
            Action<T> onSuccess, Action<string> onError)
        {
            var payload = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(body));
            using var req = new UnityWebRequest(url, "PUT")
            {
                uploadHandler   = new UploadHandlerRaw(payload),
                downloadHandler = new DownloadHandlerBuffer(),
            };
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Accept", "application/json");
            yield return req.SendWebRequest();
            HandleResponse(req, onSuccess, onError);
        }

        private IEnumerator Delete(string url,
            Action onSuccess, Action<string> onError)
        {
            using var req = UnityWebRequest.Delete(url);
            yield return req.SendWebRequest();

            if (req.result == UnityWebRequest.Result.Success ||
                req.responseCode == 204)
                onSuccess?.Invoke();
            else
                onError?.Invoke(req.error ?? req.downloadHandler?.text ?? "Unknown error");
        }

        private void HandleResponse<T>(UnityWebRequest req,
            Action<T> onSuccess, Action<string> onError)
        {
            if (req.result == UnityWebRequest.Result.Success)
            {
                try
                {
                    var data = JsonConvert.DeserializeObject<T>(req.downloadHandler.text);
                    onSuccess?.Invoke(data);
                }
                catch (Exception ex)
                {
                    onError?.Invoke($"JSONパースエラー: {ex.Message}");
                }
            }
            else
            {
                string raw = req.downloadHandler?.text ?? req.error ?? "Unknown error";
                try
                {
                    var err = JsonConvert.DeserializeObject<ApiError>(raw);
                    onError?.Invoke(err?.detail ?? raw);
                }
                catch
                {
                    onError?.Invoke(raw);
                }
            }
        }
    }
}
