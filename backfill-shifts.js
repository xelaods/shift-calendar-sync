/**
 * 2026年1月1日から今日までのシフトをGoogleカレンダーに一括追加するスクリプト
 * 既に追加済みのイベントはIDベースでスキップ（重複防止）
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');
const SHIFTS_PATH = path.join(__dirname, 'shifts.json');

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

function generateEventId(shift) {
  return `shift${shift.date.replace(/-/g, '')}${shift.start.replace(':', '')}`;
}

async function main() {
  // 認証
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_id, client_secret } = credentials.installed || credentials.web;
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/callback');
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  oauth2Client.setCredentials(tokens);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // シフトデータ読み込み
  const shiftData = JSON.parse(fs.readFileSync(SHIFTS_PATH, 'utf-8'));

  // 2026-01-01 から今日までのシフトをフィルタ
  const startDate = new Date('2026-01-01T00:00:00+09:00');
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const targetShifts = shiftData.shifts.filter(shift => {
    const d = new Date(shift.date + 'T00:00:00+09:00');
    return d >= startDate && d <= today;
  });

  console.log(`📅 ${shiftData.employee.name} - ${shiftData.employee.store} / ${shiftData.employee.position}`);
  console.log(`📆 2026/01/01 ～ 今日 のシフトを一括追加します`);
  console.log(`   対象: ${targetShifts.length}件`);
  console.log('');

  let added = 0, skipped = 0, errors = 0;

  for (const shift of targetShifts) {
    const eventId = generateEventId(shift);
    const startDateTime = toRFC3339(shift.date, shift.start);
    const endDateTime = toRFC3339(shift.date, shift.end);

    const event = {
      id: eventId,
      summary: 'ドンキ',
      description: `葛西店 / レジ シフト\n${shift.start} ～ ${shift.end}`,
      location: '葛西店',
      start: { dateTime: startDateTime, timeZone: 'Asia/Tokyo' },
      end: { dateTime: endDateTime, timeZone: 'Asia/Tokyo' },
      reminders: { useDefault: false, overrides: [] }, // 過去のシフトにはリマインダー不要
    };

    try {
      // 重複チェック: イベントIDで既存確認
      try {
        await calendar.events.get({ calendarId: 'primary', eventId: eventId });
        console.log(`  ⏭️  スキップ (既存): ${shift.date} ${shift.start}-${shift.end}`);
        skipped++;
        continue;
      } catch (e) {
        // 404 = イベントなし → 新規作成
      }

      await calendar.events.insert({ calendarId: 'primary', requestBody: event });
      console.log(`  ✅ 追加完了: ${shift.date} ${shift.start}-${shift.end}`);
      added++;
    } catch (err) {
      console.error(`  ❌ エラー: ${shift.date} ${shift.start}-${shift.end} - ${err.message}`);
      errors++;
    }

    // APIレート制限を避けるために少し待機
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('');
  console.log('===== 一括追加結果 =====');
  console.log(`  ✅ 追加: ${added}件`);
  console.log(`  ⏭️  スキップ: ${skipped}件`);
  if (errors > 0) console.log(`  ❌ エラー: ${errors}件`);
  console.log('========================');
}

main().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
