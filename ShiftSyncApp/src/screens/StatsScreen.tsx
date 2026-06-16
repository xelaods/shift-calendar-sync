import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, Radius } from '../theme/liquidGlass';
import { fetchMonthlyStats, MonthlyStats } from '../api/client';

export default function StatsScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (y: number, m: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMonthlyStats(y, m);
      setStats(data);
    } catch (e: any) {
      setError(e.message || 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadStats(year, month);
  }, [year, month]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats(year, month);
    setRefreshing(false);
  };

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  // バーグラフ用：daily_hours から上位6件
  const dailyEntries = stats
    ? Object.entries(stats.daily_hours).sort((a, b) => a[0].localeCompare(b[0]))
    : [];
  const maxHours = dailyEntries.length > 0 ? Math.max(...dailyEntries.map(([, v]) => v)) : 8;

  return (
    <View style={styles.container}>
      <View style={styles.bgBlob1} />
      <View style={styles.bgBlob2} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.blue} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthBtn}>
              <Text style={styles.monthBtnText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>統計</Text>
              <Text style={styles.headerSub}>{year}年{month}月</Text>
            </View>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthBtn}>
              <Text style={styles.monthBtnText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.blue} />
            <Text style={styles.loadingText}>読み込み中...</Text>
          </View>
        )}

        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={() => loadStats(year, month)}>
            <Text style={styles.errorText}>⚠️ {error}　タップして再試行</Text>
          </TouchableOpacity>
        )}

        {/* Stats Grid */}
        {stats && (
          <>
            <View style={styles.statsGrid}>
              {[
                { label: '出勤日数', value: `${stats.total_shifts}日`, icon: '📅', color: Colors.blue },
                { label: '総勤務時間', value: `${stats.total_hours}h`, icon: '⏰', color: Colors.green },
                { label: '概算収入', value: `¥${Math.round(stats.estimated_income).toLocaleString()}`, icon: '💴', color: Colors.orange },
                { label: '時給', value: `¥${Math.round(stats.hourly_wage)}`, icon: '📊', color: Colors.purple },
              ].map((item) => (
                <View key={item.label} style={styles.statCard}>
                  <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
                  <View style={styles.hl} />
                  <View style={styles.statContent}>
                    <Text style={styles.statIcon}>{item.icon}</Text>
                    <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                    <Text style={styles.statLabel}>{item.label}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Bar Chart */}
            {dailyEntries.length > 0 && (
              <View style={styles.chartCard}>
                <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
                <View style={styles.hl} />
                <View style={styles.chartContent}>
                  <Text style={styles.chartTitle}>日別勤務時間</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.bars}>
                      {dailyEntries.map(([date, hours]) => (
                        <View key={date} style={styles.barItem}>
                          <Text style={styles.barValue}>{hours}h</Text>
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { height: `${(hours / maxHours) * 100}%` }]} />
                          </View>
                          <Text style={styles.barDate}>{date.slice(5)}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            )}

            {/* Shift List */}
            {stats.shift_dates.length > 0 && (
              <View style={styles.listCard}>
                <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
                <View style={styles.hl} />
                <View style={styles.listContent}>
                  <Text style={styles.listTitle}>勤務日一覧</Text>
                  {stats.shift_dates.map((date, i) => {
                    const hours = stats.daily_hours[date] || 0;
                    const earnings = Math.round(hours * stats.hourly_wage);
                    return (
                      <View key={date} style={[styles.listItem, i < stats.shift_dates.length - 1 && styles.listItemBorder]}>
                        <View>
                          <Text style={styles.listDate}>{date}</Text>
                          <Text style={styles.listHoursText}>{hours}時間勤務</Text>
                        </View>
                        <Text style={styles.listEarnings}>¥{earnings.toLocaleString()}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {stats.total_shifts === 0 && !loading && (
              <View style={styles.emptyCard}>
                <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
                <View style={styles.hl} />
                <View style={styles.emptyContent}>
                  <Text style={styles.emptyIcon}>📭</Text>
                  <Text style={styles.emptyText}>この月のシフトデータがありません</Text>
                  <Text style={styles.emptySub}>同期タブからシフトを取得してください</Text>
                </View>
              </View>
            )}
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bgBlob1: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(88,86,214,0.07)', top: -60, right: -60 },
  bgBlob2: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,149,0,0.06)', bottom: 80, left: -60 },
  hl: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { ...Typography.largeTitle, textAlign: 'center' },
  headerSub: { ...Typography.callout, color: Colors.labelSecondary, textAlign: 'center' },
  monthBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthBtnText: { fontSize: 28, color: Colors.blue, fontWeight: '300' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, gap: 8 },
  loadingText: { ...Typography.caption, color: Colors.labelSecondary },
  errorBanner: { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, backgroundColor: Colors.coralLight, borderRadius: Radius.md, padding: Spacing.md },
  errorText: { ...Typography.footnote, color: Colors.coral },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: { width: '47%', borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  statContent: { padding: Spacing.lg, alignItems: 'center' },
  statIcon: { fontSize: 28, marginBottom: Spacing.sm },
  statValue: { ...Typography.title2, marginBottom: 2 },
  statLabel: { ...Typography.caption, color: Colors.labelSecondary },
  chartCard: { marginHorizontal: Spacing.md, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden', marginBottom: Spacing.md },
  chartContent: { padding: Spacing.xl },
  chartTitle: { ...Typography.headline, marginBottom: Spacing.lg },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: Spacing.md },
  barItem: { alignItems: 'center', width: 40 },
  barValue: { ...Typography.caption2, color: Colors.labelSecondary, marginBottom: 4 },
  barBg: { width: 28, height: 80, backgroundColor: Colors.glassSubtle, borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: Colors.blue, borderRadius: 8 },
  barDate: { ...Typography.caption2, color: Colors.labelTertiary, marginTop: 6, fontSize: 10 },
  listCard: { marginHorizontal: Spacing.md, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden', marginBottom: Spacing.md },
  listContent: { padding: Spacing.xl },
  listTitle: { ...Typography.headline, marginBottom: Spacing.lg },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md },
  listItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.separator },
  listDate: { ...Typography.callout, fontWeight: '600', marginBottom: 2 },
  listHoursText: { ...Typography.caption, color: Colors.labelSecondary },
  listEarnings: { ...Typography.callout, color: Colors.blue, fontWeight: '700' },
  emptyCard: { marginHorizontal: Spacing.md, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden' },
  emptyContent: { padding: Spacing.xxxl, alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { ...Typography.callout, fontWeight: '600', marginBottom: Spacing.sm, textAlign: 'center' },
  emptySub: { ...Typography.caption, color: Colors.labelSecondary, textAlign: 'center' },
});
