/**
 * Toast notification component with useToast hook
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Animated, StyleSheet, Pressable } from 'react-native';
import { Text } from './Text';
import { colors, spacing, borderRadius } from '../../theme';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  visible: boolean;
  onHide: () => void;
}

const iconMap: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const bgColorMap: Record<ToastType, string> = {
  success: colors.success,
  error: colors.error,
  info: colors.accent,
};

export function Toast({ message, type, visible, onHide }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
      }).start();
      const timer = setTimeout(onHide, 3000);
      return () => clearTimeout(timer);
    } else {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY, onHide]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <Pressable
        onPress={onHide}
        style={[styles.toast, { backgroundColor: bgColorMap[type] }]}
      >
        <Text variant="body" color="inverse" weight="bold">
          {iconMap[type]}
        </Text>
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
    borderRadius: borderRadius.sm,
  },
  message: {
    marginLeft: spacing.sm,
    flex: 1,
  },
});
