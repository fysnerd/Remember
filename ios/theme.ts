/**
 * Design tokens for Ankora
 *
 * Night Blue dark mode with Geist font system
 * Deep navy backgrounds, warm gold accent, editorial typography
 */

export const colors = {
  // Core palette - Night Blue dark mode
  background: '#0A0F1A',
  surface: '#111827',
  surfaceElevated: '#1E293B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  border: '#1E293B',
  borderLight: '#334155',
  accent: '#D4A574',
  // Semantic
  error: '#EF4444',
  success: '#22C55E',
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayStrong: 'rgba(0, 0, 0, 0.6)',
} as const;

export const spacing = {
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

export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const layout = {
  screenPadding: spacing.lg,
  buttonHeight: 48,
  inputHeight: 48,
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
