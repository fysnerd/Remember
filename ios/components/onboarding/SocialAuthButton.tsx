/**
 * Social auth button (Apple / Google styled)
 *
 * Apple: white background, dark text
 * Google: transparent with border, light text
 */

import { Pressable, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui';
import { haptics } from '../../lib/haptics';
import { colors, spacing, borderRadius, layout, typography } from '../../theme';

interface SocialAuthButtonProps {
  provider: 'apple' | 'google';
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const PROVIDER_CONFIG = {
  apple: {
    label: 'Continuer avec Apple',
    icon: '\uF8FF',
    bg: 'transparent',
    textColor: colors.text,
    borderColor: colors.borderLight,
  },
  google: {
    label: 'Continuer avec Google',
    icon: 'G',
    bg: 'transparent',
    textColor: colors.text,
    borderColor: colors.borderLight,
  },
};

export function SocialAuthButton({ provider, onPress, loading, disabled }: SocialAuthButtonProps) {
  const config = PROVIDER_CONFIG[provider];

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: config.bg,
          borderColor: config.borderColor,
        },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={config.textColor} />
      ) : (
        <View style={styles.content}>
          {provider === 'apple' ? (
            <Ionicons name="logo-apple" size={20} color={config.textColor} />
          ) : (
            <Text
              variant="body"
              weight="semibold"
              style={[styles.icon, { color: config.textColor }]}
            >
              {config.icon}
            </Text>
          )}
          <Text
            variant="body"
            weight="medium"
            style={{ color: config.textColor }}
          >
            {config.label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: layout.buttonHeightLg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    ...typography.h3,
    width: layout.iconSize,
    textAlign: 'center',
    fontFamily: undefined,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
