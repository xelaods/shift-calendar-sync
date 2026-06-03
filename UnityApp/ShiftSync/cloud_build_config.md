# Unity Cloud Build — iOS ビルド設定手順（AltStore 版）

## 前提条件

- Unity ID を持っている ✅
- Unity Cloud Build（Unity DevOps Build Automation）アカウントあり ✅
- 無料 Apple ID（Apple Developer Program 不要）✅
- AltStore / AltServer（Windows版）インストール済み ✅
- Mac が**1台だけ一時的に必要**（フリー開発証明書の発行時のみ）

> [!NOTE]
> Mac を持っていない場合は「**GitHub Actions 版**」（このドキュメント末尾）を使うと
> Mac なしで完全に Windows + クラウドだけでビルドできます。

---

## ウィジェット除外について

App Groups（WidgetKit の必須機能）は有料 Apple Developer Program が必要なため、
本アプリでは **ウィジェットなし** で進めます。  
`Assets/Plugins/iOS/Widget/` 内の Swift ファイルは **Xcode プロジェクトのターゲットから除外** します。

---

## Step 1: 無料 Apple ID で開発証明書を発行（Mac で1回だけ）

### 1-1. Xcode で証明書を作成（Mac 上で実施）

1. Mac に Xcode をインストール
2. Xcode → **Preferences / Settings** → **Accounts** → Apple ID でサインイン
3. アカウントを選択 → 「**Manage Certificates**」→「+」→ **Apple Development**
4. これで `~/Library/Keychains/` に開発証明書が作られる

### 1-2. 証明書と Provisioning Profile をエクスポート

**証明書 (.p12) のエクスポート:**
```
Mac の「キーチェーンアクセス」を開く
→ 「Apple Development: ...」の証明書を右クリック
→「書き出す」→ .p12 形式で保存（パスワードを設定）
```

**Provisioning Profile の取得（無料 Apple ID の場合）:**
```
Xcode → 任意のプロジェクトを開く
→ Signing & Capabilities → Team を自分のApple IDに設定
→ Bundle ID を「com.yourname.shiftsync」に設定
→ Xcode が自動で Provisioning Profile を生成する
→ ~/Library/MobileDevice/Provisioning Profiles/ にある .mobileprovision をコピー
```

> [!IMPORTANT]
> 無料Apple IDの証明書は **有効期限7日間**。  
> 7日後は AltServer が自動で再署名してくれるので実用上問題なし。

---

## Step 2: Unity プロジェクトを Git にプッシュ

```powershell
cd c:\vscodeapp
git add UnityApp/
git commit -m "feat: Unity ShiftSync iPhoneアプリ（ウィジェットなし）"
git push origin main
```

---

## Step 3: Unity Cloud Build でプロジェクトを設定

1. [Unity Dashboard](https://cloud.unity3d.com/) → **DevOps** → **Build Automation**
2. 「**Setup Build Automation**」→ GitHub リポジトリ `xelaods/shift-calendar-sync` を選択
3. ソースコードのルート: `UnityApp/ShiftSync`

---

## Step 4: ビルドターゲットを作成

1. 「**Add new build target**」をクリック
2. 以下を設定:

| 項目 | 値 |
|------|-----|
| Platform | **iOS** |
| Unity Version | **2023.2.x (LTS)** |
| Xcode Version | 最新安定版 |
| Build Type | **Development** |
| Bundle Identifier | `com.yourname.shiftsync` |
| Signing | **Sign with stored credentials** |

---

## Step 5: iOS 署名設定（Unity Cloud Build）

1. Build Target → **Credentials** タブ
2. Step 1 で作成した以下をアップロード:
   - **Certificate (.p12)** + パスワード
   - **Provisioning Profile (.mobileprovision)**

---

## Step 6: ビルドの実行

1. 「**Start Build**」をクリック
2. 5〜15分でビルド完了
3. **Artifacts** から `.ipa` ファイルをダウンロード

---

## Step 7: AltServer で iPhone にインストール

### Windows での手順

1. **AltServer** を起動（タスクトレイに常駐）
2. iPhone を USB で PC に接続（または WiFi）
3. タスクトレイの AltServer アイコンを右クリック
4. 「**Install .ipa**」→ ダウンロードした `.ipa` を選択
5. Apple ID とパスワードを入力
6. インストール完了！

> [!NOTE]
> AltServer は Apple ID を使ってアプリを自動署名します。  
> 週1回 AltStore アプリを起動（または AltServer が WiFi 経由で自動更新）するだけで
> 7日間の証明書が自動更新されます。

---

## Step 8: バックエンドAPIのデプロイ（推奨: Render.com）

1. [render.com](https://render.com) でサインアップ（無料プランあり）
2. 「**New Web Service**」→ GitHub リポジトリを接続
3. 設定:

| 項目 | 値 |
|------|-----|
| Root Directory | `shift_sync` |
| Runtime | **Docker** |
| Dockerfile | `shift_sync/Dockerfile` |
| Port | `8000` |

4. 環境変数を設定:

```
SHIFUCON_STAFF_ID=（シフコンのスタッフID）
SHIFUCON_PASSWORD=（シフコンのパスワード）
GOOGLE_CALENDAR_ID=primary
DATABASE_URL=（Render PostgreSQL アドオンのURL）
```

5. デプロイ完了後、`https://your-app.onrender.com` のURLが発行される
6. アプリの設定画面でこのURLを入力

---

## 代替案: GitHub Actions（Mac なしで完結）

Mac が手元にない場合でも、GitHub Actions の無料 macOS ランナーを使えばクラウドでビルドできます。

### `.github/workflows/ios_build.yml`

```yaml
name: iOS Build (Free Apple ID)

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Unity Build
        uses: game-ci/unity-builder@v4
        env:
          UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}
        with:
          projectPath: UnityApp/ShiftSync
          targetPlatform: iOS
          buildName: ShiftSync

      - name: Upload IPA artifact
        uses: actions/upload-artifact@v4
        with:
          name: ShiftSync-iOS
          path: build/iOS/
```

> [!IMPORTANT]
> GameCI を使うには Unity の個人ライセンスが必要です（無料）。  
> [GameCI ドキュメント](https://game.ci/docs/github/getting-started) を参照。

---

## よくある問題

### 「Untrusted Developer」と表示される
→ iPhone の **設定 → 一般 → VPNとデバイス管理** → 証明書を信頼する

### AltServer が IPA を認識しない
→ iTunes（またはAppleデバイスドライバ）が最新版であることを確認

### Unity Cloud Build がビルドに失敗する
→ Bundle ID が Provisioning Profile と一致しているか確認  
→ Unity バージョンが正確に一致しているか確認

### Chromium（スクレイピング）がサーバーで動かない
→ Dockerfile の `chromium` インストールが正常か Render のビルドログを確認
