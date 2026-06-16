import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { BlurView } from 'expo-blur';
import { Calendar, DateData } from 'react-native-calendars';
import { useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, Radius } from '../theme/liquidGlass';
import { fetchShifts, ShiftResponse } from '../api/client';

function buildMarkedDates(shifts: ShiftResponse[], selected: string | null) {
  const marks: Record<string, object> = {};
  shifts.forEach(s => {
    marks[s.date] = {
      marked: true,
      dotColor: Colors.blue,
      selected: s.date === selected,
      selectedColor: Colors.blue,
    };
  });
  if (selected && !marks[selected]) {
    marks[selected] = { selected: true, selectedColor: Colors.blue };
  }
  return marks;
}

function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return Math.round(diff / 60 * 10) / 10;
}

export default function CalendarScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShifts = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShifts(y, m);
      setShifts(data);
    } catch (e: any) {
      setError(e.message || 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  // 画面フォーカス時にリロード
  useFocusEffect(useCallback(() => {
    loadShifts(year, month);
  }, [year, month]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadShifts(year, month);
    setRefreshing(false);
  };

  const handleMonthChange = (m: { year: number; month: number }) => {
    setYear(m.year);
    setMonth(m.month);
    setSelectedDate(null);
    loadShifts(m.year, m.month);
  };

  const selectedShift = selectedDate ? shifts.find(s => s.date === selectedDate) : null;
  const markedDates = buildMarkedDates(shifts, selectedDate);

  const totalHours = shifts.reduce((sum, s) => sum + calcHours(s.start_time, s.end_time), 0);

  return (
    <View style={styles.container}>
      <View style={styles.bgBlob1} />
      <View style={styles.bgBlob2} />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.blue} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>シフトカレンダー</Text>
          <Text style={styles.headerSub}>{year}年{month}月</Text>
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.blue} />
            <Text style={styles.loadingText}>シフトを読み込み中...</Text>
          </View>
        )}

        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={() => loadShifts(year, month)}>
            <Text style={styles.errorText}>⚠️ {error}　タップして再試行</Text>
          </TouchableOpacity>
        )}

        {/* Calendar Card */}
        <View style={styles.calCard}>
          <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={styles.hl} />
          <Calendar
            onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
            onMonthChange={handleMonthChange}
            markedDates={markedDates}
            theme={{
              backgroundColor: 'transparent',
              calendarBackground: 'transparent',
              selectedDayBackgroundColor: Colors.blue,
              selectedDayTextColor: Colors.white,
              todayTextColor: Colors.blue,
              dayTextColor: Colors.label,
              textDisabledColor: Colors.labelTertiary,
              arrowColor: Colors.blue,
              monthTextColor: Colors.label,
              textDayFontWeight: '400',
              textMonthFontWeight: '700',
              textDayHeaderFontWeight: '600',
              textDayFontSize: 15,
              textMonthFontSize: 17,
              textDayHeaderFontSize: 13,
            }}
          />
        </View>

        {/* Selected Shift Detail */}
        {selectedDate && (
          <View style={styles.detailCard}>
            <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={styles.hl} />
            <View style={styles.detailContent}>
              <Text style={styles.detailDate}>{selectedDate}</Text>
              {selectedShift ? (
                <>
                  <View style={styles.detailBadge}>
                    <Text style={styles.detailBadgeText}>勤務あり</Text>
                  </View>
                  <View style={styles.detailInfo}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>時間</Text>
                      <Text style={styles.detailValue}>{selectedShift.start_time} 〜 {selectedShift.end_time}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>時間数</Text>
                      <Text style={styles.detailValue}>{calcHours(selectedShift.start_time, selectedShift.end_time)}時間</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>店舗</Text>
                      <Text style={styles.detailValue}>{selectedShift.store_name || '—'}</Text>
                    </View>
                    {selectedShift.gcal_event_id && (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>GCal</Text>
                        <Text style={[styles.detailValue, { color: Colors.green }]}>✅ 登録済み</Text>
                      </View>
                    )}
                    {selectedShift.note ? (
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>メモ</Text>
                        <Text style={styles.detailValue}>{selectedShift.note}</Text>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : (
                <Text style={styles.noShiftText}>この日のシフトはありません</Text>
              )}
            </View>
          </View>
        )}

        {/* Monthly Summary */}
        <View style={styles.summaryCard}>
          <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={styles.hl} />
          <View style={styles.summaryContent}>
            <Text style={styles.summaryTitle}>今月のまとめ</Text>
            {loading ? (
              <ActivityIndicator color={Colors.blue} />
            ) : (
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{shifts.length}</Text>
                  <Text style={styles.summaryLabel}>出勤日数</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{Math.round(totalHours * 10) / 10}</Text>
                  <Text style={styles.summaryLabel}>合計時間</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {error ? '—' : `¥${Math.round(totalHours * 1050).toLocaleString()}`}
                  </Text>
                  <Text style={styles.summaryLabel}>概算収入</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bgBlob1: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(0,122,255,0.07)', top: -80, right: -80 },
  bgBlob2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(52,199,89,0.06)', bottom: 100, left: -60 },
  hl: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 1 },
  scroll: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.md },
  headerTitle: { ...Typography.largeTitle, marginBottom: 4 },
  headerSub: { ...Typography.callout, color: Colors.labelSecondary },
  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, gap: 8 },
  loadingText: { ...Typography.caption, color: Colors.labelSecondary },
  errorBanner: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, backgroundColor: Colors.coralLight, borderRadius: Radius.md, padding: Spacing.md },
  errorText: { ...Typography.footnote, color: Colors.coral },
  calCard: { marginHorizontal: Spacing.md, marginBottom: Spacing.md, borderRadius: Radius.xxl, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 8 },
  detailCard: { marginHorizontal: Spacing.md, marginBottom: Spacing.md, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden' },
  detailContent: { padding: Spacing.xl },
  detailDate: { ...Typography.headline, marginBottom: Spacing.sm },
  detailBadge: { alignSelf: 'flex-start', backgroundColor: Colors.blueGlass, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: Spacing.md },
  detailBadgeText: { ...Typography.caption, color: Colors.blue, fontWeight: '600' },
  detailInfo: { gap: Spacing.sm },
  detailItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  detailLabel: { ...Typography.callout, color: Colors.labelSecondary },
  detailValue: { ...Typography.callout, fontWeight: '600' },
  noShiftText: { ...Typography.callout, color: Colors.labelSecondary, marginTop: 4 },
  summaryCard: { marginHorizontal: Spacing.md, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden' },
  summaryContent: { padding: Spacing.xl },
  summaryTitle: { ...Typography.headline, marginBottom: Spacing.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { ...Typography.title2, color: Colors.blue, marginBottom: 4 },
  summaryLabel: { ...Typography.caption, color: Colors.labelSecondary },
  summaryDivider: { width: 1, backgroundColor: Colors.separator },
});
