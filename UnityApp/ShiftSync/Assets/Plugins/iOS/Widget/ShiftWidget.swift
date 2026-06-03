import WidgetKit
import SwiftUI
import Foundation

// ─── App Group の定数 ───
private let appGroupID = "group.com.yourname.shiftsync"
private let sharedKey  = "today_shifts_json"

// ─── データモデル ───

struct WidgetShift: Codable {
    let date: String       // "2026-06-01"
    let startTime: String  // "09:00"
    let endTime: String    // "17:00"
    let storeName: String
}

// ─── タイムラインエントリ ───

struct ShiftEntry: TimelineEntry {
    let date: Date
    let shifts: [WidgetShift]
}

// ─── タイムラインプロバイダー ───

struct ShiftProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShiftEntry {
        ShiftEntry(date: Date(), shifts: [
            WidgetShift(date: "", startTime: "09:00", endTime: "17:00", storeName: "ドン・キホーテ")
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (ShiftEntry) -> Void) {
        completion(ShiftEntry(date: Date(), shifts: loadShifts()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShiftEntry>) -> Void) {
        let shifts = loadShifts()
        let entry  = ShiftEntry(date: Date(), shifts: shifts)

        // 次の更新は翌朝 6:00
        var nextUpdate = Calendar.current.startOfDay(for: Date())
        nextUpdate = Calendar.current.date(byAdding: .day, value: 1, to: nextUpdate)!
        nextUpdate = Calendar.current.date(bySettingHour: 6, minute: 0, second: 0, of: nextUpdate)!

        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadShifts() -> [WidgetShift] {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let json = defaults.string(forKey: sharedKey),
              let data = json.data(using: .utf8) else {
            return []
        }
        return (try? JSONDecoder().decode([WidgetShift].self, from: data)) ?? []
    }
}

// ─── ウィジェット UI ───

struct ShiftWidgetEntryView: View {
    var entry: ShiftEntry

    private var todayShifts: [WidgetShift] {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let today = formatter.string(from: Date())
        return entry.shifts.filter { $0.date == today }
    }

    var body: some View {
        ZStack {
            // 背景グラデーション
            LinearGradient(
                colors: [Color(hex: "1a1a2e"), Color(hex: "16213e")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            if todayShifts.isEmpty {
                // シフトなし
                VStack(spacing: 4) {
                    Image(systemName: "calendar.badge.checkmark")
                        .font(.system(size: 28))
                        .foregroundColor(.gray)
                    Text("今日のシフトなし")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.gray)
                }
            } else {
                // シフトあり
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "calendar")
                            .foregroundColor(Color(hex: "4ecdc4"))
                        Text("今日のシフト")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.white.opacity(0.7))
                    }

                    ForEach(todayShifts.prefix(2), id: \.startTime) { shift in
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color(hex: "4ecdc4"))
                                .frame(width: 3, height: 28)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(shift.startTime)〜\(shift.endTime)")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(.white)
                                Text(shift.storeName)
                                    .font(.system(size: 10))
                                    .foregroundColor(.white.opacity(0.6))
                            }
                        }
                    }
                }
                .padding(12)
            }
        }
        .containerBackground(for: .widget) {
            Color(hex: "1a1a2e")
        }
    }
}

// ─── ウィジェット定義 ───

struct ShiftWidget: Widget {
    let kind: String = "ShiftWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ShiftProvider()) { entry in
            ShiftWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("シフト確認")
        .description("今日のシフトをホーム画面で確認できます")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// ─── ユーティリティ ───

extension Color {
    init(hex: String) {
        let hex    = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int    = UInt64()
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:  (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:  (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:  (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
