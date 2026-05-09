/**
 * Google Calendar シフト自動同期スクリプト
 * 
 * 機能:
 * - shifts.json から当日を含む5日分のシフトを自動的にGoogleカレンダーに追加
 * - 既に追加済みのシフトはスキップ（重複防止）
 * - OAuth2認証によるAPI自動連携
 * 
 * 使い方:
 *   初回: node calendar-sync.js --auth   (ブラウザでGoogle認証)
 *   同期: node calendar-sync.js           (シフトをカレンダーに追加)
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

// ===== 設定 =====
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SHIFTS_PATH = path.join(__dirname, 'shifts.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const REDIRECT_PORT = 3000;
const DAYS_TO_SYNC = 5; // 当日から何日分を同期するか

// ===== ユーティリティ =====

/**
 * 日付文字列をDate オブジェクトに変換（日本時間ベース）
 */
function parseShiftDateTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  let [hour, minute] = timeStr.split(':').map(Number);

  // 24:00 は翌日の 00:00 として扱う
  if (hour === 24) {
    const d = new Date(year, month - 1, day + 1, 0, minute);
    return d;
  }
  return new Date(year, month - 1, day, hour, minute);
}

/**
 * RFC3339 形式の日時文字列を生成（JST タイムゾーン付き）
 */
function toRFC3339(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  let [hour, minute] = timeStr.split(':').map(Number);

  let y = year, m = month, d = day;
  if (hour === 24) {
    const temp = new Date(year, month - 1, day + 1, 0, minute);
    y = temp.getFullYear();
    m = temp.getMonth() + 1;
    d = temp.getDate();
    hour = 0;
  }

  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}T${pad(hour)}:${pad(minute)}:00+09:00`;
}

/**
 * 当日から指定日数分のシフトを取得
 */
function getUpcomingShifts(shifts, days) {
  // 現在時刻をJSTとして取得し、今日の0時0分を作成
  const now = new Date();
  const jstFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = jstFormatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  const today = new Date(`${year}-${month}-${day}T00:00:00+09:00`);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  return shifts.filter(shift => {
    const shiftDate = new Date(shift.date + 'T00:00:00+09:00');
    return shiftDate >= today && shiftDate < endDate;
  });
}

/**
 * シフトのユニークIDを生成
 */
function generateEventId(shift) {
  // Google Calendar のイベントIDは小文字英数字とハイフンのみ
  return `shift${shift.date.replace(/-/g, '')}${shift.start.replace(':', '')}`;
}

// ===== OAuth2 認証 =====

/**
 * OAuth2 クライアントを作成
 */
function createOAuth2Client() {
  let credentials;
  if (process.env.GOOGLE_CREDENTIALS_B64) {
    const jsonStr = Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, 'base64').toString('utf-8');
    credentials = JSON.parse(jsonStr);
  } else if (fs.existsSync(CREDENTIALS_PATH)) {
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  } else {
    console.error('❌ credentials.json が見つかりません。');
    console.error('');
    console.error('Google Cloud Console で OAuth2 クライアントIDを作成し、');
    console.error('credentials.json としてこのディレクトリに保存してください。');
    console.error('');
    console.error('手順:');
    console.error('1. https://console.cloud.google.com/apis/credentials にアクセス');
    console.error('2. 「認証情報を作成」→「OAuth クライアント ID」を選択');
    console.error('3. アプリケーションの種類:「デスクトップ アプリ」を選択');
    console.error('4. 作成後、JSONをダウンロードして credentials.json として保存');
    process.exit(1);
  }

  const { client_id, client_secret } = credentials.installed || credentials.web;
  const redirect_uri = `http://localhost:${REDIRECT_PORT}/callback`;

  return new google.auth.OAuth2(client_id, client_secret, redirect_uri);
}

/**
 * ブラウザで認証フローを実行
 */
async function authenticate(oauth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });

    console.log('🔗 以下のURLをブラウザで開いて認証してください:');
    console.log('');
    console.log(authUrl);
    console.log('');

    // ローカルサーバーでコールバックを受信
    const server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url, true);
      if (parsedUrl.pathname === '/callback') {
        const code = parsedUrl.query.code;
        if (code) {
          try {
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<html><body><h1>✅ 認証成功！</h1><p>このページを閉じてください。</p></body></html>');
            console.log('✅ 認証成功！トークンを保存しました。');
            server.close();
            resolve(oauth2Client);
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<html><body><h1>❌ 認証エラー</h1></body></html>');
            reject(err);
            server.close();
          }
        }
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`📡 認証コールバック待機中 (http://localhost:${REDIRECT_PORT}/callback)`);
      // 自動でブラウザを開く
      const { exec } = require('child_process');
      exec(`start "" "${authUrl}"`);
    });
  });
}

/**
 * 保存済みトークンを読み込む
 */
function loadToken(oauth2Client) {
  if (process.env.GOOGLE_TOKEN_B64) {
    const jsonStr = Buffer.from(process.env.GOOGLE_TOKEN_B64, 'base64').toString('utf-8');
    const tokens = JSON.parse(jsonStr);
    oauth2Client.setCredentials(tokens);
    return true;
  }
  if (!fs.existsSync(TOKEN_PATH)) {
    return false;
  }
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  oauth2Client.setCredentials(tokens);
  return true;
}

// ===== カレンダー操作 =====

/**
 * 既存のシフトイベントを確認
 */
async function getExistingEvents(calendar, timeMin, timeMax) {
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    q: 'ドンキ',
  });
  return res.data.items || [];
}

/**
 * シフトをGoogleカレンダーに追加
 */
async function addShiftToCalendar(calendar, shift) {
  const eventId = generateEventId(shift);
  const startDateTime = toRFC3339(shift.date, shift.start);
  const endDateTime = toRFC3339(shift.date, shift.end);

  const event = {
    id: eventId,
    summary: 'ドンキ',
    description: `葛西店 / レジ シフト\n${shift.start} ～ ${shift.end}`,
    location: '葛西店',
    start: {
      dateTime: startDateTime,
      timeZone: 'Asia/Tokyo',
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'Asia/Tokyo',
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  };

  try {
    // まず既存のイベントを確認
    try {
      await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });
      console.log(`  ⏭️  スキップ (既存): ${shift.date} ${shift.start}-${shift.end}`);
      return 'skipped';
    } catch (e) {
      // イベントが見つからない = 新規作成
    }

    // イベントを作成
    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });
    console.log(`  ✅ 追加完了: ${shift.date} ${shift.start}-${shift.end}`);
    return 'added';
  } catch (err) {
    console.error(`  ❌ エラー: ${shift.date} ${shift.start}-${shift.end} - ${err.message}`);
    return 'error';
  }
}

// ===== メイン処理 =====

async function main() {
  const args = process.argv.slice(2);
  const isAuth = args.includes('--auth');

  // OAuth2 クライアント作成
  const oauth2Client = createOAuth2Client();

  if (isAuth) {
    // 認証モード
    console.log('🔐 Google Calendar API 認証を開始します...');
    await authenticate(oauth2Client);
    console.log('');
    console.log('認証完了！次回から以下のコマンドでシフトを同期できます:');
    console.log('  node calendar-sync.js');
    return;
  }

  // トークン読み込み
  if (!loadToken(oauth2Client)) {
    console.error('❌ 認証されていません。まず以下のコマンドで認証してください:');
    console.error('  node calendar-sync.js --auth');
    process.exit(1);
  }

  // シフトデータ読み込み
  if (!fs.existsSync(SHIFTS_PATH)) {
    console.error('❌ shifts.json が見つかりません。');
    process.exit(1);
  }

  const shiftData = JSON.parse(fs.readFileSync(SHIFTS_PATH, 'utf-8'));
  const upcomingShifts = getUpcomingShifts(shiftData.shifts, DAYS_TO_SYNC);

  if (upcomingShifts.length === 0) {
    console.log('📅 今日から5日間にシフトはありません。');
    return;
  }

  console.log(`📅 ${shiftData.employee.name} - ${shiftData.employee.store} / ${shiftData.employee.position}`);
  console.log(`📆 今日から${DAYS_TO_SYNC}日分のシフトをGoogleカレンダーに同期します...`);
  console.log(`   対象: ${upcomingShifts.length}件`);
  console.log('');

  // Google Calendar API 初期化
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  let added = 0, skipped = 0, errors = 0;

  for (const shift of upcomingShifts) {
    const result = await addShiftToCalendar(calendar, shift);
    if (result === 'added') added++;
    else if (result === 'skipped') skipped++;
    else errors++;
  }

  console.log('');
  console.log('===== 同期結果 =====');
  console.log(`  ✅ 追加: ${added}件`);
  console.log(`  ⏭️  スキップ: ${skipped}件`);
  if (errors > 0) console.log(`  ❌ エラー: ${errors}件`);
  console.log('==================');
}

main().catch(err => {
  console.error('エラーが発生しました:', err.message);
  process.exit(1);
});
