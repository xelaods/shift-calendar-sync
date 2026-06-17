import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform, Animated, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useEffect } from 'react';
import { Colors, Radius } from '../../src/theme/liquidGlass';

type TabName = 'index' | 'sync' | 'stats' | 'settings';

const TABS: { name: TabName; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { name: 'index',    icon: 'calendar-outline',   iconActive: 'calendar',        label: 'シフト' },
  { name: 'sync',     icon: 'sync-outline',        iconActive: 'sync',            label: '同期'   },
  { name: 'stats',    icon: 'bar-chart-outline',   iconActive: 'bar-chart',       label: '給与'   },
  { name: 'settings', icon: 'settings-outline',    iconActive: 'settings',        label: '設定'   },
];

function AnimatedTabIcon({
  icon, iconActive, label, focused,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
}) {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const opacAnim   = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (focused) {
      // アイコンがアクティブになるときバウンス
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.18, useNativeDriver: true, damping: 6, stiffness: 400 }),
        Animated.spring(scaleAnim, { toValue: 1.0,  useNativeDriver: true, damping: 14, stiffness: 200 }),
      ]).start();
      Animated.timing(opacAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      Animated.spring(scaleAnim, { toValue: 1.0, useNativeDriver: true, damping: 14, stiffness: 200 }).start();
    }
  }, [focused]);

  return (
    <View style={tabStyles.item}>
      {/* アクティブ時のグラスピル */}
      <Animated.View style={[tabStyles.pill, { opacity: opacAnim }]}>
        <BlurView intensity={72} tint="light" style={StyleSheet.absoluteFillObject} />
        {/* ピル内グラデーションハイライト */}
        <LinearGradient
          colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.0)']}
          style={tabStyles.pillHighlight}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        {/* 青いグラデーションオーバーレイ */}
        <LinearGradient
          colors={['rgba(0,122,255,0.10)', 'rgba(88,86,214,0.06)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* アイコン */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons
          name={focused ? iconActive : icon}
          size={22}
          color={focused ? Colors.blue : Colors.labelTertiary}
        />
      </Animated.View>

      {/* ラベル */}
      <Text style={[tabStyles.label, focused && tabStyles.labelFocused]}>
        {label}
      </Text>

      {/* アクティブインジケータドット */}
      <Animated.View style={[tabStyles.dot, { opacity: opacAnim }]} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyles.bar,
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFillObject}>
            {/* ベースブラー */}
            <BlurView
              intensity={90}
              tint="light"
              style={[StyleSheet.absoluteFillObject, { borderRadius: Radius.xxl }]}
            />
            {/* プリズマティックグラデーション（青→紫→透明） */}
            <LinearGradient
              colors={[
                'rgba(0,122,255,0.08)',
                'rgba(88,86,214,0.06)',
                'rgba(255,255,255,0.0)',
              ]}
              style={[StyleSheet.absoluteFillObject, { borderRadius: Radius.xxl }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            {/* トップハイライトライン（光沢感） */}
            <LinearGradient
              colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.0)']}
              style={tabStyles.topHighlight}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 0 }}
            />
          </View>
        ),
        tabBarShowLabel: false,
      }}
    >
      {TABS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            tabBarIcon: ({ focused }) => (
              <AnimatedTabIcon
                icon={tab.icon}
                iconActive={tab.iconActive}
                label={tab.label}
                focused={focused}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    height: 80,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'transparent',
    elevation: 0,
    // 多層シャドウで立体感
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    overflow: Platform.OS === 'ios' ? 'visible' : 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    borderRadius: 1,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 60,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: 2,
    left: -6,
    right: -6,
    bottom: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.18)',
    overflow: 'hidden',
  },
  pillHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 12,
    zIndex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.labelTertiary,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  labelFocused: {
    color: Colors.blue,
    fontWeight: '700',
  },
  dot: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.blue,
  },
});
