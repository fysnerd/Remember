/**
 * Text component with typography variants
 */

import { Text as RNText, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { colors, fonts } from '../../theme';

type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';
type TextColor = 'primary' | 'secondary' | 'muted' | 'inverse';
type TextWeight = 'regular' | 'medium' | 'bold';

interface TextProps {
  variant?: TextVariant;
  color?: TextColor;
  weight?: TextWeight;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

const variantStyles: Record<TextVariant, TextStyle> = {
  h1: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  h2: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '500', lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  caption: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
};

const colorMap: Record<TextColor, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  muted: colors.border,
  inverse: colors.background,
};

const weightMap: Record<TextWeight, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  bold: '700',
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
        weight && { fontWeight: weightMap[weight] },
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
