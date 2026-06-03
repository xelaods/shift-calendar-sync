using System.Collections;
using UnityEngine;
using ShiftSync.API;

namespace ShiftSync.UI
{
    /// <summary>
    /// ログイン画面：現在は認証なしのため、
    /// 起動後 1.5秒でカレンダー画面へ自動遷移する。
    /// 将来ログイン機能を追加する場合はここに実装。
    /// </summary>
    public class AutoLoginController : MonoBehaviour
    {
        [SerializeField] private float splashDuration = 1.5f;

        private IEnumerator Start()
        {
            // スプラッシュ表示
            yield return new WaitForSeconds(splashDuration);

            // 初回起動フラグを立てる
            SecureStorage.MarkLaunched();

            // カレンダーへ遷移
            SceneTransition.GoToCalendar();
        }
    }
}
