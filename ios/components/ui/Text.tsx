/**
 * Text component with typography variants
 *
 * Uses fontFamily (not fontWeight) for Geist custom font rendering.
 * React Native ignores fontWeight on custom fonts -- each weight
 * must be referenced by its registered fontFamily name.
 */

import { Text as RNText, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { colors, fonts } from '../../theme';

type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';
type TextColor = 'primary' | 'secondary' | 'muted' | 'inverse';
type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

interface TextProps {
  variant?: TextVariant;
  color?: TextColor;
  weight?: TextWeight;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

const variantStyles: Record<TextVariant, TextStyle> = {
  h1: { fontSize: 28, fontFamily: fonts.bold, lineHeight: 36 },
  h2: { fontSize: 24, fontFamily: fonts.bold, lineHeight: 32 },
  h3: { fontSize: 20, fontFamily: fonts.semibold, lineHeight: 28 },
  body: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 24 },
  caption: { fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
  label: { fontSize: 12, fontFamily: fonts.medium, lineHeight: 16 },
};

const colorMap: Record<TextColor, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  muted: colors.border,
  inverse: colors.background,
};

const weightMap: Record<TextWeight, string> = {
  regular: fonts.regular,
  medium: fonts.medium,
  semibold: fonts.semibold,
  bold: fonts.bold,
};

export function Text({
  variant = 'body',
  color = 'primary',
  weight,
  children,
  style,
  numberOfLines,
}: TextProps) {
  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[
        styles.base,
        variantStyles[variant],
        { color: colorMap[color] },
        weight && { fontFamily: weightMap[weight] },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.regular,
  },
});
