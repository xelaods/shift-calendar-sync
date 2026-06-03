// Assets/Editor/DiagnosticTool.cs
// ======================================================
//  ShiftSync — 診断ツール
//  メニュー「Tools → ShiftSync → 🔍 診断（コンパイルチェック）」を実行すると
//  すべてのスクリプトが正しく認識されているか確認し、
//  問題がある場合はその詳細を Console に出力します。
// ======================================================

#if UNITY_EDITOR
using System;
using UnityEditor;
using UnityEditor.Compilation;
using UnityEngine;

namespace ShiftSync.Editor
{
    public static class DiagnosticTool
    {
        [MenuItem("Tools/ShiftSync/🔍 診断（コンパイルチェック）")]
        public static void RunDiagnostic()
        {
            bool allOk = true;
            string report = "=== ShiftSync 診断レポート ===\n\n";

            // ── コンパイルエラー確認 ──────────────────────────────────
            report += "【コンパイルエラー】\n";
            var messages = CompilationPipeline.GetAssemblyDefinitionFilePathFromScriptPath(
                "Assets/Scripts");
            // エラーチェックは EditorUtility.scriptCompilationFailed で確認
            if (EditorUtility.scriptCompilationFailed)
            {
                allOk = false;
                report += "  ❌ コンパイルエラーがあります！\n" +
                          "     Console ウィンドウで赤いエラーを確認してください。\n";
            }
            else
            {
                report += "  ✅ コンパイルエラーなし\n";
            }
            report += "\n";

            // ── 必須スクリプトの型チェック ────────────────────────────
            report += "【必須スクリプト確認】\n";
            CheckType(ref report, ref allOk, "ShiftSync.UI.CalendarDayCell");
            CheckType(ref report, ref allOk, "ShiftSync.UI.CalendarManager");
            CheckType(ref report, ref allOk, "ShiftSync.UI.ShiftEditManager");
            CheckType(ref report, ref allOk, "ShiftSync.UI.StatsManager");
            CheckType(ref report, ref allOk, "ShiftSync.UI.BarChartBar");
            CheckType(ref report, ref allOk, "ShiftSync.UI.SettingsManager");
            CheckType(ref report, ref allOk, "ShiftSync.UI.AutoLoginController");
            CheckType(ref report, ref allOk, "ShiftSync.UI.BottomNavController");
            CheckType(ref report, ref allOk, "ShiftSync.UI.NotificationManager");
            CheckType(ref report, ref allOk, "ShiftSync.API.ApiClient");
            CheckType(ref report, ref allOk, "ShiftSync.API.SecureStorage");
            report += "\n";

            // ── プレハブ存在確認 ──────────────────────────────────────
            report += "【プレハブ確認】\n";
            CheckPrefab(ref report, ref allOk,
                "Assets/Prefabs/CalendarDayCell.prefab",
                "ShiftSync.UI.CalendarDayCell");
            CheckPrefab(ref report, ref allOk,
                "Assets/Prefabs/BarChartBar.prefab",
                "ShiftSync.UI.BarChartBar");
            report += "\n";

            // ── シーン確認 ────────────────────────────────────────────
            report += "【シーン確認】\n";
            string[] scenes = { "Login", "Calendar", "ShiftEdit", "Stats", "Settings" };
            foreach (var s in scenes)
            {
                string path = $"Assets/Scenes/{s}.unity";
                bool exists = System.IO.File.Exists(path);
                report += $"  {(exists ? "✅" : "❌")} {path}\n";
                if (!exists) allOk = false;
            }
            report += "\n";

            // ── 結果 ─────────────────────────────────────────────────
            report += allOk
                ? "✅ すべてのチェックが通りました！\n"
                : "❌ 問題が検出されました。上記の ❌ 箇所を修正してください。\n";

            Debug.Log(report);

            EditorUtility.DisplayDialog(
                "ShiftSync 診断結果",
                allOk
                    ? "✅ すべてのチェックが通りました！\n\nConsole に詳細レポートが出力されています。"
                    : "❌ 問題が検出されました。\n\n" +
                      "Console ウィンドウを確認してください（赤いエラーログ）。\n\n" +
                      "よくある原因:\n" +
                      "  1. スクリプトのコンパイルエラー\n" +
                      "  2. TMP Essential Resources 未インポート\n" +
                      "     → Window > TextMeshPro > Import TMP Essential Resources",
                "OK");
        }

        static void CheckType(ref string report, ref bool allOk, string typeName)
        {
            var type = Type.GetType($"{typeName}, Assembly-CSharp");
            bool found = type != null;
            if (!found) allOk = false;
            report += $"  {(found ? "✅" : "❌")} {typeName}\n";
        }

        static void CheckPrefab(ref string report, ref bool allOk,
            string prefabPath, string componentType)
        {
            var go = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
            if (go == null)
            {
                report += $"  ❌ {prefabPath} — 存在しない（② Build Prefabs を実行してください）\n";
                allOk = false;
                return;
            }

            var type = Type.GetType($"{componentType}, Assembly-CSharp");
            if (type != null)
            {
                var comp = go.GetComponent(type);
                if (comp != null)
                    report += $"  ✅ {prefabPath} — コンポーネント あり\n";
                else
                {
                    report += $"  ❌ {prefabPath} — コンポーネント なし\n";
                    allOk = false;
                }
            }
            else
            {
                report += $"  ⚠ {prefabPath} — 型未解決（コンパイルエラーの可能性）\n";
                allOk = false;
            }
        }
    }
}
#endif
