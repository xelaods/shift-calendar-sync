using System;
using UnityEngine;
using UnityEngine.SceneManagement;
using ShiftSync.API;

namespace ShiftSync.UI
{
    /// <summary>
    /// シーン間遷移ユーティリティ
    /// シーン名は Build Settings に登録すること
    /// </summary>
    public static class SceneTransition
    {
        // シーン名定数
        public const string SCENE_LOGIN    = "Login";
        public const string SCENE_CALENDAR = "Calendar";
        public const string SCENE_EDIT     = "ShiftEdit";
        public const string SCENE_STATS    = "Stats";
        public const string SCENE_SETTINGS = "Settings";

        // シフト編集に渡すデータ（シーン間のデータ受け渡し用）
        public static ShiftData PendingEditShift { get; private set; }
        public static DateTime  PendingAddDate   { get; private set; }
        public static bool      IsAddMode        { get; private set; }

        public static void GoToCalendar()
            => SceneManager.LoadScene(SCENE_CALENDAR);

        public static void GoToStats()
            => SceneManager.LoadScene(SCENE_STATS);

        public static void GoToSettings()
            => SceneManager.LoadScene(SCENE_SETTINGS);

        public static void GoToLogin()
            => SceneManager.LoadScene(SCENE_LOGIN);

        public static void OpenAddShift(DateTime date)
        {
            IsAddMode      = true;
            PendingAddDate = date;
            PendingEditShift = null;
            SceneManager.LoadScene(SCENE_EDIT);
        }

        public static void OpenEditShift(ShiftData shift)
        {
            IsAddMode        = false;
            PendingEditShift = shift;
            SceneManager.LoadScene(SCENE_EDIT);
        }
    }
}
