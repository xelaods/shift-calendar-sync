// Generate ICS file for Google Calendar import
// Shift data for 塩中 陽翔 at 葛西店 / レジ

const fs = require('fs');

const shifts = [
  // May 2026 (from today onwards)
  { date: '2026-05-05', start: '20:00', end: '23:00' },
  { date: '2026-05-07', start: '18:30', end: '23:00' },
  { date: '2026-05-08', start: '20:00', end: '24:00' },
  { date: '2026-05-10', start: '19:00', end: '23:00' },
  { date: '2026-05-12', start: '20:00', end: '23:00' },
  { date: '2026-05-14', start: '18:00', end: '23:00' },
  { date: '2026-05-15', start: '10:00', end: '24:00' },
  { date: '2026-05-16', start: '10:00', end: '24:00' },
  { date: '2026-05-17', start: '10:00', end: '23:00' },
  { date: '2026-05-19', start: '20:00', end: '23:00' },
  { date: '2026-05-20', start: '20:00', end: '23:00' },
  { date: '2026-05-21', start: '18:00', end: '23:00' },
  { date: '2026-05-22', start: '10:00', end: '24:00' },
  { date: '2026-05-23', start: '10:00', end: '24:00' },
  { date: '2026-05-24', start: '10:00', end: '23:00' },
  { date: '2026-05-26', start: '20:00', end: '23:00' },
  { date: '2026-05-27', start: '20:00', end: '23:00' },
  { date: '2026-05-28', start: '18:00', end: '23:00' },
  { date: '2026-05-29', start: '10:00', end: '24:00' },
  { date: '2026-05-30', start: '10:00', end: '24:00' },
  { date: '2026-05-31', start: '10:00', end: '23:00' },
  // June 2026
  { date: '2026-06-02', start: '20:00', end: '23:00' },
  { date: '2026-06-03', start: '20:00', end: '23:00' },
  { date: '2026-06-04', start: '18:00', end: '23:00' },
  { date: '2026-06-05', start: '10:00', end: '24:00' },
  { date: '2026-06-06', start: '10:00', end: '24:00' },
  { date: '2026-06-07', start: '10:00', end: '23:00' },
  { date: '2026-06-09', start: '20:00', end: '23:00' },
  { date: '2026-06-10', start: '20:00', end: '23:00' },
  { date: '2026-06-11', start: '18:00', end: '23:00' },
  { date: '2026-06-12', start: '10:00', end: '24:00' },
  { date: '2026-06-13', start: '10:00', end: '24:00' },
  { date: '2026-06-14', start: '10:00', end: '23:00' },
  { date: '2026-06-16', start: '20:00', end: '23:00' },
  { date: '2026-06-17', start: '20:00', end: '23:00' },
  { date: '2026-06-18', start: '18:00', end: '23:00' },
  { date: '2026-06-19', start: '10:00', end: '24:00' },
  { date: '2026-06-20', start: '10:00', end: '24:00' },
  { date: '2026-06-21', start: '10:00', end: '23:00' },
  { date: '2026-06-22', start: '18:00', end: '23:00' },
  { date: '2026-06-23', start: '20:00', end: '23:00' },
  { date: '2026-06-24', start: '20:00', end: '23:00' },
  { date: '2026-06-25', start: '18:00', end: '23:00' },
  { date: '2026-06-26', start: '10:00', end: '24:00' },
  { date: '2026-06-27', start: '10:00', end: '24:00' },
  { date: '2026-06-28', start: '10:00', end: '23:00' },
  { date: '2026-06-29', start: '18:00', end: '23:00' },
  { date: '2026-06-30', start: '20:00', end: '23:00' },
  // July 2026
  { date: '2026-07-01', start: '18:00', end: '23:00' },
  { date: '2026-07-02', start: '18:00', end: '23:00' },
  { date: '2026-07-03', start: '10:00', end: '23:00' },
  { date: '2026-07-04', start: '10:00', end: '23:00' },
];

function formatDateTime(dateStr, timeStr) {
  // Handle "24:00" as "00:00" of the next day
  const [year, month, day] = dateStr.split('-').map(Number);
  let [hour, minute] = timeStr.split(':').map(Number);

  let d = new Date(year, month - 1, day, hour, minute);

  if (hour === 24) {
    d = new Date(year, month - 1, day + 1, 0, minute);
  }

  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function generateUID(dateStr, startStr) {
  return `shift-${dateStr}-${startStr.replace(':', '')}@kasai-register`;
}

let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Shift Calendar//Kasai Store//JP
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:葛西店シフト
X-WR-TIMEZONE:Asia/Tokyo
BEGIN:VTIMEZONE
TZID:Asia/Tokyo
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0900
TZOFFSETTO:+0900
TZNAME:JST
END:STANDARD
END:VTIMEZONE
`;

for (const shift of shifts) {
  const dtStart = formatDateTime(shift.date, shift.start);
  const dtEnd = formatDateTime(shift.date, shift.end);
  const uid = generateUID(shift.date, shift.start);

  icsContent += `BEGIN:VEVENT
DTSTART;TZID=Asia/Tokyo:${dtStart}
DTEND;TZID=Asia/Tokyo:${dtEnd}
SUMMARY:バイト（葛西店 レジ）
DESCRIPTION:葛西店 / レジ シフト
LOCATION:葛西店
UID:${uid}
STATUS:CONFIRMED
END:VEVENT
`;
}

icsContent += `END:VCALENDAR`;

const outputPath = 'c:\\vscodeapp\\kasai_shifts.ics';
fs.writeFileSync(outputPath, icsContent, 'utf-8');
console.log(`✅ ICSファイルを生成しました: ${outputPath}`);
console.log(`📅 合計 ${shifts.length} 件のシフトが含まれています`);
console.log(`📆 期間: ${shifts[0].date} ～ ${shifts[shifts.length - 1].date}`);
