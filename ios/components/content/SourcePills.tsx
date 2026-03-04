/**
 * SourcePills - Simple source filter pills for inbox/triage
 *
 * Lightweight version of FilterBar with just the source pills
 */

import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text } from '../ui';
import { PlatformIcon } from '../icons';
import { colors, spacing, borderRadius, typography } from '../../theme';

type Source = 'all' | 'youtube' | 'spotify' | 'tiktok' | 'instagram';

interface SourcePillsProps {
  selectedSource: Source;
  onSourceChange: (source: Source) => void;
  /** If provided, only show sources present in this list (+ "all") */
  availableSources?: string[];
}

const sources: { key: Source; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'spotify', label: 'Spotify' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' },
];

export function SourcePills({ selectedSource, onSourceChange, availableSources }: SourcePillsProps) {
  const filteredSources = availableSources
    ? sources.filter((s) => s.key === 'all' || availableSources.includes(s.key))
    : sources;

  // Don't show pills if only "all" would be visible (0 or 1 platform)
  if (filteredSources.length <= 2) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sourcesRow}
      >
        {filteredSources.map((source) => {
          const isActive = selectedSource === source.key;
          return (
            <Pressable
              key={source.key}
              style={[styles.sourcePill, isActive && styles.sourcePillActive]}
              onPress={() => onSourceChange(source.key)}
            >
              {source.key !== 'all' && (
                <PlatformIcon
                  platform={source.key}
                  size={10}
                  color={isActive ? colors.background : colors.textSecondary}
                />
              )}
              <Text
                variant="caption"
                weight={isActive ? 'medium' : 'regular'}
                style={[styles.sourceLabel, isActive && styles.sourceLabelActive]}
              >
                {source.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.md,
  },
  sourcesRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm - spacing.xxs,
  },
  sourcePillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  sourceLabel: {
    color: colors.text,
    ...typography.captionSmall,
  },
  sourceLabelActive: {
    color: colors.background,
  },
});
