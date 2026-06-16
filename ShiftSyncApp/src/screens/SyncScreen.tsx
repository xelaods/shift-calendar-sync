import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import * as SecureStore from 'expo-secure-store';
import { Colors, Typography, Spacing, Radius } from '../theme/liquidGlass';
import { triggerSync, checkHealth, SyncResponse } from '../api/client';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export default function SyncScreen() {
  const [fetchStatus, setFetchStatus] = useState<SyncStatus>('idle');
  const [gcalStatus, setGcalStatus] = useState<SyncStatus>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [fetchLog, setFetchLog] = useState<string[]>([]);
  const [gcalLog, setGcalLog] = useState<string[]>([]);
  const [fetchResult, setFetchResult] = useState<SyncResponse | null>(null);
  const [gcalResult, setGcalResult] = useState<SyncResponse | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth().then(ok => setServerOk(ok));
    SecureStore.getItemAsync('last_sync').then(v => setLastSync(v));
  }, []);

  const addFetchLog = (line: string) => setFetchLog(prev => [...prev, line]);
  const addGcalLog  = (line: string) => setGcalLog(prev  => [...prev, line]);

  // ─── シフト取得（DB保存のみ）───
  const handleFetchShifts = async () => {
    if (serverOk === false) {
      Alert.alert('サーバー未起動', 'バックエンドAPIサーバーに接続できません。\nPC側でサーバーを起動してください。');
      return;
    }
    setFetchStatus('syncing');
    setFetchLog([]);
    setFetchResult(null);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    try {
      addFetchLog('📡 バックエンドに接続中...');
      await new Promise(r => setTimeout(r, 300));
      addFetchLog('🔍 シフコンにログイン中...');
      await new Promise(r => setTimeout(r, 300));
      addFetchLog(`📋 ${year}年${month}月のシフトを取得中...`);

      const res = await triggerSync({ year, month, sync_to_gcal: false });

      addFetchLog(`✅ シフト取得完了: ${res.scraped}件`);
      if (res.added_to_db > 0) addFetchLog(`💾 DB保存: ${res.added_to_db}件`);
      if (res.added_to_db === 0 && res.scraped > 0) addFetchLog('⏭️ すべて取得済み（差分なし）');

      setFetchResult(res);
      setFetchStatus('success');

      const syncTime = new Date().toLocaleString('ja-JP');
      setLastSync(syncTime);
      await SecureStore.setItemAsync('last_sync', syncTime);

    } catch (e: any) {
      addFetchLog(`❌ エラー: ${e.message}`);
      setFetchStatus('error');
      Alert.alert('取得エラー', e.message);
    }
  };

  // ─── Googleカレンダー同期 ───
  const handleGcalSync = async () => {
    if (serverOk === false) {
      Alert.alert('サーバー未起動', 'バックエンドAPIサーバーに接続できません。\nPC側でサーバーを起動してください。');
      return;
    }
    setGcalStatus('syncing');
    setGcalLog([]);
    setGcalResult(null);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    try {
      addGcalLog('📡 バックエンドに接続中...');
      await new Promise(r => setTimeout(r, 300));
      addGcalLog('🔍 シフコンにログイン中...');
      await new Promise(r => setTimeout(r, 300));
      addGcalLog(`📋 ${year}年${month}月のシフトを取得中...`);

      const res = await triggerSync({ year, month, sync_to_gcal: true });

      addGcalLog(`✅ シフト取得完了: ${res.scraped}件`);
      if (res.added_to_db > 0) addGcalLog(`💾 DB保存: ${res.added_to_db}件`);
      if (res.gcal_added > 0)   addGcalLog(`📅 Googleカレンダー追加: ${res.gcal_added}件`);
      if (res.gcal_skipped > 0) addGcalLog(`⏭️ スキップ（既登録）: ${res.gcal_skipped}件`);
      if (res.gcal_errors > 0)  addGcalLog(`⚠️ エラー: ${res.gcal_errors}件`);

      setGcalResult(res);
      setGcalStatus('success');

    } catch (e: any) {
      addGcalLog(`❌ エラー: ${e.message}`);
      setGcalStatus('error');
      Alert.alert('同期エラー', e.message);
    }
  };

  const isBusy = fetchStatus === 'syncing' || gcalStatus === 'syncing';

  return (
    <View style={styles.container}>
      <View style={styles.bgBlob1} />
      <View style={styles.bgBlob2} />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>同期</Text>
          <Text style={styles.headerSub}>シフコン → アプリ / Googleカレンダー</Text>
        </View>

        {/* Server Status */}
        <View style={[styles.serverBadge, {
          backgroundColor: serverOk === null ? Colors.glassSubtle : serverOk ? Colors.greenLight : Colors.coralLight
        }]}>
          <Text style={[styles.serverBadgeText, {
            color: serverOk === null ? Colors.labelSecondary : serverOk ? Colors.green : Colors.coral
          }]}>
            {serverOk === null ? '⏳ サーバー確認中...' : serverOk ? '🟢 サーバー接続OK' : '🔴 サーバー未接続'}
          </Text>
          {serverOk === false && (
            <TouchableOpacity onPress={() => checkHealth().then(ok => setServerOk(ok))}>
              <Text style={[styles.serverBadgeText, { color: Colors.blue, marginLeft: 8 }]}>再試行</Text>
            </TouchableOpacity>
          )}
        </View>

        {lastSync && (
          <Text style={styles.lastSyncText}>最終同期: {lastSync}</Text>
        )}

        {/* ─── ボタン1: シフト取得 ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>シフト情報取得</Text>
          <View style={styles.card}>
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={styles.hl} />
            <View style={styles.cardContent}>
              <Text style={styles.cardDesc}>
                シフコンから今月のシフトを取得してアプリ内カレンダーに表示します。Googleカレンダーには書き込みません。
              </Text>

              {/* 状態バッジ */}
              {fetchStatus !== 'idle' && (
                <View style={[styles.statusBadge, {
                  backgroundColor:
                    fetchStatus === 'syncing' ? Colors.glassSubtle :
                    fetchStatus === 'success' ? Colors.greenLight : Colors.coralLight
                }]}>
                  <Text style={[styles.statusBadgeText, {
                    color:
                      fetchStatus === 'syncing' ? Colors.labelSecondary :
                      fetchStatus === 'success' ? Colors.green : Colors.coral
                  }]}>
                    {fetchStatus === 'syncing' ? '⏳ 取得中...' :
                     fetchStatus === 'success' ? `✅ 取得完了 ${fetchResult?.scraped ?? 0}件` :
                     '❌ エラー'}
                  </Text>
                </View>
              )}

              {/* ログ */}
              {fetchLog.length > 0 && (
                <View style={styles.logBox}>
                  {fetchLog.map((line, i) => (
                    <Text key={i} style={styles.logLine}>{line}</Text>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.btn, styles.btnBlue, (fetchStatus === 'syncing' || isBusy) && styles.btnDisabled]}
                onPress={handleFetchShifts}
                disabled={isBusy}
                activeOpacity={0.85}
              >
                {fetchStatus === 'syncing'
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.btnText}>📱 シフトを取得する</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─── ボタン2: Googleカレンダー同期 ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Googleカレンダー同期</Text>
          <View style={styles.card}>
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={styles.hl} />
            <View style={styles.cardContent}>
              <Text style={styles.cardDesc}>
                シフコンから今月のシフトを取得し、GoogleカレンダーにもイベントとしてGoogleカレンダーへ登録します。
              </Text>

              {/* 状態バッジ */}
              {gcalStatus !== 'idle' && (
                <View style={[styles.statusBadge, {
                  backgroundColor:
                    gcalStatus === 'syncing' ? Colors.glassSubtle :
                    gcalStatus === 'success' ? Colors.greenLight : Colors.coralLight
                }]}>
                  <Text style={[styles.statusBadgeText, {
                    color:
                      gcalStatus === 'syncing' ? Colors.labelSecondary :
                      gcalStatus === 'success' ? Colors.green : Colors.coral
                  }]}>
                    {gcalStatus === 'syncing' ? '⏳ 同期中...' :
                     gcalStatus === 'success'
                       ? `✅ 同期完了 (GCal +${gcalResult?.gcal_added ?? 0}件)`
                       : '❌ エラー'}
                  </Text>
                </View>
              )}

              {/* ログ */}
              {gcalLog.length > 0 && (
                <View style={styles.logBox}>
                  {gcalLog.map((line, i) => (
                    <Text key={i} style={styles.logLine}>{line}</Text>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.btn, styles.btnGreen, (gcalStatus === 'syncing' || isBusy) && styles.btnDisabled]}
                onPress={handleGcalSync}
                disabled={isBusy}
                activeOpacity={0.85}
              >
                {gcalStatus === 'syncing'
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.btnText}>📅 Googleカレンダーに同期</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={styles.hl} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>ℹ️ 同期について</Text>
            <Text style={styles.infoText}>
              初回は全期間分、2回目以降は今日から5日先のシフトのみを取得します。{'\n'}
              Googleカレンダー同期には別途サービスアカウントの設定が必要です。
            </Text>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bgBlob1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(0,122,255,0.07)', top: -60, right: -80 },
  bgBlob2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(52,199,89,0.06)', bottom: 80, left: -60 },
  hl: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 1 },
  scroll: { flex: 1, paddingHorizontal: Spacing.lg },
  header: { paddingTop: 60, paddingBottom: Spacing.md },
  headerTitle: { ...Typography.largeTitle, marginBottom: 4 },
  headerSub: { ...Typography.callout, color: Colors.labelSecondary },
  serverBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, alignSelf: 'flex-start', marginBottom: Spacing.xs },
  serverBadgeText: { ...Typography.footnote, fontWeight: '600' },
  lastSyncText: { ...Typography.caption, color: Colors.labelSecondary, marginBottom: Spacing.md, paddingLeft: 4 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.footnote, color: Colors.labelSecondary, fontWeight: '600', marginBottom: Spacing.sm, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
  cardContent: { padding: Spacing.lg },
  cardDesc: { ...Typography.callout, color: Colors.labelSecondary, lineHeight: 22, marginBottom: Spacing.md },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, alignSelf: 'flex-start', marginBottom: Spacing.md },
  statusBadgeText: { ...Typography.footnote, fontWeight: '600' },
  logBox: { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  logLine: { ...Typography.footnote, color: Colors.label, marginBottom: 4, lineHeight: 20 },
  btn: { borderRadius: Radius.xl, overflow: 'hidden', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  btnBlue: { backgroundColor: Colors.blue, paddingVertical: 16, alignItems: 'center', shadowColor: Colors.blue },
  btnGreen: { backgroundColor: Colors.green, paddingVertical: 16, alignItems: 'center', shadowColor: Colors.green },
  btnDisabled: { opacity: 0.5 },
  btnText: { ...Typography.headline, color: Colors.white },
  infoCard: { borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden' },
  infoContent: { padding: Spacing.lg },
  infoTitle: { ...Typography.callout, fontWeight: '600', marginBottom: Spacing.sm },
  infoText: { ...Typography.footnote, color: Colors.labelSecondary, lineHeight: 20 },
});
