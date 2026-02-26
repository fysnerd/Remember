/**
 * SessionCard - Displays a completed quiz session in the revisions list
 */

import { View, Image, StyleSheet } from 'react-native';
import { GlassCard } from '../glass/GlassCard';
import { PlatformIcon } from '../icons/PlatformIcon';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';
import type { QuizSessionItem } from '../../hooks';

interface SessionCardProps {
  session: QuizSessionItem;
  onPress: () => void;
}

export function SessionCard({ session, onPress }: SessionCardProps) {
  const contentNames = session.contents.map(c => c.title).join(', ');
  const thumbnail = session.contents.find(c => c.thumbnailUrl);
  const platform = session.contents[0]?.platform?.toLowerCase();

  // Pick creator name from the first content that has one
  const creatorName = session.contents.find(c => c.channelName)?.channelName;

  return (
    <GlassCard padding="md" onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        {/* Left: thumbnail */}
        {thumbnail?.thumbnailUrl ? (
          <Image
            source={{ uri: thumbnail.thumbnailUrl }}
            style={styles.thumbnail}
          />
        ) : platform ? (
          <View style={styles.platformIconWrap}>
            <PlatformIcon platform={platform} size={24} colored />
          </View>
        ) : null}

        {/* Right: title + channel */}
        <View style={styles.info}>
          <Text
            variant="body"
            weight="semibold"
            numberOfLines={2}
            style={styles.title}
          >
            {contentNames}
          </Text>
          {creatorName && (
            <Text variant="caption" numberOfLines={1} style={styles.subtitle}>
              {creatorName}
            </Text>
          )}
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumbnail: {
    width: 82,
    height: 62,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
  },
  platformIconWrap: {
    width: 82,
    height: 62,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    letterSpacing: -0.72,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    letterSpacing: -0.48,
  },
});
