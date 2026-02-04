/**
 * SourcePills - Simple source filter pills for inbox/triage
 *
 * Lightweight version of FilterBar with just the source pills
 */

import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text } from '../ui';
import { colors, spacing, borderRadius } from '../../theme';

type Source = 'all' | 'youtube' | 'spotify' | 'tiktok' | 'instagram';

interface SourcePillsProps {
  selectedSource: Source;
  onSourceChange: (source: Source) => void;
}

const sources: { key: Source; label: string; icon?: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'youtube', label: 'YouTube', icon: '▶' },
  { key: 'spotify', label: 'Spotify', icon: '●' },
  { key: 'tiktok', label: 'TikTok', icon: '♪' },
  { key: 'instagram', label: 'Instagram', icon: '◐' },
];

export function SourcePills({ selectedSource, onSourceChange }: SourcePillsProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sourcesRow}
      >
        {sources.map((source) => {
          const isActive = selectedSource === source.key;
          return (
            <Pressable
              key={source.key}
              style={[styles.sourcePill, isActive && styles.sourcePillActive]}
              onPress={() => onSourceChange(source.key)}
            >
              {source.icon && (
                <Text style={[styles.sourceIcon, isActive && styles.sourceIconActive]}>
                  {source.icon}
                </Text>
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
    paddingHorizontal: spacing.lg,
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
    gap: 6,
  },
  sourcePillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  sourceIcon: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  sourceIconActive: {
    color: colors.background,
  },
  sourceLabel: {
    color: colors.text,
    fontSize: 13,
  },
  sourceLabelActive: {
    color: colors.background,
  },
});
