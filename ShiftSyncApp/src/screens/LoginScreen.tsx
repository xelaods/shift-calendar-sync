import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Colors, Typography, Spacing, Radius } from '../theme/liquidGlass';
import { saveCredentials, loadCredentials, checkHealth, getApiUrl } from '../api/client';

export default function LoginScreen() {
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  // 起動時: 既存の認証情報があればスキップ
  useEffect(() => {
    (async () => {
      const creds = await loadCredentials();
      const savedUrl = await SecureStore.getItemAsync('api_url');
      if (savedUrl) setApiUrl(savedUrl);
      if (creds) {
        setStaffId(creds.staffId);
        setPassword(creds.password);
        // バックエンドが生きていれば自動ログイン
        const ok = await checkHealth();
        if (ok) {
          router.replace('/(tabs)');
          return;
        }
      }
      setChecking(false);
    })();
  }, []);

  // サーバー接続確認
  const handleCheckServer = async () => {
    await SecureStore.setItemAsync('api_url', apiUrl);
    const ok = await checkHealth();
    setServerOk(ok);
    if (!ok) {
      Alert.alert('接続失敗', `${apiUrl} に接続できませんでした。\nURLを確認してください。`);
    }
  };

  const handleLogin = async () => {
    if (!staffId || !password) {
      Alert.alert('入力エラー', 'スタッフIDとパスワードを入力してください');
      return;
    }
    setLoading(true);
    try {
      // URLを保存
      await SecureStore.setItemAsync('api_url', apiUrl);
      // サーバー確認
      const ok = await checkHealth();
      if (!ok) {
        Alert.alert(
          'サーバー未接続',
          `バックエンドサーバー (${apiUrl}) に接続できません。\n\nPC側でAPIサーバーを起動してください:\ncd c:\\vscodeapp\\shift_sync\npython -m uvicorn api.main:app --host 0.0.0.0 --port 8000`,
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }
      // 資格情報を保存
      await saveCredentials(staffId, password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('エラー', e.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.blue} />
        <Text style={[Typography.callout, { color: Colors.labelSecondary, marginTop: 16 }]}>
          起動中...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.bgBlob1} />
      <View style={styles.bgBlob2} />
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoWrapper}>
          <View style={styles.logoCircle}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={styles.hl} />
            <Text style={styles.logoIcon}>S</Text>
          </View>
          <Text style={styles.appName}>ShiftSync</Text>
          <Text style={styles.appSub}>シフトをかしこく管理</Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={styles.hl} />
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>ログイン</Text>
            <Text style={styles.cardSub}>シフコンのアカウント情報を入力</Text>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>スタッフID</Text>
              <View style={styles.inputField}>
                <TextInput
                  style={styles.input}
                  value={staffId}
                  onChangeText={setStaffId}
                  placeholder="例: 0332388"
                  placeholderTextColor={Colors.labelTertiary}
                  autoCapitalize="none"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>パスワード</Text>
              <View style={styles.inputField}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="パスワード"
                  placeholderTextColor={Colors.labelTertiary}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Advanced: API URL */}
            <TouchableOpacity onPress={() => setShowAdvanced(!showAdvanced)} style={styles.advancedToggle}>
              <Text style={styles.advancedToggleText}>
                {showAdvanced ? '▾' : '▸'} サーバー設定
              </Text>
            </TouchableOpacity>
            {showAdvanced && (
              <View style={styles.advancedBlock}>
                <Text style={styles.inputLabel}>API サーバー URL</Text>
                <View style={styles.urlRow}>
                  <View style={[styles.inputField, { flex: 1, marginRight: 8 }]}>
                    <TextInput
                      style={styles.input}
                      value={apiUrl}
                      onChangeText={setApiUrl}
                      placeholder="http://192.168.x.x:8000"
                      placeholderTextColor={Colors.labelTertiary}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                  <TouchableOpacity style={styles.checkBtn} onPress={handleCheckServer}>
                    <Text style={styles.checkBtnText}>確認</Text>
                  </TouchableOpacity>
                </View>
                {serverOk === true && (
                  <Text style={styles.serverOk}>✅ 接続成功</Text>
                )}
                {serverOk === false && (
                  <Text style={styles.serverNg}>❌ 接続失敗</Text>
                )}
                <Text style={styles.urlHint}>
                  スマホからは PC の IP アドレスを使用してください{'\n'}
                  例: http://192.168.1.100:8000
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              <View style={styles.loginBtnInner}>
                {loading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.loginBtnText}>ログイン</Text>
                }
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.note}>
          ※ パスワードはデバイス内のセキュアな領域に保存されます
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  bgBlob1: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(0,122,255,0.08)', top: -100, right: -80 },
  bgBlob2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(255,107,107,0.06)', bottom: 50, left: -80 },
  hl: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.lg, justifyContent: 'center', paddingBottom: 40 },
  logoWrapper: { alignItems: 'center', marginBottom: Spacing.xxxl },
  logoCircle: { width: 88, height: 88, borderRadius: 44, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  logoIcon: { fontSize: 36, fontWeight: '700', color: Colors.blue },
  appName: { ...Typography.title1, marginBottom: Spacing.xs },
  appSub: { ...Typography.callout, color: Colors.labelSecondary },
  card: { borderRadius: Radius.xxl, borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden', marginBottom: Spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 32, elevation: 12 },
  cardContent: { padding: Spacing.xxl },
  cardTitle: { ...Typography.title3, marginBottom: 4 },
  cardSub: { ...Typography.caption, color: Colors.labelSecondary, marginBottom: Spacing.xl },
  inputWrapper: { marginBottom: Spacing.md },
  inputLabel: { ...Typography.footnote, color: Colors.labelSecondary, marginBottom: Spacing.xs, paddingLeft: 4 },
  inputField: { borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.separator, backgroundColor: 'rgba(255,255,255,0.6)', height: 48, justifyContent: 'center' },
  input: { ...Typography.callout, color: Colors.label, paddingHorizontal: Spacing.md, height: 48 },
  advancedToggle: { marginBottom: Spacing.sm },
  advancedToggleText: { ...Typography.footnote, color: Colors.blue },
  advancedBlock: { backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  urlRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  checkBtn: { backgroundColor: Colors.blue, borderRadius: Radius.sm, paddingHorizontal: 16, paddingVertical: 12 },
  checkBtnText: { ...Typography.footnote, color: Colors.white, fontWeight: '600' },
  serverOk: { ...Typography.caption, color: Colors.green, marginBottom: 4 },
  serverNg: { ...Typography.caption, color: Colors.coral, marginBottom: 4 },
  urlHint: { ...Typography.caption2, color: Colors.labelTertiary, lineHeight: 16 },
  loginBtn: { borderRadius: Radius.md, overflow: 'hidden', marginTop: Spacing.md },
  loginBtnInner: { backgroundColor: Colors.blue, paddingVertical: 16, alignItems: 'center', borderRadius: Radius.md },
  loginBtnText: { ...Typography.callout, color: Colors.white, fontWeight: '700' },
  note: { ...Typography.caption2, color: Colors.labelTertiary, textAlign: 'center', paddingHorizontal: Spacing.lg, lineHeight: 18 },
});