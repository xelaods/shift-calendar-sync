// ============================================================
//  シフト受取 & Googleカレンダー追加用 GAS Web API
// ============================================================

var EVENT_TITLE = "シフト";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var shifts = data.shifts;

    if (!shifts || shifts.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "シフトデータが空です" }))
             .setMimeType(ContentService.MimeType.JSON);
    }

    var calendar = CalendarApp.getDefaultCalendar();
    var addedCount = 0;
    var updatedCount = 0;

    for (var i = 0; i < shifts.length; i++) {
      var s = shifts[i];
      var startDate = new Date(s.start);
      var endDate = new Date(s.end);

      var existingEvents = calendar.getEvents(
        new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0),
        new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59)
      );

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

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      added: addedCount,
      updated: updatedCount
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
           .setMimeType(ContentService.MimeType.JSON);
  }
}
