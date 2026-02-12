/**
 * Toast notification component with useToast hook (Reanimated)
 */

import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Check, X, Info, LucideIcon } from 'lucide-react-native';
import { Text } from './Text';
import { colors, spacing, borderRadius } from '../../theme';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  visible: boolean;
  onHide: () => void;
}

const iconMap: Record<ToastType, LucideIcon> = {
  success: Check,
  error: X,
  info: Info,
};

const bgColorMap: Record<ToastType, string> = {
  success: colors.success,
  error: colors.error,
  info: colors.accent,
};

export function Toast({ message, type, visible, onHide }: ToastProps) {
  const translateY = useSharedValue(-100);
  const IconComponent = iconMap[type];

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      const timer = setTimeout(onHide, 3000);
      return () => clearTimeout(timer);
    } else {
      translateY.value = withTiming(-100, { duration: 200 });
    }
  }, [visible, onHide]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable
        onPress={onHide}
        style={[styles.toast, { backgroundColor: bgColorMap[type] }]}
      >
        <IconComponent size={16} color={colors.background} strokeWidth={2.5} />
        <Text variant="body" color="inverse" style={styles.message}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function useToast() {
  const [state, setState] = useState({ visible: false, message: '', type: 'info' as ToastType });

  const show = useCallback((message: string, type: ToastType = 'info') => {
    setState({ visible: true, message, type });
  }, []);

  const hide = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  const ToastComponent = useCallback(
    () => <Toast {...state} onHide={hide} />,
    [state, hide]
  );

  return { show, ToastComponent };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: spacing.sm,
  },
  message: {
    flex: 1,
  },
});
