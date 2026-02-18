import { useState } from 'react';
import { View, TextInput, StyleSheet, KeyboardTypeOptions } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { Text } from '../ui/Text';
import { colors, spacing, borderRadius, layout, fonts, glass } from '../../theme';

const useNativeGlass = isGlassEffectAPIAvailable();

interface GlassInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  error?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: KeyboardTypeOptions;
}

export function GlassInput({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  error,
  autoCapitalize = 'none',
  keyboardType = 'default',
}: GlassInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const input = (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      keyboardAppearance="dark"
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    />
  );

  return (
    <View style={styles.container}>
      {label && (
        <Text variant="label" color="secondary" style={styles.label}>
          {label}
        </Text>
      )}
      {useNativeGlass ? (
        <GlassView
          glassEffectStyle={glass.liquidGlass.effect}
          style={[
            styles.inputWrapper,
            isFocused && styles.focused,
            error && styles.error,
          ]}
        >
          {input}
        </GlassView>
      ) : (
        <View style={[
          styles.inputWrapper,
          isFocused && styles.focused,
          error && styles.error,
        ]}>
          <BlurView
            intensity={glass.intensity}
            tint={glass.tint}
            style={StyleSheet.absoluteFill}
          />
          {input}
        </View>
      )}
      {error && (
        <Text variant="caption" style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    overflow: 'hidden',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: glass.border,
    height: layout.inputHeight,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  focused: {
    borderColor: glass.borderFocused,
  },
  error: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    marginTop: spacing.xs,
  },
});
