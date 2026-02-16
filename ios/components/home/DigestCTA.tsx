/**
 * Prominent CTA card on home screen to launch the daily digest.
 *
 * Hides when no cards are due (dueCount === 0).
 */

import { View, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Text } from '../ui';
import { GlassCard } from '../glass/GlassCard';
import { colors, spacing } from '../../theme';

interface DigestCTAProps {
  dueCount: number;
  onPress: () => void;
}

export function DigestCTA({ dueCount, onPress }: DigestCTAProps) {
  if (dueCount === 0) return null;

  return (
    <View style={styles.wrapper}>
      <GlassCard padding="lg" onPress={onPress}>
        <View style={styles.row}>
          <View style={styles.textContainer}>
            <Text variant="body" weight="semibold">
              Revision du jour
            </Text>
            <Text variant="body" color="secondary">
              {dueCount} question{dueCount > 1 ? 's' : ''} a reviser
            </Text>
          </View>
          <ChevronRight size={24} color={colors.textSecondary} />
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    gap: spacing.xs,
  },
});
