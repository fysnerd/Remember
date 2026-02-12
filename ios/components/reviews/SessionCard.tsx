/**
 * SessionCard - Displays a completed quiz session in the revisions list
 */

import { View, Image, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { GlassCard } from '../glass/GlassCard';
import { PlatformIcon } from '../icons/PlatformIcon';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';
import type { QuizSessionItem } from '../../hooks';

interface SessionCardProps {
  session: QuizSessionItem;
  onPress: () => void;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - sessionDay.getTime()) / (1000 * 60 * 60 * 24));

  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return `Aujourd'hui ${time}`;
  if (diffDays === 1) return `Hier ${time}`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return colors.success;
  if (accuracy >= 50) return '#F59E0B'; // amber
  return colors.error;
}

export function SessionCard({ session, onPress }: SessionCardProps) {
  const contentNames = session.contents.map(c => c.title).join(', ');
  const thumbnails = session.contents.filter(c => c.thumbnailUrl).slice(0, 3);
  const platforms = [...new Set(session.contents.map(c => c.platform.toLowerCase()))];
  const accuracyColor = getAccuracyColor(session.accuracy);

  return (
    <GlassCard padding="md" onPress={onPress}>
      <View style={styles.row}>
        {/* Left: thumbnails stack or platform icons */}
        <View style={styles.thumbnailStack}>
          {thumbnails.length > 0 ? (
            thumbnails.map((content, i) => (
              <Image
                key={content.id}
                source={{ uri: content.thumbnailUrl! }}
                style={[
                  styles.thumbnail,
                  { marginLeft: i > 0 ? -12 : 0, zIndex: 3 - i },
                ]}
              />
            ))
          ) : (
            platforms.slice(0, 1).map(p => (
              <View key={p} style={styles.platformIconWrap}>
                <PlatformIcon platform={p} size={20} colored />
              </View>
            ))
          )}
        </View>

        {/* Center: info */}
        <View style={styles.info}>
          <Text variant="body" weight="medium" numberOfLines={1}>
            Quiz - {session.totalCount} question{session.totalCount > 1 ? 's' : ''}
          </Text>
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {contentNames}
          </Text>
          <Text variant="caption" color="tertiary">
            {formatRelativeDate(session.completedAt)}
          </Text>
        </View>

        {/* Right: accuracy badge */}
        <View style={[styles.badge, { backgroundColor: accuracyColor + '20' }]}>
          <Text variant="caption" weight="medium" style={{ color: accuracyColor }}>
            {session.accuracy}%
          </Text>
        </View>

        <ChevronRight size={16} color={colors.textTertiary} strokeWidth={1.75} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    width: 48,
  },
  thumbnail: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  platformIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
    gap: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
});
