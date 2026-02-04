/**
 * Design tokens for Ankora
 *
 * Refined wireframe aesthetic: intentional, minimal, editorial
 * Black/white/gray with purposeful hierarchy
 */

export const colors = {
  // Core palette - true black and white for maximum contrast
  background: '#FFFFFF',
  surface: '#FAFAFA',
  surfaceElevated: '#F5F5F5',
  text: '#0A0A0A',
  textSecondary: '#737373',
  textTertiary: '#A3A3A3',
  border: '#E5E5E5',
  borderLight: '#F0F0F0',
  accent: '#0A0A0A',
  // Semantic
  error: '#DC2626',
  success: '#16A34A',
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.04)',
  overlayStrong: 'rgba(0, 0, 0, 0.08)',
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
  regular: 'System',
  medium: 'System',
  bold: 'System',
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
