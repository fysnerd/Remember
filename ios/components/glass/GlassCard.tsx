import { StyleProp, ViewStyle, Pressable } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { spacing, borderRadius } from '../../theme';

type GlassCardPadding = 'none' | 'sm' | 'md' | 'lg';

interface GlassCardProps {
  children: React.ReactNode;
  padding?: GlassCardPadding;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const paddingMap: Record<GlassCardPadding, number> = {
  none: 0,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
};

export function GlassCard({
  children,
  padding = 'md',
  onPress,
  style,
}: GlassCardProps) {
  const content = (
    <GlassSurface style={[{ padding: paddingMap[padding] }, style]}>
      {children}
    </GlassSurface>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.8 }}>
        {content}
      </Pressable>
    );
  }

  return content;
}
