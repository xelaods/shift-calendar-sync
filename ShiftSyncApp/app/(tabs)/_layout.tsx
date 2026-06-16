import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Radius } from '../../src/theme/liquidGlass';

const TABS = [
  { name: 'index',    icon: '📅', label: 'シフト' },
  { name: 'sync',     icon: '↻',  label: '同期'   },
  { name: 'stats',    icon: '¥',  label: '給与'   },
  { name: 'settings', icon: '⚙️', label: '設定'   },
];

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      {/* アクティブ時のピル背景 */}
      {focused && (
        <View style={styles.activePill}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={styles.activePillHighlight} />
        </View>
      )}
      <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>{label}</Text>
      {/* アクティブドット */}
      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFillObject}>
            <BlurView
              intensity={85}
              tint="light"
              style={[StyleSheet.absoluteFillObject, { borderRadius: Radius.xxl }]}
            />
            {/* トップハイライトライン */}
            <View style={styles.tabBarHighlight} />
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
              <TabIcon icon={tab.icon} label={tab.label} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    height: 76,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: 'transparent',
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    overflow: Platform.OS === 'ios' ? 'visible' : 'hidden',
  },
  tabBarHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 1,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 56,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: 4,
    left: -4,
    right: -4,
    bottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.2)',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,122,255,0.08)',
  },
  activePillHighlight: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
    opacity: 0.4,
  },
  tabIconFocused: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    color: Colors.labelTertiary,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  tabLabelFocused: {
    color: Colors.blue,
    fontWeight: '700',
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.blue,
  },
});
