/**
 * Revision card component using GlassCard
 *
 * Displays a revision item with platform icon, title, subtitle, and chevron.
 */

import { View, StyleSheet } from 'react-native';
import { BookOpen, ChevronRight } from 'lucide-react-native';
import { GlassCard } from '../glass/GlassCard';
import { PlatformIcon } from '../icons/PlatformIcon';
import { Text } from '../ui';
import { colors, spacing } from '../../theme';

interface RevisionCardProps {
  title: string;
  subtitle: string;
  platform?: string;
  onPress: () => void;
}

export function RevisionCard({ title, subtitle, platform, onPress }: RevisionCardProps) {
  return (
    <GlassCard padding="md" onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.icon}>
          {platform ? (
            <PlatformIcon platform={platform} size={20} colored />
          ) : (
            <BookOpen size={20} color={colors.textSecondary} strokeWidth={1.75} />
          )}
        </View>
        <View style={styles.info}>
          <Text variant="body" weight="medium" numberOfLines={2}>
            {title}
          </Text>
          <Text variant="caption" color="secondary">
            {subtitle}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textSecondary} strokeWidth={1.75} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
});
