/**
 * Search bar component with glass styling, search icon, and clear button
 */

import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Search, CircleX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, glass } from '../../theme';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder,
}: SearchInputProps) {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const resolvedPlaceholder = placeholder ?? t('common.search');

  return (
    <View style={[styles.wrapper, isFocused && styles.focused]}>
      <BlurView
        intensity={glass.intensity}
        tint={glass.tint}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        <Search size={18} color={colors.textSecondary} strokeWidth={1.5} />
        <TextInput
          style={styles.input}
          placeholder={resolvedPlaceholder}
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
