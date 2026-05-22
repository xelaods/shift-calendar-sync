# シフコン → Google カレンダー 自動登録ツール

ドン・キホーテのシフト管理サイト **シフコン** からシフトを取得して、  
**Google カレンダー（プライマリ）** に自動登録するツールです。

---

## 📋 セットアップ手順

### ステップ 1: Python のインストール確認

```powershell
python --version
```

Python 3.10 以上が必要です。  
インストールされていない場合は https://www.python.org/downloads/ からインストールしてください。

---

### ステップ 2: ライブラリのインストール

```powershell
cd c:\vscodeapp\shift_sync
pip install -r requirements.txt
```

> **注意**: Chrome ブラウザがインストールされている必要があります。  
> ChromeDriver は `webdriver-manager` が自動でダウンロードします。

---

### ステップ 3: Google Cloud Console の設定

> Google カレンダーに書き込む権限を取得するために必要な手順です。

#### 3-1. Google Cloud Console にアクセス
1. https://console.cloud.google.com/ を開く
2. Google アカウントでログイン（Gmailアカウントで OK）

#### 3-2. プロジェクトを作成
1. 左上の「プロジェクトを選択」をクリック
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例: `shift-calendar-sync`）→「作成」

#### 3-3. Google カレンダー API を有効化
1. 左メニュー → 「APIとサービス」→「ライブラリ」
2. 検索ボックスに「Google Calendar API」と入力
3. 「Google Calendar API」をクリック → 「有効にする」

#### 3-4. OAuth 同意画面を設定
1. 左メニュー → 「APIとサービス」→「OAuth 同意画面」
2. 「外部」を選択 → 「作成」
3. アプリ名に「シフト同期」などを入力
4. サポートメールにあなたのメールアドレスを入力
5. 「保存して次へ」を3回クリック（スコープ・テストユーザーはデフォルトで OK）

#### 3-5. 認証情報（credentials.json）を作成
1. 左メニュー → 「APIとサービス」→「認証情報」
2. 「認証情報を作成」→「OAuth クライアント ID」
3. アプリケーションの種類: **「デスクトップ アプリ」** を選択
4. 名前を入力（例: `shift-sync-desktop`）→「作成」
5. ダウンロードボタン（⬇）をクリックして JSON をダウンロード
6. ダウンロードしたファイルを **`credentials.json`** という名前で  
   `c:\vscodeapp\shift_sync\` フォルダに保存

---

### ステップ 4: 環境変数の確認

`.env` ファイルが以下の内容になっていることを確認してください：

```
SHIFUCON_STAFF_ID=0332388
SHIFUCON_PASSWORD=hs628496
GOOGLE_CALENDAR_ID=primary
SHIFT_EVENT_PREFIX=シフト
```

---

## 🚀 使い方

### 当月のシフトを同期

```powershell
cd c:\vscodeapp\shift_sync
python main.py
```

### 特定の月を指定して同期

```powershell
python main.py --year 2026 --month 6
```

### ブラウザを表示しながら実行（デバッグ用）

```powershell
python main.py --visible
```

---

## 🔄 自動実行（Windowsタスクスケジューラ）

毎週自動でシフトを同期したい場合：

1. スタートメニューで「タスク スケジューラ」を検索して開く
2. 右側の「基本タスクの作成」をクリック
3. 名前: `シフト自動同期`
4. トリガー: 「毎週」→ 好きな曜日・時刻を設定
5. 操作: 「プログラムの開始」
   - プログラム: `python`
   - 引数: `c:\vscodeapp\shift_sync\main.py`
   - 開始: `c:\vscodeapp\shift_sync`
6. 「完了」をクリック

---

## 📁 ファイル構成

```
shift_sync/
├── main.py            # 実行ファイル（これを実行する）
├── scraper.py         # シフコンのスクレイピング
├── calendar_sync.py   # Google カレンダーへの登録
├── config.py          # 設定管理
├── requirements.txt   # 依存ライブラリ
├── .env               # ログイン情報（Git に含めない）
├── credentials.json   # Google Cloud からダウンロード（Git に含めない）
└── token.json         # 自動生成される認証トークン（Git に含めない）
```

---

## ⚠️ 注意事項

- `.env` と `credentials.json` は絶対に Git にコミットしないでください（`.gitignore` で除外済み）
- シフコンのサイト構造が変更された場合、`scraper.py` の修正が必要になることがあります
- 問題が発生した場合は `--visible` オプションでブラウザを表示して動作を確認してください
- `debug_shift_page.html` にスクレイピング時のHTMLが保存されます（トラブルシューティング用）
