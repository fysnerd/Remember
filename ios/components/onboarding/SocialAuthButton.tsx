/**
 * Social auth button (Apple / Google styled)
 */

import { Pressable, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Text } from '../ui';
import { haptics } from '../../lib/haptics';
import { colors, spacing, borderRadius, layout } from '../../theme';

interface SocialAuthButtonProps {
  provider: 'apple' | 'google' | 'email';
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const PROVIDER_CONFIG = {
  apple: {
    label: 'Continuer avec Apple',
    icon: '\uF8FF', // Apple logo (SF Symbols)
    bg: '#FFFFFF',
    textColor: '#000000',
  },
  google: {
    label: 'Continuer avec Google',
    icon: 'G',
    bg: 'transparent',
    textColor: colors.text,
  },
  email: {
    label: 'Continuer avec un email',
    icon: '@',
    bg: 'transparent',
    textColor: colors.text,
  },
};

export function SocialAuthButton({ provider, onPress, loading, disabled }: SocialAuthButtonProps) {
  const config = PROVIDER_CONFIG[provider];
  const isApple = provider === 'apple';

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isApple ? styles.appleButton : styles.outlineButton,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isApple ? '#000' : colors.text} />
      ) : (
        <View style={styles.content}>
          <Text
            variant="body"
            weight="semibold"
            style={[styles.icon, { color: config.textColor }]}
          >
            {config.icon}
          </Text>
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
    height: layout.buttonHeight + 4,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
