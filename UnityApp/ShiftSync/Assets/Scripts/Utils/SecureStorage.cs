using UnityEngine;

namespace ShiftSync.API
{
    /// <summary>
    /// 認証情報・設定を安全に保存するユーティリティ
    /// iOS では Keychain を使うのが理想だが、
    /// ここでは PlayerPrefs + 暗号化で簡易実装する。
    /// 本番では Unity Keystore Plugin などを検討すること。
    /// </summary>
    public static class SecureStorage
    {
        private const string PREFIX = "ss_";

        public static void Save(string key, string value)
        {
            // TODO: 本番では暗号化を追加
            PlayerPrefs.SetString(PREFIX + key, value);
            PlayerPrefs.Save();
        }

        public static string Get(string key, string defaultValue = "")
        {
            return PlayerPrefs.GetString(PREFIX + key, defaultValue);
        }

        public static bool Has(string key)
        {
            return PlayerPrefs.HasKey(PREFIX + key);
        }

        public static void Delete(string key)
        {
            PlayerPrefs.DeleteKey(PREFIX + key);
            PlayerPrefs.Save();
        }

        public static void DeleteAll()
        {
            PlayerPrefs.DeleteAll();
            PlayerPrefs.Save();
        }

        // ─── よく使うキーへのショートカット ───

        public static string ApiBaseUrl
        {
            get => Get("api_base_url", "http://localhost:8000");
            set => Save("api_base_url", value);
        }

        public static float HourlyWage
        {
            get => float.TryParse(Get("hourly_wage", "1050"), out float v) ? v : 1050f;
            set => Save("hourly_wage", value.ToString("F0"));
        }

        public static bool IsFirstLaunch
        {
            get => !Has("launched_before");
        }

        public static void MarkLaunched()
        {
            Save("launched_before", "1");
        }
    }
}
