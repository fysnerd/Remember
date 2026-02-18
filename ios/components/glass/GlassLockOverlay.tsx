/**
 * Freemium lock overlay for glass surfaces
 *
 * Wraps children with a conditional blur + lock icon overlay.
 * Visual only -- no payment wiring (deferred to v3.1).
 */

import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { Lock } from 'lucide-react-native';
import { colors, borderRadius, glass } from '../../theme';

const useNativeGlass = isGlassEffectAPIAvailable();

interface GlassLockOverlayProps {
  children: React.ReactNode;
  /** When true, shows blur overlay with lock icon */
  locked?: boolean;
}

export function GlassLockOverlay({ children, locked = false }: GlassLockOverlayProps) {
  return (
    <View style={styles.container}>
      {children}
      {locked && (
        <View style={styles.overlay}>
          {useNativeGlass ? (
            <GlassView
              glassEffectStyle={glass.liquidGlass.clearEffect}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <View style={styles.lockBadge}>
            <Lock size={22} color={colors.textSecondary} strokeWidth={1.75} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(10, 15, 26, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
});
