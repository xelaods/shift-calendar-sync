// Assets/Editor/SceneBuilder.cs
// ======================================================
//  ShiftSync — 自動シーン生成ツール  [Unity 6 対応版]
//
//  Unity メニュー「Tools → ShiftSync → ① Build All Scenes」を実行すると
//  5つのシーンを Assets/Scenes/ に生成し Build Settings に自動登録します。
//
//  Unity 6 (6000.x) 以降を対象としています。
//  必要パッケージ（manifest.json）:
//    com.unity.ugui              2.0.0  (TextMeshPro を含む)
//    com.unity.mobile.notifications 2.4.3
//    com.unity.nuget.newtonsoft-json 3.2.2
// ======================================================

#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using TMPro;

namespace ShiftSync.Editor
{
    public static class SceneBuilder
    {
        // ── カラーパレット（ダークモード） ──────────────────────────
        static readonly Color BG_DARK        = new(0.08f, 0.08f, 0.12f, 1f);
        static readonly Color PANEL_DARK     = new(0.12f, 0.12f, 0.18f, 1f);
        static readonly Color ACCENT_BLUE    = new(0.25f, 0.55f, 1.0f,  1f);
        static readonly Color ACCENT_GREEN   = new(0.20f, 0.85f, 0.55f, 1f);
        static readonly Color ACCENT_RED     = new(1.0f,  0.35f, 0.35f, 1f);
        static readonly Color TEXT_PRIMARY   = new(0.95f, 0.95f, 1.0f,  1f);
        static readonly Color TEXT_SECONDARY = new(0.65f, 0.65f, 0.75f, 1f);
        static readonly Color BTN_PRIMARY    = new(0.25f, 0.55f, 1.0f,  1f);
        static readonly Color BTN_CANCEL     = new(0.25f, 0.25f, 0.35f, 1f);

        const string SCENES_PATH = "Assets/Scenes";

        // ────────────────────────────────────────────────────────────
        //  メニューエントリ
        // ────────────────────────────────────────────────────────────

        [MenuItem("Tools/ShiftSync/① Build All Scenes")]
        public static void BuildAllScenes()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            Directory.CreateDirectory(SCENES_PATH);

            var sceneList = new List<EditorBuildSettingsScene>();

            BuildScene("Login",     BuildLoginScene,     sceneList);
            BuildScene("Calendar",  BuildCalendarScene,  sceneList);
            BuildScene("ShiftEdit", BuildShiftEditScene, sceneList);
            BuildScene("Stats",     BuildStatsScene,     sceneList);
            BuildScene("Settings",  BuildSettingsScene,  sceneList);

            EditorBuildSettings.scenes = sceneList.ToArray();
            AssetDatabase.Refresh();

            EditorUtility.DisplayDialog(
                "ShiftSync Scene Builder",
                "✅ 5つのシーンを生成しました！\n\n" +
                "Assets/Scenes/ を確認してください。\n" +
                "Build Settings にも自動登録済みです。\n\n" +
                "次のステップ:\n" +
                "  ② Build Prefabs を実行してください。",
                "OK");
        }

        // ────────────────────────────────────────────────────────────
        //  シーン共通ビルド
        // ────────────────────────────────────────────────────────────

        static void BuildScene(string name,
            System.Action<UnityEngine.SceneManagement.Scene> builder,
            List<EditorBuildSettingsScene> list)
        {
            var scene = EditorSceneManager.NewScene(
                NewSceneSetup.EmptyScene, NewSceneMode.Single);
            builder(scene);
            string path = $"{SCENES_PATH}/{name}.unity";
            EditorSceneManager.SaveScene(scene, path);
            list.Add(new EditorBuildSettingsScene(path, true));
            Debug.Log($"[SceneBuilder] ✓ {name}.unity を保存");
        }

        // ────────────────────────────────────────────────────────────
        //  Canvas ファクトリ
        // ────────────────────────────────────────────────────────────

        static (GameObject root, Canvas canvas) CreateCanvas()
        {
            // Main Camera
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = BG_DARK;
            cam.orthographic = true;
            cam.orthographicSize = 5f;
            cam.depth = -1;

            // Canvas
            var go = new GameObject("Canvas");
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(390, 844); // iPhone 15 Pro
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;

            go.AddComponent<GraphicRaycaster>();

            // EventSystem — Unity 6 では StandaloneInputModule が自動追加される
            // 新 Input System がある場合は InputSystemUIInputModule が使われる
            var esGo = new GameObject("EventSystem");
            esGo.AddComponent<EventSystem>();

            // 新 Input System パッケージが存在すれば InputSystemUIInputModule を使う
            // なければ StandaloneInputModule にフォールバック
            var inputModuleType = System.Type.GetType(
                "UnityEngine.InputSystem.UI.InputSystemUIInputModule, Unity.InputSystem");
            if (inputModuleType != null)
                esGo.AddComponent(inputModuleType);
            else
                esGo.AddComponent<StandaloneInputModule>();

            return (go, canvas);
        }

        // ────────────────────────────────────────────────────────────
        //  UI ファクトリ群
        // ────────────────────────────────────────────────────────────

        static GameObject CreatePanel(Transform parent, string name,
            float x, float y, float w, float h, Color? color = null)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            Anchor(go.AddComponent<RectTransform>(), x, y, w, h);
            go.AddComponent<Image>().color = color ?? PANEL_DARK;
            return go;
        }

        static TextMeshProUGUI CreateLabel(Transform parent, string name,
            float x, float y, float w, float h,
            string text, float fontSize = 18,
            Color? color = null,
            TextAlignmentOptions align = TextAlignmentOptions.Center)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            Anchor(go.AddComponent<RectTransform>(), x, y, w, h);
            var tmp = go.AddComponent<TextMeshProUGUI>();
            tmp.text = text;
            tmp.fontSize = fontSize;
            tmp.color = color ?? TEXT_PRIMARY;
            tmp.alignment = align;
            tmp.enableWordWrapping = false;
            return tmp;
        }

        static Button CreateButton(Transform parent, string name,
            float x, float y, float w, float h,
            string label, Color? bgColor = null, float fontSize = 16)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            Anchor(go.AddComponent<RectTransform>(), x, y, w, h);
            var img = go.AddComponent<Image>();
            img.color = bgColor ?? BTN_PRIMARY;
            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;

            var labelGo = new GameObject("Label");
            labelGo.transform.SetParent(go.transform, false);
            var lrt = labelGo.AddComponent<RectTransform>();
            lrt.anchorMin = Vector2.zero;
            lrt.anchorMax = Vector2.one;
            lrt.offsetMin = lrt.offsetMax = Vector2.zero;
            var tmp = labelGo.AddComponent<TextMeshProUGUI>();
            tmp.text = label;
            tmp.fontSize = fontSize;
            tmp.color = Color.white;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.enableWordWrapping = false;

            return btn;
        }

        static TMP_InputField CreateInputField(Transform parent, string name,
            float x, float y, float w, float h,
            string placeholder, float fontSize = 16,
            TMP_InputField.ContentType contentType = TMP_InputField.ContentType.Standard)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            Anchor(go.AddComponent<RectTransform>(), x, y, w, h);
            var bg = go.AddComponent<Image>();
            bg.color = new Color(0.18f, 0.18f, 0.25f, 1f);

            // テキストエリア
            var area = new GameObject("Text Area");
            area.transform.SetParent(go.transform, false);
            var aRt = area.AddComponent<RectTransform>();
            aRt.anchorMin = Vector2.zero; aRt.anchorMax = Vector2.one;
            aRt.offsetMin = new Vector2(8, 4); aRt.offsetMax = new Vector2(-8, -4);
            area.AddComponent<RectMask2D>();

            var textGo = new GameObject("Text");
            textGo.transform.SetParent(area.transform, false);
            var tRt = textGo.AddComponent<RectTransform>();
            tRt.anchorMin = Vector2.zero; tRt.anchorMax = Vector2.one;
            tRt.offsetMin = tRt.offsetMax = Vector2.zero;
            var textTmp = textGo.AddComponent<TextMeshProUGUI>();
            textTmp.fontSize = fontSize;
            textTmp.color = TEXT_PRIMARY;

            var phGo = new GameObject("Placeholder");
            phGo.transform.SetParent(area.transform, false);
            var pRt = phGo.AddComponent<RectTransform>();
            pRt.anchorMin = Vector2.zero; pRt.anchorMax = Vector2.one;
            pRt.offsetMin = pRt.offsetMax = Vector2.zero;
            var phTmp = phGo.AddComponent<TextMeshProUGUI>();
            phTmp.text = placeholder;
            phTmp.fontSize = fontSize;
            phTmp.color = TEXT_SECONDARY;
            phTmp.fontStyle = FontStyles.Italic;

            var field = go.AddComponent<TMP_InputField>();
            field.targetGraphic = bg;
            field.textComponent = textTmp;
            field.placeholder = phTmp;
            field.contentType = contentType;

            return field;
        }

        static Toggle CreateToggle(Transform parent, string name,
            float x, float y, float w, float h, string label)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            Anchor(go.AddComponent<RectTransform>(), x, y, w, h);

            var bgGo = new GameObject("Background");
            bgGo.transform.SetParent(go.transform, false);
            var bgRt = bgGo.AddComponent<RectTransform>();
            bgRt.anchorMin = new Vector2(0, 0.5f); bgRt.anchorMax = new Vector2(0, 0.5f);
            bgRt.anchoredPosition = new Vector2(14, 0);
            bgRt.sizeDelta = new Vector2(28, 28);
            var bgImg = bgGo.AddComponent<Image>();
            bgImg.color = new Color(0.18f, 0.18f, 0.25f, 1f);

            var checkGo = new GameObject("Checkmark");
            checkGo.transform.SetParent(bgGo.transform, false);
            var chRt = checkGo.AddComponent<RectTransform>();
            chRt.anchorMin = Vector2.zero; chRt.anchorMax = Vector2.one;
            chRt.offsetMin = new Vector2(3, 3); chRt.offsetMax = new Vector2(-3, -3);
            var chImg = checkGo.AddComponent<Image>();
            chImg.color = ACCENT_GREEN;

            var lblGo = new GameObject("Label");
            lblGo.transform.SetParent(go.transform, false);
            var lRt = lblGo.AddComponent<RectTransform>();
            lRt.anchorMin = new Vector2(0, 0); lRt.anchorMax = new Vector2(1, 1);
            lRt.offsetMin = new Vector2(36, 0); lRt.offsetMax = Vector2.zero;
            var lTmp = lblGo.AddComponent<TextMeshProUGUI>();
            lTmp.text = label;
            lTmp.fontSize = 16;
            lTmp.color = TEXT_PRIMARY;
            lTmp.alignment = TextAlignmentOptions.Left;

            var toggle = go.AddComponent<Toggle>();
            toggle.targetGraphic = bgImg;
            toggle.graphic = chImg;
            toggle.isOn = true;
            return toggle;
        }

        static TMP_Dropdown CreateDropdown(Transform parent, string name,
            float x, float y, float w, float h, string[] options)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            Anchor(go.AddComponent<RectTransform>(), x, y, w, h);
            var bg = go.AddComponent<Image>();
            bg.color = new Color(0.18f, 0.18f, 0.25f, 1f);

            var capGo = new GameObject("Label");
            capGo.transform.SetParent(go.transform, false);
            var cRt = capGo.AddComponent<RectTransform>();
            cRt.anchorMin = Vector2.zero; cRt.anchorMax = Vector2.one;
            cRt.offsetMin = new Vector2(8, 0); cRt.offsetMax = new Vector2(-30, 0);
            var capTmp = capGo.AddComponent<TextMeshProUGUI>();
            capTmp.text = options.Length > 0 ? options[0] : "";
            capTmp.fontSize = 15;
            capTmp.color = TEXT_PRIMARY;
            capTmp.alignment = TextAlignmentOptions.Left;

            var dd = go.AddComponent<TMP_Dropdown>();
            dd.targetGraphic = bg;
            dd.captionText = capTmp;
            dd.options = new List<TMP_Dropdown.OptionData>();
            foreach (var o in options)
                dd.options.Add(new TMP_Dropdown.OptionData(o));
            return dd;
        }

        static GameObject CreateLoadingOverlay(Transform parent, string label = "読み込み中...")
        {
            var go = new GameObject("LoadingOverlay");
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            go.AddComponent<Image>().color = new Color(0, 0, 0, 0.72f);
            CreateLabel(go.transform, "LoadingLabel", 0, 0, 300, 60, label, 20);
            go.SetActive(false);
            return go;
        }

        static void Anchor(RectTransform rt, float x, float y, float w, float h)
        {
            rt.anchorMin = new Vector2(0.5f, 0.5f);
            rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot     = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = new Vector2(x, y);
            rt.sizeDelta        = new Vector2(w, h);
        }

        // ────────────────────────────────────────────────────────────
        //  SCENE 0 — Login（スプラッシュ → 自動遷移）
        // ────────────────────────────────────────────────────────────

        static void BuildLoginScene(UnityEngine.SceneManagement.Scene scene)
        {
            var (root, _) = CreateCanvas();

            // グラデーション背景パネル
            var bgPanel = CreatePanel(root.transform, "BackgroundPanel",
                0, 0, 1000, 1000, BG_DARK);

            // ロゴ
            CreateLabel(root.transform, "AppLogo",
                0, 130, 360, 80, "🗓 ShiftSync", 52, ACCENT_BLUE);
            CreateLabel(root.transform, "AppSubtitle",
                0, 65, 360, 36, "シフト自動同期・カレンダー管理", 17, TEXT_SECONDARY);

            // カード
            var card = CreatePanel(root.transform, "SplashCard",
                0, -30, 330, 90, new Color(0.13f, 0.13f, 0.20f, 1f));
            CreateLabel(card.transform, "SplashMessage",
                0, 0, 300, 70,
                "シフコンと連携して\n自動でシフトを取得します", 16, TEXT_SECONDARY);

            CreateLoadingOverlay(root.transform, "起動中...");

            // AutoLoginController
            var ctrl = new GameObject("AutoLoginController");
            ctrl.AddComponent<ShiftSync.UI.AutoLoginController>();
        }

        // ────────────────────────────────────────────────────────────
        //  SCENE 1 — Calendar（メイン）
        // ────────────────────────────────────────────────────────────

        static void BuildCalendarScene(UnityEngine.SceneManagement.Scene scene)
        {
            var (root, _) = CreateCanvas();

            // ── シングルトン群（DontDestroyOnLoad） ──
            var apiGo = new GameObject("ApiClient");
            apiGo.AddComponent<ShiftSync.API.ApiClient>();

            var notifGo = new GameObject("NotificationManager");
            notifGo.AddComponent<ShiftSync.UI.NotificationManager>();

            // ── ヘッダー ──
            var header = CreatePanel(root.transform, "Header",
                0, 391, 390, 78, new Color(0.10f, 0.10f, 0.16f));
            var prevBtn  = CreateButton(header.transform, "PrevMonthButton",
                -152, 0, 50, 50, "＜", BTN_CANCEL, 20);
            var monthLbl = CreateLabel(header.transform, "MonthLabel",
                0, 0, 230, 50, "2026年6月", 22, TEXT_PRIMARY);
            var nextBtn  = CreateButton(header.transform, "NextMonthButton",
                152, 0, 50, 50, "＞", BTN_CANCEL, 20);
            var syncBtn  = CreateButton(header.transform, "SyncButton",
                100, -2, 78, 36, "🔄 同期", ACCENT_BLUE, 13);

            // ── 曜日ヘッダー ──
            string[] dayNames = { "日","月","火","水","木","金","土" };
            float cellW = 54f;
            var dayHeaderGo = new GameObject("DayHeader");
            dayHeaderGo.transform.SetParent(root.transform, false);
            var dhRt = dayHeaderGo.AddComponent<RectTransform>();
            dhRt.anchorMin = new Vector2(0.5f, 0.5f); dhRt.anchorMax = new Vector2(0.5f, 0.5f);
            dhRt.anchoredPosition = new Vector2(0, 306);
            dhRt.sizeDelta = new Vector2(390, 28);
            var dhHlg = dayHeaderGo.AddComponent<HorizontalLayoutGroup>();
            dhHlg.childAlignment = TextAnchor.MiddleCenter;
            dhHlg.childForceExpandWidth = true;
            dhHlg.childForceExpandHeight = true;
            dhHlg.spacing = 2f;
            for (int i = 0; i < 7; i++)
            {
                Color c = i == 0 ? ACCENT_RED : (i == 6 ? ACCENT_BLUE : TEXT_SECONDARY);
                var dGo = new GameObject($"Day_{dayNames[i]}");
                dGo.transform.SetParent(dayHeaderGo.transform, false);
                dGo.AddComponent<RectTransform>();
                var dTmp = dGo.AddComponent<TextMeshProUGUI>();
                dTmp.text = dayNames[i];
                dTmp.fontSize = 13;
                dTmp.color = c;
                dTmp.alignment = TextAlignmentOptions.Center;
            }

            // ── カレンダーグリッド ──
            var gridGo = new GameObject("CalendarGrid");
            gridGo.transform.SetParent(root.transform, false);
            var gridRt = gridGo.AddComponent<RectTransform>();
            gridRt.anchorMin = new Vector2(0.5f, 0.5f); gridRt.anchorMax = new Vector2(0.5f, 0.5f);
            gridRt.anchoredPosition = new Vector2(0, 10);
            gridRt.sizeDelta = new Vector2(390, 390);
            var glg = gridGo.AddComponent<GridLayoutGroup>();
            glg.cellSize        = new Vector2(cellW, 62);
            glg.spacing         = new Vector2(2, 2);
            glg.startCorner     = GridLayoutGroup.Corner.UpperLeft;
            glg.startAxis       = GridLayoutGroup.Axis.Horizontal;
            glg.childAlignment  = TextAnchor.UpperCenter;
            glg.constraint      = GridLayoutGroup.Constraint.FixedColumnCount;
            glg.constraintCount = 7;

            // ── 詳細パネル ──
            var detailPanel = CreatePanel(root.transform, "DetailPanel",
                0, -185, 365, 230, new Color(0.12f, 0.14f, 0.22f));
            var detailBorder = detailPanel.AddComponent<Outline>();
            detailBorder.effectColor = new Color(ACCENT_BLUE.r, ACCENT_BLUE.g, ACCENT_BLUE.b, 0.4f);
            detailBorder.effectDistance = new Vector2(1.5f, -1.5f);

            var detailDateLbl  = CreateLabel(detailPanel.transform, "DetailDateLabel",
                0, 82, 330, 36, "2026年6月1日（月）", 17, TEXT_PRIMARY);
            var detailTimeLbl  = CreateLabel(detailPanel.transform, "DetailTimeLabel",
                0, 44, 330, 38, "09:00〜17:00", 24, ACCENT_GREEN);
            var detailStoreLbl = CreateLabel(detailPanel.transform, "DetailStoreLabel",
                0, 10, 330, 30, "ドン・キホーテ", 15, TEXT_SECONDARY);
            var detailHoursLbl = CreateLabel(detailPanel.transform, "DetailHoursLabel",
                0, -20, 330, 28, "勤務: 8.0時間", 14, TEXT_SECONDARY);

            var editBtn   = CreateButton(detailPanel.transform, "EditShiftButton",
                -82, -80, 140, 44, "✏ 編集", ACCENT_BLUE, 15);
            var deleteBtn = CreateButton(detailPanel.transform, "DeleteShiftButton",
                75, -80, 140, 44, "🗑 削除", ACCENT_RED, 15);
            var closeBtn  = CreateButton(detailPanel.transform, "CloseDetailButton",
                159, 94, 36, 36, "✕", BTN_CANCEL, 14);
            detailPanel.SetActive(false);

            // ── FAB（追加ボタン） ──
            var addBtn = CreateButton(root.transform, "AddShiftButton",
                158, -365, 62, 62, "＋", ACCENT_GREEN, 28);

            // ── ボトムナビ ──
            BuildBottomNav(root.transform, 0);

            // ── ローディング ──
            var loading = CreateLoadingOverlay(root.transform);

            // ── CalendarManager ──
            var mgrGo = new GameObject("CalendarManager");
            mgrGo.transform.SetParent(root.transform, false);
            var cm = mgrGo.AddComponent<ShiftSync.UI.CalendarManager>();
            Sf(cm, "monthLabel",       monthLbl);
            Sf(cm, "prevMonthButton",  prevBtn);
            Sf(cm, "nextMonthButton",  nextBtn);
            Sf(cm, "syncButton",       syncBtn);
            Sf(cm, "calendarGrid",     gridGo.transform);
            Sf(cm, "detailPanel",      detailPanel);
            Sf(cm, "detailDateLabel",  detailDateLbl);
            Sf(cm, "detailTimeLabel",  detailTimeLbl);
            Sf(cm, "detailStoreLabel", detailStoreLbl);
            Sf(cm, "detailHoursLabel", detailHoursLbl);
            Sf(cm, "editShiftButton",  editBtn);
            Sf(cm, "deleteShiftButton",deleteBtn);
            Sf(cm, "closeDetailButton",closeBtn);
            Sf(cm, "addShiftButton",   addBtn);
            Sf(cm, "loadingOverlay",   loading);
        }

        // ────────────────────────────────────────────────────────────
        //  SCENE 2 — ShiftEdit（追加・編集）
        // ────────────────────────────────────────────────────────────

        static void BuildShiftEditScene(UnityEngine.SceneManagement.Scene scene)
        {
            var (root, _) = CreateCanvas();

            var apiGo = new GameObject("ApiClient");
            apiGo.AddComponent<ShiftSync.API.ApiClient>();

            // ヘッダー
            var header = CreatePanel(root.transform, "Header",
                0, 391, 390, 78, new Color(0.10f, 0.10f, 0.16f));
            var titleLbl = CreateLabel(header.transform, "TitleLabel",
                0, 0, 280, 50, "シフト追加", 22, TEXT_PRIMARY);
            var backBtn = CreateButton(header.transform, "BackButton",
                -162, 0, 44, 44, "←", BTN_CANCEL, 18);

            // 日付ナビ
            var prevDay = CreateButton(root.transform, "PrevDayButton",
                -152, 298, 50, 50, "＜", BTN_CANCEL, 20);
            var dateLbl = CreateLabel(root.transform, "DateLabel",
                0, 298, 250, 50, "2026年6月1日（月）", 18, TEXT_PRIMARY);
            var nextDay = CreateButton(root.transform, "NextDayButton",
                152, 298, 50, 50, "＞", BTN_CANCEL, 20);

            // フォーム
            float fy = 220f;
            CreateLabel(root.transform, "StartTimeLbl", -130, fy,      120, 26,
                "開始時刻", 13, TEXT_SECONDARY, TextAlignmentOptions.Left);
            var startInput = CreateInputField(root.transform, "StartTimeInput",
                70, fy - 22, 200, 48, "09:00", 18, TMP_InputField.ContentType.Standard);

            CreateLabel(root.transform, "EndTimeLbl",   -130, fy - 80, 120, 26,
                "終了時刻", 13, TEXT_SECONDARY, TextAlignmentOptions.Left);
            var endInput = CreateInputField(root.transform, "EndTimeInput",
                70, fy - 102, 200, 48, "17:00", 18);

            CreateLabel(root.transform, "StoreLbl",     -130, fy - 160, 120, 26,
                "店舗名", 13, TEXT_SECONDARY, TextAlignmentOptions.Left);
            var storeInput = CreateInputField(root.transform, "StoreNameInput",
                70, fy - 182, 200, 48, "ドン・キホーテ", 18);

            CreateLabel(root.transform, "NoteLbl",      -130, fy - 240, 120, 26,
                "メモ（任意）", 13, TEXT_SECONDARY, TextAlignmentOptions.Left);
            var noteInput = CreateInputField(root.transform, "NoteInput",
                70, fy - 276, 200, 80, "（省略可）", 16);

            // エラー
            var errorLbl = CreateLabel(root.transform, "ErrorLabel",
                0, -70, 350, 40, "", 14, ACCENT_RED);
            errorLbl.gameObject.SetActive(false);

            // ボタン
            var saveBtn   = CreateButton(root.transform, "SaveButton",
                -82, -140, 155, 54, "💾 保存", ACCENT_GREEN, 17);
            var cancelBtn = CreateButton(root.transform, "CancelButton",
                88, -140, 155, 54, "← 戻る", BTN_CANCEL, 17);

            var loading = CreateLoadingOverlay(root.transform);

            // ShiftEditManager
            var mgrGo = new GameObject("ShiftEditManager");
            mgrGo.transform.SetParent(root.transform, false);
            var sem = mgrGo.AddComponent<ShiftSync.UI.ShiftEditManager>();
            Sf(sem, "titleLabel",     titleLbl);
            Sf(sem, "dateLabel",      dateLbl);
            Sf(sem, "startTimeInput", startInput);
            Sf(sem, "endTimeInput",   endInput);
            Sf(sem, "storeNameInput", storeInput);
            Sf(sem, "noteInput",      noteInput);
            Sf(sem, "prevDayButton",  prevDay);
            Sf(sem, "nextDayButton",  nextDay);
            Sf(sem, "saveButton",     saveBtn);
            Sf(sem, "cancelButton",   cancelBtn);
            Sf(sem, "loadingOverlay", loading);
            Sf(sem, "errorLabel",     errorLbl);
        }

        // ────────────────────────────────────────────────────────────
        //  SCENE 3 — Stats（統計）
        // ────────────────────────────────────────────────────────────

        static void BuildStatsScene(UnityEngine.SceneManagement.Scene scene)
        {
            var (root, _) = CreateCanvas();

            var apiGo = new GameObject("ApiClient");
            apiGo.AddComponent<ShiftSync.API.ApiClient>();

            // ヘッダー
            var header = CreatePanel(root.transform, "Header",
                0, 391, 390, 78, new Color(0.10f, 0.10f, 0.16f));
            CreateLabel(header.transform, "PageTitle", 0, 0, 200, 50, "📊 統計", 22, TEXT_PRIMARY);
            var prevBtn  = CreateButton(header.transform, "PrevMonthButton",
                -152, 0, 50, 50, "＜", BTN_CANCEL, 20);
            var monthLbl = CreateLabel(header.transform, "MonthLabel",
                20, 0, 200, 50, "2026年6月", 20, TEXT_PRIMARY);
            var nextBtn  = CreateButton(header.transform, "NextMonthButton",
                152, 0, 50, 50, "＞", BTN_CANCEL, 20);

            // サマリーカード（シフト数・時間）
            var summaryCard = CreatePanel(root.transform, "SummaryCard",
                0, 255, 365, 130, new Color(0.13f, 0.13f, 0.20f));
            var totalShifts = CreateLabel(summaryCard.transform, "TotalShiftsLabel",
                -83, 28, 160, 42, "0回", 30, ACCENT_BLUE);
            CreateLabel(summaryCard.transform, "ShiftsDesc",
                -83, -8, 160, 22, "シフト数", 13, TEXT_SECONDARY);
            var totalHours = CreateLabel(summaryCard.transform, "TotalHoursLabel",
                83, 28, 160, 42, "0.0時間", 30, ACCENT_GREEN);
            CreateLabel(summaryCard.transform, "HoursDesc",
                83, -8, 160, 22, "総勤務時間", 13, TEXT_SECONDARY);

            // 収入カード
            var incomeCard = CreatePanel(root.transform, "IncomeCard",
                0, 115, 365, 100, new Color(0.13f, 0.13f, 0.20f));
            var incomeLbl = CreateLabel(incomeCard.transform, "EstimatedIncomeLabel",
                0, 20, 310, 48, "¥0", 36, TEXT_PRIMARY);
            var wageLbl = CreateLabel(incomeCard.transform, "HourlyWageLabel",
                0, -22, 310, 26, "時給 ¥---", 14, TEXT_SECONDARY);

            // 棒グラフコンテナ
            var chartGo = new GameObject("BarChartContainer");
            chartGo.transform.SetParent(root.transform, false);
            var chartRt = chartGo.AddComponent<RectTransform>();
            chartRt.anchorMin = new Vector2(0.5f, 0.5f); chartRt.anchorMax = new Vector2(0.5f, 0.5f);
            chartRt.anchoredPosition = new Vector2(0, -115);
            chartRt.sizeDelta = new Vector2(375, 220);
            var hlg = chartGo.AddComponent<HorizontalLayoutGroup>();
            hlg.spacing = 2;
            hlg.childAlignment = TextAnchor.LowerCenter;
            hlg.childForceExpandWidth  = true;
            hlg.childForceExpandHeight = false;

            BuildBottomNav(root.transform, 1);
            var loading = CreateLoadingOverlay(root.transform);

            var mgrGo = new GameObject("StatsManager");
            mgrGo.transform.SetParent(root.transform, false);
            var sm = mgrGo.AddComponent<ShiftSync.UI.StatsManager>();
            Sf(sm, "monthLabel",           monthLbl);
            Sf(sm, "prevMonthButton",      prevBtn);
            Sf(sm, "nextMonthButton",      nextBtn);
            Sf(sm, "totalShiftsLabel",     totalShifts);
            Sf(sm, "totalHoursLabel",      totalHours);
            Sf(sm, "estimatedIncomeLabel", incomeLbl);
            Sf(sm, "hourlyWageLabel",      wageLbl);
            Sf(sm, "barChartContainer",    chartGo.transform);
            Sf(sm, "loadingOverlay",       loading);
        }

        // ────────────────────────────────────────────────────────────
        //  SCENE 4 — Settings（設定）
        // ────────────────────────────────────────────────────────────

        static void BuildSettingsScene(UnityEngine.SceneManagement.Scene scene)
        {
            var (root, _) = CreateCanvas();

            var apiGo = new GameObject("ApiClient");
            apiGo.AddComponent<ShiftSync.API.ApiClient>();

            // ヘッダー
            var header = CreatePanel(root.transform, "Header",
                0, 391, 390, 78, new Color(0.10f, 0.10f, 0.16f));
            CreateLabel(header.transform, "PageTitle", 0, 0, 280, 50, "⚙ 設定", 22, TEXT_PRIMARY);

            float y = 290f;

            // APIサーバー
            CreateLabel(root.transform, "ApiUrlLbl",
                -130, y, 120, 26, "APIサーバーURL", 12, TEXT_SECONDARY, TextAlignmentOptions.Left);
            var apiUrlInput = CreateInputField(root.transform, "ApiUrlInput",
                70, y - 22, 220, 48, "http://localhost:8000", 14);
            var testBtn = CreateButton(root.transform, "TestConnectionButton",
                0, y - 82, 210, 40, "接続テスト", BTN_CANCEL, 14);
            var connStatusLbl = CreateLabel(root.transform, "ConnectionStatusLabel",
                0, y - 120, 310, 28, "", 13, TEXT_SECONDARY);

            // 時給
            CreateLabel(root.transform, "WageLbl",
                -130, y - 145, 120, 26, "時給（円）", 12, TEXT_SECONDARY, TextAlignmentOptions.Left);
            var wageInput = CreateInputField(root.transform, "HourlyWageInput",
                70, y - 167, 220, 48, "1050", 16, TMP_InputField.ContentType.DecimalNumber);

            // 区切り
            CreateLabel(root.transform, "NotifyDivider",
                0, y - 225, 350, 22, "──── 通知設定 ────", 12, TEXT_SECONDARY);

            // 通知
            var notifyToggle = CreateToggle(root.transform, "NotifyEnabledToggle",
                -85, y - 260, 200, 36, "通知を有効にする");
            CreateLabel(root.transform, "NotifyTimeLbl",
                -130, y - 305, 120, 26, "通知時刻", 12, TEXT_SECONDARY, TextAlignmentOptions.Left);
            var notifyTimeInput = CreateInputField(root.transform, "NotifyTimeInput",
                70, y - 327, 220, 48, "08:00", 16);
            var notifyDaysDD = CreateDropdown(root.transform, "NotifyDaysDropdown",
                0, y - 390, 310, 48,
                new[] { "当日", "前日", "2日前", "3日前" });

            // iOS通知許可
            var notifPermBtn = CreateButton(root.transform, "RequestNotifPermButton",
                0, -275, 290, 44, "通知許可をリクエスト（iOS）", BTN_CANCEL, 13);

            // エラー
            var errorLbl = CreateLabel(root.transform, "ErrorLabel",
                0, -325, 350, 34, "", 14, ACCENT_RED);
            errorLbl.gameObject.SetActive(false);

            // 保存・戻る
            var saveBtn   = CreateButton(root.transform, "SaveButton",
                -83, -382, 160, 52, "💾 保存", ACCENT_GREEN, 17);
            var cancelBtn = CreateButton(root.transform, "CancelButton",
                88, -382, 160, 52, "← 戻る", BTN_CANCEL, 17);

            BuildBottomNav(root.transform, 2);
            var loading = CreateLoadingOverlay(root.transform);

            var mgrGo = new GameObject("SettingsManager");
            mgrGo.transform.SetParent(root.transform, false);
            var setm = mgrGo.AddComponent<ShiftSync.UI.SettingsManager>();
            Sf(setm, "apiUrlInput",           apiUrlInput);
            Sf(setm, "testConnectionButton",  testBtn);
            Sf(setm, "connectionStatusLabel", connStatusLbl);
            Sf(setm, "hourlyWageInput",       wageInput);
            Sf(setm, "notifyEnabledToggle",   notifyToggle);
            Sf(setm, "notifyTimeInput",       notifyTimeInput);
            Sf(setm, "notifyDaysDropdown",    notifyDaysDD);
            Sf(setm, "saveButton",            saveBtn);
            Sf(setm, "cancelButton",          cancelBtn);
            Sf(setm, "requestNotifPermButton",notifPermBtn);
            Sf(setm, "loadingOverlay",        loading);
            Sf(setm, "errorLabel",            errorLbl);
        }

        // ────────────────────────────────────────────────────────────
        //  ボトムナビ（共通）
        //  activeIndex: 0=カレンダー, 1=統計, 2=設定
        // ────────────────────────────────────────────────────────────

        static void BuildBottomNav(Transform parent, int activeIndex)
        {
            var nav = CreatePanel(parent, "BottomNav",
                0, -398, 390, 76, new Color(0.10f, 0.10f, 0.16f));
            nav.AddComponent<ShiftSync.UI.BottomNavController>();

            string[] icons  = { "📅", "📊", "⚙" };
            string[] names  = { "カレンダー", "統計", "設定" };
            float[]  xs     = { -120f, 0f, 120f };

            for (int i = 0; i < 3; i++)
            {
                var btn = new GameObject($"NavBtn_{names[i]}");
                btn.transform.SetParent(nav.transform, false);
                Anchor(btn.AddComponent<RectTransform>(), xs[i], 0, 110, 70);
                var img = btn.AddComponent<Image>();
                img.color = Color.clear;
                btn.AddComponent<Button>().targetGraphic = img;

                Color col = (i == activeIndex) ? ACCENT_BLUE : TEXT_SECONDARY;
                CreateLabel(btn.transform, "Icon",  0,  15, 100, 28, icons[i],  20, col);
                CreateLabel(btn.transform, "Label", 0, -14, 100, 18, names[i],  11, col);
            }
        }

        // ────────────────────────────────────────────────────────────
        //  SerializeField をリフレクションで設定（Sf = SetField）
        // ────────────────────────────────────────────────────────────

        static void Sf(object target, string fieldName, object value)
        {
            var type = target.GetType();
            while (type != null)
            {
                var fi = type.GetField(fieldName,
                    BindingFlags.NonPublic | BindingFlags.Instance);
                if (fi != null) { fi.SetValue(target, value); return; }
                type = type.BaseType;
            }
            Debug.LogWarning($"[SceneBuilder] フィールド未検出: {fieldName}");
        }
    }
}
#endif
