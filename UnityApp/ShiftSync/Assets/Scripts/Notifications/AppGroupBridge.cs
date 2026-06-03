using System.Runtime.InteropServices;
using UnityEngine;
using Newtonsoft.Json;
using ShiftSync.API;

namespace ShiftSync.Notifications
{
    /// <summary>
    /// iOS App Group ブリッジ（スタブ版）
    /// WidgetKit はウィジェットなし版では無効化しています。
    /// App Groups が利用可能な場合（有料 Apple Developer Program）は
    /// WIDGET_ENABLED シンボルを定義して有効化できます。
    /// </summary>
    public static class AppGroupBridge
    {
        /// <summary>
        /// シフトデータをウィジェット用に書き込む（ウィジェットなし版では何もしない）
        /// </summary>
        public static void WriteShifts(ShiftData[] shifts)
        {
#if WIDGET_ENABLED && UNITY_IOS && !UNITY_EDITOR
            if (shifts == null) shifts = new ShiftData[0];

            var widgetItems = new System.Collections.Generic.List<object>();
            foreach (var s in shifts)
            {
                widgetItems.Add(new
                {
                    date      = s.date,
                    startTime = s.start_time,
                    endTime   = s.end_time,
                    storeName = s.store_name,
                });
            }

            string json = JsonConvert.SerializeObject(widgetItems);
            AppGroup_WriteShiftsJson(json);
#else
            // ウィジェットなし版: 何もしない
            Debug.Log($"[AppGroup] ウィジェット無効（{(shifts?.Length ?? 0)}件のデータは送信しません）");
#endif
        }

#if WIDGET_ENABLED && UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void AppGroup_WriteShiftsJson(string json);
#endif
    }
}
