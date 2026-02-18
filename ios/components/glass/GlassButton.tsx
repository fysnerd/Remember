import { Pressable, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { Text } from '../ui/Text';
import { haptics } from '../../lib/haptics';
import { colors, spacing, borderRadius, layout, glass } from '../../theme';

const useNativeGlass = isGlassEffectAPIAvailable();

type GlassButtonVariant = 'glass' | 'accent';
type GlassButtonSize = 'sm' | 'md' | 'lg';

interface GlassButtonProps {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const sizeStyles: Record<GlassButtonSize, ViewStyle> = {
  sm: { height: 36, paddingHorizontal: spacing.md },
  md: { height: layout.buttonHeight, paddingHorizontal: spacing.lg },
  lg: { height: 56, paddingHorizontal: spacing.xl },
};

export function GlassButton({
  variant = 'glass',
  size = 'md',
  disabled = false,
  loading = false,
  onPress,
  children,
  fullWidth = false,
  style,
}: GlassButtonProps) {
  const isDisabled = disabled || loading;
  const isAccent = variant === 'accent';
  const textColor = isAccent ? 'inverse' : 'primary';
  const spinnerColor = isAccent ? colors.background : colors.text;

  const content = loading ? (
    <ActivityIndicator size="small" color={spinnerColor} />
  ) : (
    <Text variant="body" weight="medium" color={textColor}>
      {children}
    </Text>
  );

  // Glass variant with native Liquid Glass
  if (!isAccent && useNativeGlass) {
    return (
      <GlassView
        glassEffectStyle={glass.liquidGlass.effect}
        isInteractive
        style={[
          styles.container,
          sizeStyles[size],
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        {content}
      </GlassView>
    );
  }

  return (
    <Pressable
      onPress={() => { haptics.light(); onPress(); }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.container,
        sizeStyles[size],
        fullWidth && styles.fullWidth,
        isAccent && styles.accent,
        isDisabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {!isAccent && (
        <BlurView
          intensity={glass.intensity}
          tint={glass.tint}
          style={StyleSheet.absoluteFill}
        />
      )}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: glass.border,
    ...glass.shadow,
  },
  accent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
