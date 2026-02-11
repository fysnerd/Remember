import { BlurView } from 'expo-blur';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { borderRadius, glass } from '../../theme';

interface GlassSurfaceProps {
  children: React.ReactNode;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  radius?: keyof typeof borderRadius;
}

export function GlassSurface({
  children,
  intensity = glass.intensity,
  style,
  radius = 'lg',
}: GlassSurfaceProps) {
  return (
    <View style={[
      styles.container,
      glass.shadow,
      { borderRadius: borderRadius[radius] },
      style,
    ]}>
      <BlurView
        intensity={intensity}
        tint={glass.tint}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
  },
  content: {},
});
