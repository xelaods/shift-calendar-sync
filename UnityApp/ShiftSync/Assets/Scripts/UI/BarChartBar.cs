using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace ShiftSync.UI
{
    /// <summary>
    /// 統計画面の棒グラフ — 1本分のコンポーネント
    /// StatsManager.cs から分離（Unity ルール: MonoBehaviour はファイル名 = クラス名）
    /// </summary>
    public class BarChartBar : MonoBehaviour
    {
        [SerializeField] private Image fillImage;
        [SerializeField] private TextMeshProUGUI dayLabel;
        [SerializeField] private TextMeshProUGUI hoursLabel;

        [SerializeField] private float maxBarHeight = 200f;

        /// <summary>
        /// バーを初期化する
        /// </summary>
        /// <param name="label">日付ラベル（例: "1"）</param>
        /// <param name="fillRatio">0〜1 の充填率（最大時間に対する比率）</param>
        /// <param name="hours">実際の勤務時間（表示用）</param>
        public void Setup(string label, float fillRatio, float hours)
        {
            if (dayLabel)   dayLabel.text   = label;
            if (hoursLabel) hoursLabel.text = hours > 0 ? $"{hours:F1}h" : "";

            if (fillImage)
            {
                var rt = fillImage.rectTransform;
                rt.sizeDelta = new Vector2(rt.sizeDelta.x, maxBarHeight * Mathf.Clamp01(fillRatio));
            }
        }
    }
}
