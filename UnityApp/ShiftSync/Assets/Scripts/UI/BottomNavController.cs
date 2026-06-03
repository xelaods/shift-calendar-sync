using UnityEngine;
using UnityEngine.UI;

namespace ShiftSync.UI
{
    /// <summary>
    /// ボトムナビゲーションバーのクリックイベントを接続する。
    /// 各シーンのボトムナビ親オブジェクト（BottomNav）にアタッチする。
    /// SceneBuilder で自動配置される。
    /// </summary>
    public class BottomNavController : MonoBehaviour
    {
        private void Start()
        {
            // NavBtn_カレンダー
            var calBtn = transform.Find("NavBtn_カレンダー");
            if (calBtn) calBtn.GetComponent<Button>()?.onClick.AddListener(SceneTransition.GoToCalendar);

            // NavBtn_統計
            var statsBtn = transform.Find("NavBtn_統計");
            if (statsBtn) statsBtn.GetComponent<Button>()?.onClick.AddListener(SceneTransition.GoToStats);

            // NavBtn_設定
            var settingsBtn = transform.Find("NavBtn_設定");
            if (settingsBtn) settingsBtn.GetComponent<Button>()?.onClick.AddListener(SceneTransition.GoToSettings);
        }
    }
}
