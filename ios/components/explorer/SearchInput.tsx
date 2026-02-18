/**
 * Search bar component with glass styling, search icon, and clear button
 */

import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { Search, CircleX } from 'lucide-react-native';
import { colors, spacing, borderRadius, fonts, glass } from '../../theme';

const useNativeGlass = isGlassEffectAPIAvailable();

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Rechercher...',
}: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const innerContent = (
    <View style={styles.row}>
      <Search size={18} color={colors.textSecondary} strokeWidth={1.5} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        keyboardAppearance="dark"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <CircleX size={18} color={colors.textSecondary} strokeWidth={1.5} />
        </Pressable>
      )}
    </View>
  );

  if (useNativeGlass) {
    return (
      <GlassView
        glassEffectStyle={glass.liquidGlass.effect}
        style={[styles.wrapper, isFocused && styles.focused]}
      >
        {innerContent}
      </GlassView>
    );
  }

  return (
    <View style={[styles.wrapper, isFocused && styles.focused]}>
      <BlurView
        intensity={glass.intensity}
        tint={glass.tint}
        style={StyleSheet.absoluteFill}
      />
      {innerContent}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: glass.border,
    height: 40,
  },
  focused: {
    borderColor: glass.borderFocused,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.text,
    paddingVertical: 0,
  },
});
