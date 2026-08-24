// ============================================================
//  PPIH シフト自動取得 & Googleカレンダー同期 (GAS完全自律版)
// ============================================================

// 🔑 ログイン情報
var LOGIN_ID = "0332388";
var LOGIN_PASSWORD = "hs628496";

// 📅 同期設定
var SYNC_DAYS = 30;          // 取得日数 (30日先まで取得)
var EVENT_TITLE = "シフト";   // カレンダー上のタイトル

var LOGIN_URL = "https://shifucon.ppihgroup.com/staffpage/";
var LOGIN_ACTION_URL = "https://shifucon.ppihgroup.com/frontparts/login_check.php";

/**
 * ⏰ 毎日自動実行するメイン関数
 * (GASの「トリガー」からこの関数を毎日定期実行するように設定してください)
 */
function autoSyncShift() {
  Logger.log("=== シフト自動同期処理開始 ===");
  try {
    var shifts = fetchShiftsFromPPIH();
    if (shifts && shifts.length > 0) {
      var result = saveShiftsToCalendar(shifts);
      Logger.log("🎉 同期完了: 追加 " + result.added + "件 / 更新 " + result.updated + "件");
    } else {
      Logger.log("ℹ️ 対象期間内のシフトはありませんでした。");
    }
  } catch (err) {
    Logger.log("❌ エラー発生: " + err.toString());
  }
  Logger.log("=== 終了 ===");
}

/**
 * PPIHサイトからシフト情報をスクレイピング
 */
function fetchShiftsFromPPIH() {
  // 1. ログインページの取得 (transactionid と Cookie 取得)
  Logger.log("1. ログインページ取得中...");
  var res1 = UrlFetchApp.fetch(LOGIN_URL, {
    muteHttpExceptions: true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    }
  });

  if (res1.getResponseCode() !== 200) {
    throw new Error("ログインページ取得失敗 (HTTP " + res1.getResponseCode() + ")");
  }

  var html1 = res1.getContentText();
  var cookies = extractCookies(res1.getAllHeaders());

  var transactionIdMatch = html1.match(/name="transactionid"\s+value="([^"]+)"/);
  var urlMatch = html1.match(/name="url"\s+value="([^"]*)"/);

  if (!transactionIdMatch) {
    throw new Error("transactionidの取得に失敗しました");
  }

  var transactionId = transactionIdMatch[1];
  var urlVal = urlMatch ? urlMatch[1] : "";

  // 2. ログイン実行
  Logger.log("2. ログイン実行中...");
  var payload = {
    "login_email": LOGIN_ID,
    "login_pass": LOGIN_PASSWORD,
    "transactionid": transactionId,
    "mode": "login",
    "url": urlVal,
    "is_tablet": ""
  };

  var res2 = UrlFetchApp.fetch(LOGIN_ACTION_URL, {
    method: "post",
    payload: payload,
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      "Cookie": cookies,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    }
  });

  var html2 = res2.getContentText();
  var newCookies = extractCookies(res2.getAllHeaders());
  if (newCookies) {
    cookies = cookies + "; " + newCookies;
  }

  if (html2.indexOf("login_email") !== -1 && html2.indexOf("from_hour0") === -1) {
    throw new Error("ログインに失敗しました。IDとパスワードを確認してください。");
  }
  Logger.log("✅ ログイン成功！");

  // 3. シフトデータの取得
  var shifts = [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var endDate = new Date(today.getTime() + (SYNC_DAYS * 24 * 60 * 60 * 1000));
  var pages = Math.floor(SYNC_DAYS / 14) + 1;
  var currentFetchDate = new Date(today.getTime());

  for (var p = 0; p < pages; p++) {
    var dateStr = Utilities.formatDate(currentFetchDate, "Asia/Tokyo", "yyyyMMdd");
    var pageUrl = LOGIN_URL + "?select_date=" + dateStr;
    Logger.log("   シフトデータ取得中 (" + Utilities.formatDate(currentFetchDate, "Asia/Tokyo", "yyyy/MM/dd") + "〜)...");

    var pageRes = UrlFetchApp.fetch(pageUrl, {
      muteHttpExceptions: true,
      headers: {
        "Cookie": cookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
      }
    });

    var pageHtml = pageRes.getContentText();
    var foundAny = false;

    for (var i = 0; i < 14; i++) {
      var dMatch = pageHtml.match(new RegExp('name="select_date' + i + '"[^>]+value="(\\d{8})"', 'i')) ||
                   pageHtml.match(new RegExp('id="select_date' + i + '"[^>]+value="(\\d{8})"', 'i'));
      if (!dMatch) break;

      foundAny = true;
      var dStr = dMatch[1];
      var y = parseInt(dStr.substring(0, 4), 10);
      var m = parseInt(dStr.substring(4, 6), 10) - 1;
      var d = parseInt(dStr.substring(6, 8), 10);
      var shiftDate = new Date(y, m, d, 0, 0, 0);

      if (shiftDate < today || shiftDate >= endDate) {
        continue;
      }

      var holMatch = pageHtml.match(new RegExp('name="holiday_type' + i + '"[^>]+value="(\\d+)"', 'i')) ||
                     pageHtml.match(new RegExp('id="holiday_type' + i + '"[^>]+value="(\\d+)"', 'i'));
      var stMatch = pageHtml.match(new RegExp('name="shift_type' + i + '"[^>]+value="(\\d+)"', 'i')) ||
                    pageHtml.match(new RegExp('id="shift_type' + i + '"[^>]+value="(\\d+)"', 'i'));
      var fhMatch = pageHtml.match(new RegExp('name="from_hour' + i + '"[^>]+value="(\\d+)"', 'i')) ||
                    pageHtml.match(new RegExp('id="from_hour' + i + '"[^>]+value="(\\d+)"', 'i'));
      var fmMatch = pageHtml.match(new RegExp('name="from_minutes' + i + '"[^>]+value="(\\d+)"', 'i')) ||
                    pageHtml.match(new RegExp('id="from_minutes' + i + '"[^>]+value="(\\d+)"', 'i'));
      var thMatch = pageHtml.match(new RegExp('name="to_hour' + i + '"[^>]+value="(\\d+)"', 'i')) ||
                    pageHtml.match(new RegExp('id="to_hour' + i + '"[^>]+value="(\\d+)"', 'i'));
      var tmMatch = pageHtml.match(new RegExp('name="to_minutes' + i + '"[^>]+value="(\\d+)"', 'i')) ||
                    pageHtml.match(new RegExp('id="to_minutes' + i + '"[^>]+value="(\\d+)"', 'i'));

      var holidayType = holMatch ? holMatch[1] : "0";
      var shiftType = stMatch ? stMatch[1] : "0";
      var fromH = fhMatch ? fhMatch[1] : "";
      var fromM = fmMatch ? fmMatch[1] : "00";
      var toH = thMatch ? thMatch[1] : "";
      var toM = tmMatch ? tmMatch[1] : "00";

      var isOff = (holidayType === "1") || (shiftType === "2") || (!fromH && !toH);

      if (!isOff && fromH && toH) {
        var startDt = new Date(y, m, d, parseInt(fromH, 10), parseInt(fromM, 10), 0);
        var endDt = new Date(y, m, d, parseInt(toH, 10), parseInt(toM, 10), 0);
        if (endDt <= startDt) {
          endDt.setDate(endDt.getDate() + 1);
        }

        shifts.push({
          start: startDt,
          end: endDt,
          timeStr: fromH + ":" + fromM + "〜" + toH + ":" + toM
        });
        Logger.log("     📅 " + y + "/" + (m + 1) + "/" + d + ": " + fromH + ":" + fromM + "〜" + toH + ":" + toM);
      }
    }

    if (!foundAny) break;
    currentFetchDate.setDate(currentFetchDate.getDate() + 14);
    if (currentFetchDate >= endDate) break;
  }

  return shifts;
}

/**
 * シフト情報をGoogleカレンダーに保存
 */
function saveShiftsToCalendar(shifts) {
  var calendar = CalendarApp.getDefaultCalendar();
  var addedCount = 0;
  var updatedCount = 0;

  for (var i = 0; i < shifts.length; i++) {
    var s = shifts[i];
    var startDate = s.start;
    var endDate = s.end;

    var dayStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0);
    var dayEnd = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59);

    var existingEvents = calendar.getEvents(dayStart, dayEnd);
    var existingEvent = null;

    for (var k = 0; k < existingEvents.length; k++) {
      if (existingEvents[k].getTitle() === EVENT_TITLE) {
        existingEvent = existingEvents[k];
        break;
      }
    }

    if (existingEvent) {
      existingEvent.setTime(startDate, endDate);
      updatedCount++;
    } else {
      calendar.createEvent(EVENT_TITLE, startDate, endDate, {
        description: "シフト自動同期"
      });
      addedCount++;
    }
  }

  return { added: addedCount, updated: updatedCount };
}

/**
 * 外部PythonからのWebhook受取用 (互換性維持)
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var shifts = data.shifts;
    if (!shifts || shifts.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "シフトデータが空です" })).setMimeType(ContentService.MimeType.JSON);
    }
    var formattedShifts = shifts.map(function(s) {
      return { start: new Date(s.start), end: new Date(s.end) };
    });
    var res = saveShiftsToCalendar(formattedShifts);
    return ContentService.createTextOutput(JSON.stringify({ status: "success", added: res.added, updated: res.updated })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function extractCookies(headers) {
  var cookieList = [];
  for (var key in headers) {
    if (key.toLowerCase() === "set-cookie") {
      var val = headers[key];
      if (Array.isArray(val)) {
        val.forEach(function(c) { cookieList.push(c.split(";")[0]); });
      } else {
        cookieList.push(val.split(";")[0]);
      }
    }
  }
  return cookieList.join("; ");
}
