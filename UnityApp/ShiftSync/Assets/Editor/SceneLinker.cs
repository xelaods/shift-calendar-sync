// Assets/Editor/SceneLinker.cs
// ======================================================
//  ShiftSync — プレハブ参照リンクツール  [Unity 6 対応版 v2]
//
//  修正点:
//    LoadAssetAtPath<CalendarDayCell>()  ← コンポーネント型では null になる
//    → LoadAssetAtPath<GameObject>() + GetComponent<>() に変更
// ======================================================

#if UNITY_EDITOR
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace ShiftSync.Editor
{
    public static class SceneLinker
    {
        const string SCENES_PATH  = "Assets/Scenes";
        const string PREFABS_PATH = "Assets/Prefabs";

        // ─────────────────────────────────────────────────────────────
        //  ③ プレハブをシーンにアサイン
        // ─────────────────────────────────────────────────────────────

        [MenuItem("Tools/ShiftSync/③ Link Prefabs to Scenes")]
        public static void LinkPrefabsToScenes()
        {
            // BarChartBar はプレハブ不要（StatsManager がコードで動的生成するため）
            // CalendarDayCell のみプレハブが必要

            // ── CalendarDayCell プレハブ読み込み ──────────────────────
            var dayCellGo = AssetDatabase.LoadAssetAtPath<GameObject>(
                $"{PREFABS_PATH}/CalendarDayCell.prefab");

            if (dayCellGo == null)
            {
                EditorUtility.DisplayDialog("エラー — プレハブが見つかりません",
                    $"CalendarDayCell.prefab が {PREFABS_PATH}/ に存在しません。\n\n" +
                    "先に「② Build Prefabs」を実行してください。",
                    "OK");
                return;
            }

            var dayCellPrefab = dayCellGo.GetComponent<ShiftSync.UI.CalendarDayCell>();
            if (dayCellPrefab == null)
            {
                EditorUtility.DisplayDialog("エラー — コンポーネントが見つかりません",
                    "CalendarDayCell.prefab に CalendarDayCell コンポーネントが付いていません。\n" +
                    "「② Build Prefabs」をもう一度実行してください。",
                    "OK");
                return;
            }

            int linkedCount = 0;

            // ── Calendar シーン（CalendarDayCell プレハブをアサイン） ──
            linkedCount += LinkScene<ShiftSync.UI.CalendarManager>(
                $"{SCENES_PATH}/Calendar.unity",
                mgr => Sf(mgr, "dayCellPrefab", dayCellPrefab),
                "CalendarManager.dayCellPrefab");

            // ── Stats シーン（barPrefab は不要 — コード生成のため） ────
            // StatsManager は barChartContainer に動的にバーを生成するため
            // プレハブのアサインは不要。リンクステップはスキップ。

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            EditorUtility.DisplayDialog(
                "ShiftSync Scene Linker",
                $"✅ アサイン完了！（{linkedCount} 件のコンポーネントに設定しました）\n\n" +
                "準備が整いました。\n\n" +
                "次のステップ:\n" +
                "  File → Build Settings\n" +
                "  → Switch Platform → iOS\n" +
                "  → Build ボタンでビルド開始",
                "OK");
        }

        // ─────────────────────────────────────────────────────────────
        //  ④（隠し） 全工程を一気に実行するユーティリティ
        // ─────────────────────────────────────────────────────────────

        [MenuItem("Tools/ShiftSync/🔧 Run All (①②③ まとめて実行)")]
        public static void RunAll()
        {
            if (!EditorUtility.DisplayDialog(
                    "ShiftSync — 全工程実行",
                    "以下の順番で全工程を実行します:\n\n" +
                    "  ① Build All Scenes\n" +
                    "  ② Build Prefabs\n" +
                    "  ③ Link Prefabs to Scenes\n\n" +
                    "既存のシーン・プレハブは上書きされます。",
                    "実行する", "キャンセル"))
                return;

            // ① シーン生成
            SceneBuilder.BuildAllScenes();

            // AssetDatabase を同期してからプレハブ生成へ
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            // ② プレハブ生成
            PrefabBuilder.BuildPrefabs();

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            // ③ プレハブをシーンにアサイン
            LinkPrefabsToScenes();
        }

        // ─────────────────────────────────────────────────────────────
        //  共通ヘルパー
        // ─────────────────────────────────────────────────────────────

        /// <summary>
        /// 指定シーンを開き、見つかった全 T コンポーネントに <paramref name="assign"/> を適用して保存する。
        /// </summary>
        static int LinkScene<T>(string scenePath,
            System.Action<T> assign, string fieldDesc) where T : Object
        {
            if (!File.Exists(scenePath))
            {
                Debug.LogWarning($"[SceneLinker] シーンが見つかりません: {scenePath}");
                return 0;
            }

            var scene = EditorSceneManager.OpenScene(scenePath, OpenSceneMode.Single);

            // Unity 6: FindObjectsByType<T>(FindObjectsSortMode)
            var components = Object.FindObjectsByType<T>(FindObjectsSortMode.None);
            int count = 0;
            foreach (var c in components)
            {
                assign(c);
                EditorUtility.SetDirty(c);
                count++;
            }
            EditorSceneManager.SaveScene(scene);
            Debug.Log($"[SceneLinker] ✓ {Path.GetFileName(scenePath)}: {fieldDesc} → {count} 件");
            return count;
        }

        /// <summary>リフレクションで SerializeField に値をセットする</summary>
        static void Sf(object target, string field, object value)
        {
            var type = target.GetType();
            while (type != null)
            {
                var fi = type.GetField(field,
                    BindingFlags.NonPublic | BindingFlags.Instance);
                if (fi != null) { fi.SetValue(target, value); return; }
                type = type.BaseType;
            }
            Debug.LogWarning($"[SceneLinker] フィールド未検出: {field}");
        }
    }
}
#endif
