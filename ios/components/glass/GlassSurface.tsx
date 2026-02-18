import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { borderRadius, glass } from '../../theme';

const useNativeGlass = isGlassEffectAPIAvailable();

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
  const radiusValue = borderRadius[radius];

  if (useNativeGlass) {
    return (
      <GlassView
        glassEffectStyle={glass.liquidGlass.effect}
        style={[
          styles.container,
          glass.shadow,
          { borderRadius: radiusValue },
          style,
        ]}
      >
        <View style={styles.content}>
          {children}
        </View>
      </GlassView>
    );
  }

  return (
    <View style={[
      styles.container,
      glass.shadow,
      { borderRadius: radiusValue },
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
