import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { router, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Colors, Typography, Spacing, Radius } from '../theme/liquidGlass';
import { fetchSettings, updateSettings, clearCredentials, loadCredentials, SettingsResponse, getApiUrl, deleteAllGcalEvents } from '../api/client';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<SettingsResponse>({
    hourly_wage: 1050,
    notify_enabled: true,
    notify_time: '08:00',
    notify_days_before: 1,
  });
  const [staffId, setStaffId] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hourlyWageInput, setHourlyWageInput] = useState('1050');

  useFocusEffect(useCallback(() => {
    (async () => {
      setLoading(true);
      // 認証情報読み込み
      const creds = await loadCredentials();
      if (creds) setStaffId(creds.staffId);
      const url = await getApiUrl();
      setApiUrl(url);
      // API設定読み込み
      try {
        const s = await fetchSettings();
        setSettings(s);
        setHourlyWageInput(String(Math.round(s.hourly_wage)));
      } catch {
        // APIオフラインでも設定画面は表示
      }
      setLoading(false);
    })();
  }, []));

  const handleSaveSettings = async () => {
    const wage = parseFloat(hourlyWageInput);
    if (isNaN(wage) || wage <= 0) {
      Alert.alert('入力エラー', '時給は正の数を入力してください');
      return;
    }
    setSaving(true);
    try {
      // APIサーバーに保存
      const updated = await updateSettings({
        hourly_wage: wage,
        notify_enabled: settings.notify_enabled,
        notify_time: settings.notify_time,
        notify_days_before: settings.notify_days_before,
      });
      setSettings(updated);
      Alert.alert('保存完了', '設定を保存しました');
    } catch (e: any) {
      // オフラインでもローカルに保持
      setSettings(prev => ({ ...prev, hourly_wage: wage }));
      Alert.alert('保存（ローカル）', 'サーバーへの保存に失敗しましたが、ローカルに保持しています');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiUrl = async () => {
    await SecureStore.setItemAsync('api_url', apiUrl);
    Alert.alert('保存完了', 'サーバーURLを保存しました');
  };

  const handleDeleteCalendarEvents = () => {
    Alert.alert(
      'カレンダーを全削除',
      'Googleカレンダーに登録されているシフトをすべて削除しますか？\nこの操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const result = await deleteAllGcalEvents();
              Alert.alert(
                '削除完了',
                `Googleカレンダーのシフトイベントを${result.deleted}件削除しました。${result.errors > 0 ? `\n（エラー: ${result.errors}件）` : ''}`,
              );
            } catch (e: any) {
              Alert.alert('削除エラー', e.message || 'カレンダーの削除に失敗しました');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'ログアウト',
      '認証情報を削除してログアウトしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            await clearCredentials();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.blue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.bgBlob1} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>設定</Text>
          <Text style={styles.headerSub}>ShiftSync の設定</Text>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント</Text>
          <View style={styles.card}>
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={styles.hl} />
            <View style={styles.cardContent}>
              <View style={styles.row}>
                <Text style={styles.rowIcon}>👤</Text>
                <View style={styles.rowCenter}>
                  <Text style={styles.rowTitle}>シフコン アカウント</Text>
                  <Text style={styles.rowSub}>スタッフID: {staffId || '未設定'}</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text style={styles.rowAction}>変更</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* API Server */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>サーバー設定</Text>
          <View style={styles.card}>
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={styles.hl} />
            <View style={styles.cardContent}>
              <Text style={styles.fieldLabel}>API サーバー URL</Text>
              <View style={styles.urlRow}>
                <View style={[styles.inputField, { flex: 1, marginRight: 8 }]}>
                  <TextInput
                    style={styles.fieldInput}
                    value={apiUrl}
                    onChangeText={setApiUrl}
                    placeholder="http://192.168.x.x:8000"
                    placeholderTextColor={Colors.labelTertiary}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
                <TouchableOpacity style={styles.saveSmallBtn} onPress={handleSaveApiUrl}>
                  <Text style={styles.saveSmallBtnText}>保存</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldHint}>
                スマホからは PC の LAN IP を使用してください
              </Text>
            </View>
          </View>
        </View>

        {/* Work Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>勤務設定</Text>
          <View style={styles.card}>
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={styles.hl} />
            <View style={styles.cardContent}>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>時給（円）</Text>
                <View style={styles.inputField}>
                  <TextInput
                    style={styles.fieldInput}
                    value={hourlyWageInput}
                    onChangeText={setHourlyWageInput}
                    keyboardType="numeric"
                    placeholder="1050"
                    placeholderTextColor={Colors.labelTertiary}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知設定</Text>
          <View style={styles.card}>
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={styles.hl} />
            <View style={styles.cardContent}>
              <View style={styles.row}>
                <Text style={styles.rowIcon}>🔔</Text>
                <View style={styles.rowCenter}>
                  <Text style={styles.rowTitle}>シフト前日通知</Text>
                  <Text style={styles.rowSub}>シフト前日にリマインド</Text>
                </View>
                <Switch
                  value={settings.notify_enabled}
                  onValueChange={v => setSettings(prev => ({ ...prev, notify_enabled: v }))}
                  trackColor={{ false: Colors.separator, true: Colors.blue }}
                  thumbColor={Colors.white}
                />
              </View>
              {settings.notify_enabled && (
                <View style={[styles.row, styles.rowBorder]}>
                  <Text style={styles.rowIcon}>⏰</Text>
                  <View style={styles.rowCenter}>
                    <Text style={styles.rowTitle}>通知時刻</Text>
                  </View>
                  <View style={[styles.inputField, { width: 80 }]}>
                    <TextInput
                      style={[styles.fieldInput, { textAlign: 'center' }]}
                      value={settings.notify_time}
                      onChangeText={v => setSettings(prev => ({ ...prev, notify_time: v }))}
                      placeholder="08:00"
                      placeholderTextColor={Colors.labelTertiary}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings} disabled={saving}>
            <View style={styles.saveBtnInner}>
              {saving
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.saveBtnText}>設定を保存</Text>
              }
            </View>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>操作</Text>
          <View style={styles.card}>
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={styles.hl} />
            <View style={styles.cardContent}>
              <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteCalendarEvents}>
                <Text style={styles.dangerText}>🗑️  カレンダーのシフトをすべて削除</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerRow, styles.rowBorder]} onPress={handleLogout}>
                <Text style={styles.dangerText}>🚪  ログアウト</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.version}>ShiftSync v1.0.0 (SDK 54)</Text>
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bgBlob1: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(0,122,255,0.06)', top: -60, right: -60 },
  hl: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.lg },
  headerTitle: { ...Typography.largeTitle, marginBottom: 4 },
  headerSub: { ...Typography.callout, color: Colors.labelSecondary },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.footnote, color: Colors.labelSecondary, fontWeight: '600', marginBottom: Spacing.sm, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  cardContent: { padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.separator },
  rowIcon: { fontSize: 22, width: 36, textAlign: 'center', marginRight: Spacing.sm },
  rowCenter: { flex: 1 },
  rowTitle: { ...Typography.callout, fontWeight: '500' },
  rowSub: { ...Typography.caption, color: Colors.labelSecondary, marginTop: 2 },
  rowAction: { ...Typography.callout, color: Colors.blue },
  urlRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  saveSmallBtn: { backgroundColor: Colors.blue, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 11 },
  saveSmallBtnText: { ...Typography.footnote, color: Colors.white, fontWeight: '600' },
  fieldBlock: { marginBottom: Spacing.sm },
  fieldLabel: { ...Typography.footnote, color: Colors.labelSecondary, marginBottom: Spacing.xs, paddingLeft: 4 },
  inputField: { borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.separator, backgroundColor: 'rgba(255,255,255,0.6)', height: 44, justifyContent: 'center' },
  fieldInput: { ...Typography.callout, color: Colors.label, paddingHorizontal: Spacing.md, height: 44 },
  fieldHint: { ...Typography.caption2, color: Colors.labelTertiary, marginTop: 6, paddingLeft: 4 },
  saveBtn: { borderRadius: Radius.xl, overflow: 'hidden' },
  saveBtnInner: { backgroundColor: Colors.blue, paddingVertical: 18, alignItems: 'center' },
  saveBtnText: { ...Typography.headline, color: Colors.white },
  dangerRow: { paddingVertical: Spacing.md },
  dangerText: { ...Typography.callout, color: Colors.coral },
  version: { ...Typography.caption, color: Colors.labelTertiary, textAlign: 'center', paddingBottom: Spacing.md },
});
