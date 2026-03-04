/**
 * Design tokens for Ankora
 *
 * Night Blue dark mode with Geist font system
 * Deep navy backgrounds, warm gold accent, editorial typography
 */

export const colors = {
  // Core palette - Night Blue dark mode
  background: '#080822',
  surface: '#111827',
  surfaceElevated: '#1E293B',
  surfaceLight: '#F1F5F9',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textDark: '#111827',
  textDarkSecondary: '#475569',
  border: '#1E293B',
  borderLight: '#334155',
  accent: '#B5A5FE',
  // Semantic
  error: '#EF4444',
  success: '#22C55E',
  successLight: '#4ADE80',
  warning: '#FB923C',
  info: '#3B82F6',
  // Special
  white: '#FFFFFF',
  black: '#000000',
  lavender: '#D4CEEB',
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayStrong: 'rgba(0, 0, 0, 0.6)',
  overlayDark: 'rgba(0, 0, 0, 0.75)',
  overlayLight: 'rgba(255, 255, 255, 0.95)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  xxl: 40,
} as const;

export const fonts = {
  light: 'Geist_300Light',
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;

// Typography scale - font sizes with corresponding line heights
export const typography = {
  // Display sizes (for special UI elements)
  display: { fontSize: 64, lineHeight: 72 },
  hero: { fontSize: 48, lineHeight: 56 },
  jumbo: { fontSize: 38, lineHeight: 44 },
  // Heading sizes
  h1: { fontSize: 28, lineHeight: 36 },
  h2: { fontSize: 24, lineHeight: 32 },
  h3: { fontSize: 20, lineHeight: 28 },
  h4: { fontSize: 18, lineHeight: 26 },
  // Body sizes
  body: { fontSize: 16, lineHeight: 24 },
  bodySmall: { fontSize: 15, lineHeight: 22 },
  // Caption & label sizes
  caption: { fontSize: 14, lineHeight: 20 },
  captionSmall: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16 },
  labelSmall: { fontSize: 11, lineHeight: 14 },
  micro: { fontSize: 10, lineHeight: 12 },
  nano: { fontSize: 9, lineHeight: 11 },
} as const;

export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 30,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Depth effects
export const depth = {
  // Inner highlight (top edge glow)
  innerGlow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.04)',
  },
  // Background gradient colors
  gradientStart: '#0a0a2e',
  gradientEnd: '#080822',
} as const;

export const layout = {
  screenPadding: spacing.lg,
  buttonHeight: 48,
  buttonHeightSm: 40,
  buttonHeightLg: 56,
  inputHeight: 48,
  iconSize: 24,
  iconSizeSm: 20,
  iconSizeLg: 32,
  minTouchTarget: 44,
} as const;

export const glass = {
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
  borderFocused: 'rgba(212, 165, 116, 0.3)',
  fill: 'rgba(17, 24, 39, 0.6)',
  fillElevated: 'rgba(30, 41, 59, 0.5)',
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  intensity: 60,
  tint: 'systemThinMaterialDark' as const,
  tabBarTint: 'systemChromeMaterialDark' as const,
  tabBarIntensity: 80,
} as const;

// Feedback colors for quiz/answer states
export const feedback = {
  correct: {
    background: 'rgba(34, 197, 94, 0.15)',
    border: 'rgba(34, 197, 94, 0.4)',
    text: '#22C55E',
  },
  incorrect: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.4)',
    text: '#EF4444',
  },
  neutral: {
    background: 'rgba(148, 163, 184, 0.15)',
    border: 'rgba(148, 163, 184, 0.4)',
    text: '#94A3B8',
  },
  selected: {
    background: 'rgba(181, 165, 254, 0.15)',
    border: 'rgba(181, 165, 254, 0.4)',
    text: '#B5A5FE',
  },
} as const;
