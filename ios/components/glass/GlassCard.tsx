import { StyleProp, ViewStyle, Pressable } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { haptics } from '../../lib/haptics';
import { spacing, borderRadius } from '../../theme';

type GlassCardPadding = 'none' | 'sm' | 'md' | 'lg';

interface GlassCardProps {
  children: React.ReactNode;
  padding?: GlassCardPadding;
  onPress?: () => void;
  onLongPress?: () => void;
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
  onLongPress,
  style,
}: GlassCardProps) {
  const content = (
    <GlassSurface style={[{ padding: paddingMap[padding] }, style]}>
      {children}
    </GlassSurface>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress ? () => { haptics.light(); onPress(); } : undefined}
        onLongPress={onLongPress ? () => { haptics.warning(); onLongPress(); } : undefined}
        delayLongPress={500}
        style={({ pressed }) => pressed && { opacity: 0.8 }}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}
