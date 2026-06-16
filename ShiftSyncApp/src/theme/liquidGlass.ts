/**
 * ShiftSync - Liquid Glass Design System
 * iOS 26 スタイルのデザイントークン (SDK 54対応)
 */

import { Platform, StyleSheet } from 'react-native';

export const Colors = {
  background: '#F2F2F7',
  backgroundSecondary: '#FFFFFF',
  glass: 'rgba(255,255,255,0.65)',
  glassStrong: 'rgba(255,255,255,0.80)',
  glassSubtle: 'rgba(255,255,255,0.45)',
  glassBorder: 'rgba(255,255,255,0.55)',
  glassShadow: 'rgba(0,0,0,0.08)',
  blue: '#007AFF',
  blueLight: 'rgba(0,122,255,0.15)',
  blueGlass: 'rgba(0,122,255,0.12)',
  coral: '#FF6B6B',
  coralLight: 'rgba(255,107,107,0.15)',
  green: '#34C759',
  greenLight: 'rgba(52,199,89,0.15)',
  orange: '#FF9500',
  orangeLight: 'rgba(255,149,0,0.15)',
  purple: '#5856D6',
  purpleLight: 'rgba(88,86,214,0.15)',
  label: '#1C1C1E',
  labelSecondary: 'rgba(60,60,67,0.6)',
  labelTertiary: 'rgba(60,60,67,0.3)',
  white: '#FFFFFF',
  separator: 'rgba(60,60,67,0.12)',
} as const;

export const Typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37, color: Colors.label },
  title1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.36, color: Colors.label },
  title2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35, color: Colors.label },
  title3: { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0.38, color: Colors.label },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41, color: Colors.label },
  body: { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.41, color: Colors.label },
  callout: { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.32, color: Colors.label },
  subhead: { fontSize: 15, fontWeight: '500' as const, letterSpacing: -0.24, color: Colors.label },
  footnote: { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08, color: Colors.labelSecondary },
  caption: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0, color: Colors.labelSecondary },
  caption2: { fontSize: 11, fontWeight: '400' as const, letterSpacing: 0.06, color: Colors.labelTertiary },
} as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const Radius = { sm: 10, md: 14, lg: 20, xl: 26, xxl: 32, pill: 999 } as const;

export const GlassShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20 },
  android: { elevation: 8 },
  default: {},
});

export const GlassStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glass,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    ...GlassShadow,
    overflow: 'hidden',
  },
  cardStrong: {
    backgroundColor: Colors.glassStrong,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    ...GlassShadow,
    overflow: 'hidden',
  },
  cardSubtle: {
    backgroundColor: Colors.glassSubtle,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
  },
  pill: {
    backgroundColor: Colors.glass,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    ...GlassShadow,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  section: {
    backgroundColor: Colors.glassStrong,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.separator,
    overflow: 'hidden',
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
    marginLeft: 16,
  },
});

export const Animation = {
  spring: { damping: 20, stiffness: 300, mass: 0.8 },
  quick: { duration: 150 },
  standard: { duration: 250 },
  emphasis: { duration: 400 },
} as const;
