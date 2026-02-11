/**
 * Foundation Test Screen
 *
 * Validates all three new native technologies:
 * 1. BlurView (expo-blur)
 * 2. Lucide Icons (lucide-react-native)
 * 3. Geist Font (all 5 weights)
 * 4. Combined test (all three together)
 *
 * Accessible from Profile > Dev Tools > Foundation Test
 * Remove this screen when foundation validation is complete.
 */

import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Home, Search, User, Heart, Star } from 'lucide-react-native';
import { Text } from '../components/ui';
import { colors, spacing, borderRadius, fonts } from '../theme';

export default function DevTestScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Section 1: BlurView Test */}
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            1. BlurView (expo-blur)
          </Text>
          <View style={styles.blurContainer}>
            {/* Colorful background layers */}
            <View style={styles.blurBackground}>
              <View style={styles.blurGold} />
              <View style={styles.blurBlue} />
            </View>
            {/* BlurView overlay */}
            <BlurView
              intensity={40}
              tint="dark"
              style={styles.blurOverlay}
            >
              <Text variant="h2" weight="bold">
                Glass Effect
              </Text>
              <Text variant="caption" color="secondary">
                BlurView intensity=40, tint=dark
              </Text>
            </BlurView>
          </View>
        </View>

        {/* Section 2: Lucide Icons Test */}
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            2. Lucide Icons
          </Text>
          <View style={styles.card}>
            <View style={styles.iconRow}>
              <Home size={28} color={colors.accent} />
              <Search size={28} color={colors.accent} />
              <User size={28} color={colors.accent} />
              <Heart size={28} color={colors.accent} />
              <Star size={28} color={colors.accent} />
            </View>
            <Text variant="caption" color="secondary" style={styles.iconLabel}>
              Lucide Icons (5 of 1500+)
            </Text>
          </View>
        </View>

        {/* Section 3: Geist Font Test */}
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            3. Geist Font Weights
          </Text>
          <View style={styles.card}>
            <Text style={[styles.fontLine, { fontFamily: fonts.light }]}>
              Geist Light 300
            </Text>
            <Text variant="body" weight="regular">
              Geist Regular 400
            </Text>
            <Text variant="body" weight="medium">
              Geist Medium 500
            </Text>
            <Text variant="body" weight="semibold">
              Geist SemiBold 600
            </Text>
            <Text variant="body" weight="bold">
              Geist Bold 700
            </Text>
            <View style={styles.fontTestDivider} />
            <Text variant="body" style={styles.fontTestString}>
              Hamburgefonstivd 0123456789
            </Text>
          </View>
        </View>

        {/* Section 4: Combined Test */}
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionTitle}>
            4. Combined (Blur + Icon + Font)
          </Text>
          <View style={styles.combinedContainer}>
            <View style={styles.combinedBackground}>
              <View style={styles.combinedGradient} />
            </View>
            <BlurView
              intensity={30}
              tint="dark"
              style={styles.combinedBlur}
            >
              <Star size={32} color={colors.accent} />
              <Text variant="h3" weight="bold" style={styles.combinedText}>
                All Systems Go
              </Text>
              <Text variant="caption" color="secondary">
                BlurView + Lucide + Geist working together
              </Text>
            </BlurView>
          </View>
        </View>

        {/* Status summary */}
        <View style={styles.statusCard}>
          <Text variant="label" color="secondary">
            FOUNDATION STATUS
          </Text>
          <View style={styles.statusRow}>
            <Text variant="body">expo-blur</Text>
            <Text variant="body" style={styles.statusCheck}>
              Rendered
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text variant="body">lucide-react-native</Text>
            <Text variant="body" style={styles.statusCheck}>
              Rendered
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text variant="body">@expo-google-fonts/geist</Text>
            <Text variant="body" style={styles.statusCheck}>
              Loaded
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text variant="body">react-native-svg</Text>
            <Text variant="body" style={styles.statusCheck}>
              (via Lucide)
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },

  // BlurView section
  blurContainer: {
    height: 160,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  blurGold: {
    flex: 1,
    backgroundColor: '#D4A574',
  },
  blurBlue: {
    flex: 1,
    backgroundColor: '#3B82F6',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },

  // Card styles
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Icons section
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconLabel: {
    textAlign: 'center',
  },

  // Font section
  fontLine: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  fontTestDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  fontTestString: {
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Combined section
  combinedContainer: {
    height: 140,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  combinedBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  combinedGradient: {
    flex: 1,
    backgroundColor: '#1a1a3e',
  },
  combinedBlur: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  combinedText: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  // Status summary
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusCheck: {
    color: colors.success,
  },
});
