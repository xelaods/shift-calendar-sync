const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SHIFTS_PATH = path.join(__dirname, 'shifts.json');

async function scrapeShifts() {
  const loginId = process.env.SHIFUCON_ID;
  const loginPass = process.env.SHIFUCON_PASS;

  if (!loginId || !loginPass) {
    console.error('❌ 環境変数 SHIFUCON_ID または SHIFUCON_PASS が設定されていません。');
    process.exit(1);
  }

  console.log('🌐 ブラウザを起動しています...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // ログインページへ
  console.log('🔑 ログインページにアクセスしています...');
  await page.goto('https://shifucon.ppihgroup.com/staffpage/?', { waitUntil: 'networkidle2' });
  
  await page.type('#login_email', loginId);
  await page.type('#login_pass', loginPass);
  
  console.log('🔄 ログイン処理中...');
  await Promise.all([
    page.click('input[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);
  
  const title = await page.title();
  if (!title.includes('従業員ページ')) {
    console.error('❌ ログインに失敗しました。認証情報を確認してください。');
    await browser.close();
    process.exit(1);
  }
  console.log('✅ ログイン成功！シフトを取得します...');

  let newShifts = [];
  
  // 現在のページから3回（約6週間分）「次へ」を押してシフトを取得
  for (let pageNum = 1; pageNum <= 3; pageNum++) {
    console.log(`📅 ページ ${pageNum}/3 を解析中...`);
    
    const extracted = await page.evaluate(() => {
      const shifts = [];
      for (let i = 0; i < 42; i++) {
        const dateInput = document.getElementById('select_date' + i);
        if (!dateInput) continue;
        
        const dateVal = dateInput.value;
        if (!dateVal) continue;
        const formattedDate = dateVal.substring(0, 4) + '-' + dateVal.substring(4, 6) + '-' + dateVal.substring(6, 8);
        
        const shiftTypeInput = document.getElementById('shift_type' + i);
        const shiftType = shiftTypeInput ? shiftTypeInput.value : '';
        
        // shift_type === '1' が出勤
        if (shiftType === '1') {
          const fromH = document.getElementById('from_hour' + i).value;
          const fromM = document.getElementById('from_minutes' + i).value;
          const toH = document.getElementById('to_hour' + i).value;
          const toM = document.getElementById('to_minutes' + i).value;
          
          if (fromH && fromM && toH && toM) {
            shifts.push({
              date: formattedDate,
              start: `${fromH.padStart(2, '0')}:${fromM.padStart(2, '0')}`,
              end: `${toH.padStart(2, '0')}:${toM.padStart(2, '0')}`
            });
          }
        }
      }
      return shifts;
    });
    
    newShifts = newShifts.concat(extracted);
    
    if (pageNum < 3) {
      console.log('▶️ 次の期間へ移動...');
      await Promise.all([
        page.click('#date-next'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
    }
  }

  await browser.close();
  console.log(`✅ 計 ${newShifts.length} 件のシフトを取得しました。`);

  // 取得したシフトを既存の shifts.json とマージする
  if (fs.existsSync(SHIFTS_PATH)) {
    const data = JSON.parse(fs.readFileSync(SHIFTS_PATH, 'utf-8'));
    const existingShifts = data.shifts || [];
    
    // 今回取得した期間の日付リストを作成
    const scrapedDates = [...new Set(newShifts.map(s => s.date))];
    
    // 既存シフトの中から、今回取得した期間「以外」のものを残す
    const mergedShifts = existingShifts.filter(s => !scrapedDates.includes(s.date));
    
    // 新しく取得したシフトを追加
    mergedShifts.push(...newShifts);
    
    // 日付順にソート
    mergedShifts.sort((a, b) => a.date.localeCompare(b.date));
    
    data.shifts = mergedShifts;
    
    fs.writeFileSync(SHIFTS_PATH, JSON.stringify(data, null, 2));
    console.log(`💾 shifts.json を更新しました（全 ${mergedShifts.length} 件）。`);
  } else {
    console.error('❌ shifts.json が見つかりません。');
    process.exit(1);
  }
}

scrapeShifts().catch(err => {
  console.error('❌ スクリプト実行エラー:', err);
  process.exit(1);
});
