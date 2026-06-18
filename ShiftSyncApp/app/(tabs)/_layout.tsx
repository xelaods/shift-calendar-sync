import { Tabs } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../src/theme/liquidGlass';

// ─── 定数 ───────────────────────────────────────────────────────────────
const BAR_RADIUS      = 28;   // iOS の Squircle に最も近い超楕円近似値
const BAR_HEIGHT      = 76;   // タブバー本体の高さ（アイコン＋ラベル）
const BAR_H_MARGIN    = 16;   // 左右の浮遊マージン
const BAR_BOTTOM_GAP  = 12;   // Safe Area 下端からのオフセット

const TABS = [
  { name: 'index',    icon: 'calendar-outline'  as const, iconActive: 'calendar'    as const, label: 'シフト' },
  { name: 'sync',     icon: 'sync-outline'      as const, iconActive: 'sync'        as const, label: '同期'   },
  { name: 'stats',    icon: 'bar-chart-outline' as const, iconActive: 'bar-chart'   as const, label: '給与'   },
  { name: 'settings', icon: 'settings-outline'  as const, iconActive: 'settings'    as const, label: '設定'   },
] as const;

// ─── アニメーション付きタブアイテム ─────────────────────────────────────
function TabItem({
  tab, focused, onPress, onLongPress,
}: {
  tab: typeof TABS[number];
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacAnim  = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.20, useNativeDriver: true, damping: 5, stiffness: 420 }),
        Animated.spring(scaleAnim, { toValue: 1.0,  useNativeDriver: true, damping: 15, stiffness: 200 }),
      ]).start();
      Animated.timing(opacAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start();
      Animated.spring(scaleAnim, { toValue: 1.0, useNativeDriver: true, damping: 15, stiffness: 200 }).start();
    }
  }, [focused]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {/* アクティブ時のグラスピル（アイコン背景） */}
      <Animated.View style={[styles.pill, { opacity: opacAnim }]}>
        {/* ブラー（overflow: hidden の親でクリッピング済み） */}
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
        {/* 上部ハイライト光沢 */}
        <LinearGradient
          colors={['rgba(255,255,255,0.90)', 'rgba(255,255,255,0.0)']}
          style={styles.pillHighlight}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        {/* 青みグラデーション */}
        <LinearGradient
          colors={['rgba(0,122,255,0.12)', 'rgba(88,86,214,0.07)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {/* ピル枠線 */}
        <View style={styles.pillBorder} />
      </Animated.View>

      {/* アイコン */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons
          name={focused ? tab.iconActive : tab.icon}
          size={22}
          color={focused ? Colors.blue : Colors.labelTertiary}
        />
      </Animated.View>

      {/* ラベル */}
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
        {tab.label}
      </Text>

      {/* アクティブドット */}
      <Animated.View style={[styles.dot, { opacity: opacAnim }]} />
    </Pressable>
  );
}

// ─── フローティングタブバー本体 ──────────────────────────────────────────
function FloatingTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  // Safe Area を考慮した bottom オフセット
  // ノッチなし機種 (insets.bottom = 0) でも最低 BAR_BOTTOM_GAP を確保
  const bottomOffset = insets.bottom + BAR_BOTTOM_GAP;

  return (
    <View
      style={[styles.barWrapper, { bottom: bottomOffset }]}
      pointerEvents="box-none"
    >
      {/*
        ── 形状整合性の要点 ──
        1. barWrapper は position:absolute で画面に浮く（shadow はここに付ける）
        2. barInner に overflow:'hidden' + borderRadius を付け、
           BlurView / Gradient が角丸外へはみ出るのを完全ブロック
        3. BlurView は absoluteFillObject で barInner 全面を覆う
        4. borderRadius はすべてこの定数 BAR_RADIUS で統一
      */}
      <View style={styles.barInner}>
        {/* ── レイヤー1: ベースブラー ─────────────────── */}
        <BlurView
          intensity={85}
          tint="light"
          style={StyleSheet.absoluteFillObject}
        />

        {/* ── レイヤー2: プリズマティックグラデーション ── */}
        <LinearGradient
          colors={[
            'rgba(0,122,255,0.07)',
            'rgba(88,86,214,0.05)',
            'rgba(255,255,255,0.02)',
          ]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* ── レイヤー3: 上端光沢ライン (0.5px) ─────── */}
        <LinearGradient
          colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.0)']}
          style={styles.topGlossLine}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 0 }}
        />

        {/* ── タブアイテム行 ───────────────────────────── */}
        <View style={styles.tabRow}>
          {state.routes.map((route, index) => {
            const tab = TABS[index];
            if (!tab) return null;
            const focused = state.index === index;
            return (
              <TabItem
                key={route.key}
                tab={tab}
                focused={focused}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                onLongPress={() => {
                  navigation.emit({ type: 'tabLongPress', target: route.key });
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── レイアウト ─────────────────────────────────────────────────────────
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={props => <FloatingTabBar {...props} />}
    >
      {TABS.map(tab => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

// ─── スタイル ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── タブバー外枠（shadow はここ、overflow:visible が必要） ──
  barWrapper: {
    position: 'absolute',
    left: BAR_H_MARGIN,
    right: BAR_H_MARGIN,
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    // 多層シャドウで浮遊感
    ...Platform.select({
      ios: {
        shadowColor: '#1A1A2E',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.20,
        shadowRadius: 32,
      },
      android: { elevation: 20 },
    }),
  },
  // ── 角丸クリッピング＆背景（overflow:'hidden' で形状を厳密に確定） ──
  barInner: {
    flex: 1,
    borderRadius: BAR_RADIUS,           // barWrapper と完全同値
    overflow: 'hidden',                 // ← BlurView/Gradient のはみ出し防止
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  // ── 上端光沢ライン ──
  topGlossLine: {
    position: 'absolute',
    top: 0,
    left: BAR_RADIUS * 0.6,             // 角丸部分を避けてライン開始
    right: BAR_RADIUS * 0.6,
    height: 0.75,                       // ~0.5pt の極細ライン
  },
  // ── タブアイテムの横並び ──
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // ── 各タブアイテム ──
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: BAR_HEIGHT,
    position: 'relative',
  },
  // ── アクティブピル ──
  pill: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
    borderRadius: BAR_RADIUS - 8,       // barInner より小さい角丸
    overflow: 'hidden',                 // ← ピル内ブラーのはみ出し防止
  },
  pillHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 14,
    zIndex: 1,
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_RADIUS - 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,122,255,0.20)',
  },
  // ── ラベル ──
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.labelTertiary,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  tabLabelFocused: {
    color: Colors.blue,
    fontWeight: '700',
  },
  // ── アクティブドット ──
  dot: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.blue,
  },
});
