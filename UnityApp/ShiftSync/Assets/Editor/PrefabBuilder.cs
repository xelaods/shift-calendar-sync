// Assets/Editor/PrefabBuilder.cs
// ======================================================
//  ShiftSync — プレハブ自動生成ツール  [Unity 6 対応版 v3]
//
//  修正点 (v3):
//    new GameObject() は単体では AddComponent が機能しない場合がある。
//    EditorSceneManager.NewScene で一時シーンを作成し、
//    そこで GameObjects を操作してからプレハブ化することで確実に動作する。
//
//  メニュー: Tools → ShiftSync → ② Build Prefabs
// ======================================================

#if UNITY_EDITOR
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace ShiftSync.Editor
{
    public static class PrefabBuilder
    {
        const string PREFABS_PATH = "Assets/Prefabs";

        static readonly Color BG_DARK      = new(0.15f, 0.15f, 0.20f, 1f);
        static readonly Color ACCENT_BLUE  = new(0.25f, 0.55f, 1.0f,  1f);
        static readonly Color ACCENT_GREEN = new(0.20f, 0.85f, 0.55f, 1f);
        static readonly Color TEXT_PRI     = new(0.95f, 0.95f, 1.0f,  1f);
        static readonly Color TEXT_SEC     = new(0.65f, 0.65f, 0.75f, 1f);

        // ─────────────────────────────────────────────────────────────
        //  メニューエントリ
        // ─────────────────────────────────────────────────────────────

        [MenuItem("Tools/ShiftSync/② Build Prefabs")]
        public static void BuildPrefabs()
        {
            Directory.CreateDirectory(PREFABS_PATH);

            // ── 一時シーンを作成（AddComponent が確実に動作するため） ──
            // NewSceneMode.Single で完全にクリーンなシーンを用意する
            var tempScene = EditorSceneManager.NewScene(
                NewSceneSetup.EmptyScene, NewSceneMode.Single);

            bool success = true;
            success &= BuildCalendarDayCellPrefab();
            success &= BuildBarChartBarPrefab();

            // 一時シーンをクリーンアップ（保存しない）
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            // ── 生成結果を検証 ──
            if (!success)
            {
                EditorUtility.DisplayDialog("エラー",
                    "プレハブの生成に失敗しました。\nConsole ウィンドウを確認してください。",
                    "OK");
                return;
            }

            // 実際にコンポーネントが付いているか確認
            var cellGo = AssetDatabase.LoadAssetAtPath<GameObject>($"{PREFABS_PATH}/CalendarDayCell.prefab");
            var barGo  = AssetDatabase.LoadAssetAtPath<GameObject>($"{PREFABS_PATH}/BarChartBar.prefab");

            bool cellHasComp = cellGo != null && cellGo.GetComponent<ShiftSync.UI.CalendarDayCell>() != null;
            bool barHasComp  = barGo  != null && barGo.GetComponent<ShiftSync.UI.BarChartBar>() != null;

            if (!cellHasComp || !barHasComp)
            {
                string details = "";
                if (!cellHasComp) details += "\n  • CalendarDayCell — コンポーネントなし";
                if (!barHasComp)  details += "\n  • BarChartBar — コンポーネントなし";

                EditorUtility.DisplayDialog("検証エラー",
                    $"プレハブは生成されましたが、コンポーネントが付いていません:{details}\n\n" +
                    "Console の Error ログを確認し、スクリプトに\n" +
                    "コンパイルエラーがないか確認してください。",
                    "OK");
                return;
            }

            EditorUtility.DisplayDialog(
                "ShiftSync Prefab Builder",
                "✅ プレハブを正常に生成しました！\n\n" +
                "  • Assets/Prefabs/CalendarDayCell.prefab ✓\n" +
                "  • Assets/Prefabs/BarChartBar.prefab ✓\n\n" +
                "次のステップ:\n" +
                "  ③ Link Prefabs to Scenes を実行してください。",
                "OK");
        }

        // ─────────────────────────────────────────────────────────────
        //  CalendarDayCell プレハブ
        // ─────────────────────────────────────────────────────────────

        static bool BuildCalendarDayCellPrefab()
        {
            string path = $"{PREFABS_PATH}/CalendarDayCell.prefab";
            try
            {
                // ── ルート GameObject ──────────────────────────────────
                var root = new GameObject("CalendarDayCell");
                var rt = root.AddComponent<RectTransform>();
                rt.sizeDelta = new Vector2(54, 62);

                // 背景 Image + Button（ルートに付ける）
                var bg  = root.AddComponent<Image>();
                bg.color = BG_DARK;
                var btn = root.AddComponent<Button>();
                btn.targetGraphic = bg;

                // ── 日付ラベル ──────────────────────────────────────────
                var dayLblGo = new GameObject("DayLabel");
                dayLblGo.transform.SetParent(root.transform, false);
                var dlRt = dayLblGo.AddComponent<RectTransform>();
                dlRt.anchorMin = new Vector2(0, 0.5f); dlRt.anchorMax = new Vector2(1, 1);
                dlRt.offsetMin = new Vector2(3, 0); dlRt.offsetMax = new Vector2(-2, -2);
                var dlTmp = dayLblGo.AddComponent<TextMeshProUGUI>();
                dlTmp.text = "1";
                dlTmp.fontSize = 15;
                dlTmp.color = TEXT_PRI;
                dlTmp.alignment = TextAlignmentOptions.TopLeft;
                dlTmp.enableWordWrapping = false;

                // ── シフトドット（右上） ────────────────────────────────
                var dotGo = new GameObject("ShiftDot");
                dotGo.transform.SetParent(root.transform, false);
                var dotRt = dotGo.AddComponent<RectTransform>();
                dotRt.anchorMin = new Vector2(1, 1); dotRt.anchorMax = new Vector2(1, 1);
                dotRt.anchoredPosition = new Vector2(-6, -6);
                dotRt.sizeDelta = new Vector2(8, 8);
                dotGo.AddComponent<Image>().color = ACCENT_GREEN;
                dotGo.SetActive(false);

                // ── シフト時刻ラベル（下半分） ──────────────────────────
                var timeLblGo = new GameObject("ShiftTimeLabel");
                timeLblGo.transform.SetParent(root.transform, false);
                var tlRt = timeLblGo.AddComponent<RectTransform>();
                tlRt.anchorMin = new Vector2(0, 0); tlRt.anchorMax = new Vector2(1, 0.5f);
                tlRt.offsetMin = new Vector2(1, 2); tlRt.offsetMax = new Vector2(-1, 0);
                var tlTmp = timeLblGo.AddComponent<TextMeshProUGUI>();
                tlTmp.text = "";
                tlTmp.fontSize = 8;
                tlTmp.color = ACCENT_GREEN;
                tlTmp.alignment = TextAlignmentOptions.Center;
                tlTmp.enableWordWrapping = false;
                tlTmp.overflowMode = TextOverflowModes.Truncate;

                // ── CalendarDayCell コンポーネント ──────────────────────
                // ★ ルートに Add する前に子 GameObjects を全部作っておく
                var cell = root.AddComponent<ShiftSync.UI.CalendarDayCell>();
                if (cell == null)
                {
                    Debug.LogError("[PrefabBuilder] CalendarDayCell.AddComponent 失敗 — スクリプトにコンパイルエラーがある可能性があります");
                    Object.DestroyImmediate(root);
                    return false;
                }
                Sf(cell, "dayLabel",       dlTmp);
                Sf(cell, "shiftDot",       dotGo);
                Sf(cell, "shiftTimeLabel", tlTmp);
                Sf(cell, "background",     bg);
                Sf(cell, "button",         btn);

                // ── プレハブ保存 ────────────────────────────────────────
                var prefab = PrefabUtility.SaveAsPrefabAsset(root, path);
                Object.DestroyImmediate(root);

                if (prefab == null)
                {
                    Debug.LogError($"[PrefabBuilder] CalendarDayCell プレハブの保存失敗: {path}");
                    return false;
                }

                AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
                Debug.Log($"[PrefabBuilder] ✓ CalendarDayCell.prefab → {path}");
                return true;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[PrefabBuilder] CalendarDayCell 生成中に例外: {e}");
                return false;
            }
        }

        // ─────────────────────────────────────────────────────────────
        //  BarChartBar プレハブ
        // ─────────────────────────────────────────────────────────────

        static bool BuildBarChartBarPrefab()
        {
            string path = $"{PREFABS_PATH}/BarChartBar.prefab";
            try
            {
                var root = new GameObject("BarChartBar");
                root.AddComponent<RectTransform>().sizeDelta = new Vector2(20, 220);

                var vlg = root.AddComponent<VerticalLayoutGroup>();
                vlg.childAlignment       = TextAnchor.LowerCenter;
                vlg.spacing              = 2;
                vlg.childForceExpandWidth  = true;
                vlg.childForceExpandHeight = false;
                vlg.padding = new RectOffset(1, 1, 0, 0);

                // ── 勤務時間ラベル（上） ────────────────────────────────
                var hoursGo = new GameObject("HoursLabel");
                hoursGo.transform.SetParent(root.transform, false);
                hoursGo.AddComponent<RectTransform>().sizeDelta = new Vector2(20, 18);
                var hoursLe = hoursGo.AddComponent<LayoutElement>();
                hoursLe.preferredHeight = 18; hoursLe.flexibleHeight = 0;
                var hoursTmp = hoursGo.AddComponent<TextMeshProUGUI>();
                hoursTmp.text = "";
                hoursTmp.fontSize = 8;
                hoursTmp.color = TEXT_SEC;
                hoursTmp.alignment = TextAlignmentOptions.Center;
                hoursTmp.enableWordWrapping = false;

                // ── バー本体（中） ──────────────────────────────────────
                var fillGo = new GameObject("FillImage");
                fillGo.transform.SetParent(root.transform, false);
                fillGo.AddComponent<RectTransform>().sizeDelta = new Vector2(18, 0);
                var fillLe = fillGo.AddComponent<LayoutElement>();
                fillLe.preferredHeight = 0; fillLe.minHeight = 2; fillLe.flexibleHeight = 1;
                var fillImg = fillGo.AddComponent<Image>();
                fillImg.color = ACCENT_BLUE;

                // ── 日付ラベル（下） ────────────────────────────────────
                var dayGo = new GameObject("DayLabel");
                dayGo.transform.SetParent(root.transform, false);
                dayGo.AddComponent<RectTransform>().sizeDelta = new Vector2(20, 16);
                var dayLe = dayGo.AddComponent<LayoutElement>();
                dayLe.preferredHeight = 16; dayLe.flexibleHeight = 0;
                var dayTmp = dayGo.AddComponent<TextMeshProUGUI>();
                dayTmp.text = "1";
                dayTmp.fontSize = 9;
                dayTmp.color = TEXT_SEC;
                dayTmp.alignment = TextAlignmentOptions.Center;
                dayTmp.enableWordWrapping = false;

                // ── BarChartBar コンポーネント ──────────────────────────
                var bar = root.AddComponent<ShiftSync.UI.BarChartBar>();
                if (bar == null)
                {
                    Debug.LogError("[PrefabBuilder] BarChartBar.AddComponent 失敗 — スクリプトにコンパイルエラーがある可能性があります");
                    Object.DestroyImmediate(root);
                    return false;
                }
                Sf(bar, "fillImage",  fillImg);
                Sf(bar, "dayLabel",   dayTmp);
                Sf(bar, "hoursLabel", hoursTmp);

                // ── プレハブ保存 ────────────────────────────────────────
                var prefab = PrefabUtility.SaveAsPrefabAsset(root, path);
                Object.DestroyImmediate(root);

                if (prefab == null)
                {
                    Debug.LogError($"[PrefabBuilder] BarChartBar プレハブの保存失敗: {path}");
                    return false;
                }

                AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
                Debug.Log($"[PrefabBuilder] ✓ BarChartBar.prefab → {path}");
                return true;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[PrefabBuilder] BarChartBar 生成中に例外: {e}");
                return false;
            }
        }

        // ─────────────────────────────────────────────────────────────
        //  リフレクション（SerializeField アサイン）
        // ─────────────────────────────────────────────────────────────

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
            Debug.LogWarning($"[PrefabBuilder] フィールド未検出: {field}");
        }
    }
}
#endif
