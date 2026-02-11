/**
 * FilterBar - Refined minimal filter system
 *
 * Design: Source pills in a horizontal row, collapsible secondary filters
 * Aesthetic: Editorial wireframe - clean lines, intentional spacing
 */

import { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Modal } from 'react-native';
import { Check, X, ChevronDown } from 'lucide-react-native';
import { Text } from '../ui';
import { PlatformIcon } from '../icons';
import { colors, spacing, borderRadius, shadows } from '../../theme';

type Source = 'all' | 'youtube' | 'spotify' | 'tiktok' | 'instagram';

interface Channel {
  name: string;
  count: number;
}

interface FilterBarProps {
  selectedSource: Source;
  selectedTopic: string | null;
  selectedChannel: string | null;
  topics: string[];
  channels: Channel[];
  onSourceChange: (source: Source) => void;
  onTopicChange: (topic: string | null) => void;
  onChannelChange: (channel: string | null) => void;
}

const sources: { key: Source; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'spotify', label: 'Spotify' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' },
];

export function FilterBar({
  selectedSource,
  selectedTopic,
  selectedChannel,
  topics,
  channels,
  onSourceChange,
  onTopicChange,
  onChannelChange,
}: FilterBarProps) {
  const [topicModalVisible, setTopicModalVisible] = useState(false);
  const [channelModalVisible, setChannelModalVisible] = useState(false);

  const hasSecondaryFilters = topics.length > 0 || channels.length > 0;
  const hasActiveFilters = selectedTopic || selectedChannel;

  return (
    <View style={styles.container}>
      {/* Source pills - primary filter */}
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

      {/* Secondary filters row */}
      {hasSecondaryFilters && (
        <View style={styles.secondaryRow}>
          {/* Channel filter */}
          {channels.length > 0 && (
            <Pressable
              style={[styles.filterButton, selectedChannel && styles.filterButtonActive]}
              onPress={() => setChannelModalVisible(true)}
            >
              <Text style={[styles.filterLabel, selectedChannel && styles.filterLabelActive]}>
                {selectedChannel || 'Chaîne'}
              </Text>
              <ChevronDown size={12} color={selectedChannel ? colors.background : colors.textTertiary} strokeWidth={2} />
            </Pressable>
          )}

          {/* Topic filter */}
          {topics.length > 0 && (
            <Pressable
              style={[styles.filterButton, selectedTopic && styles.filterButtonActive]}
              onPress={() => setTopicModalVisible(true)}
            >
              <Text style={[styles.filterLabel, selectedTopic && styles.filterLabelActive]}>
                {selectedTopic || 'Topic'}
              </Text>
              <ChevronDown size={12} color={selectedTopic ? colors.background : colors.textTertiary} strokeWidth={2} />
            </Pressable>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <Pressable
              style={styles.clearButton}
              onPress={() => {
                onTopicChange(null);
                onChannelChange(null);
              }}
            >
              <X size={14} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      )}

      {/* Channel Modal */}
      <FilterModal
        visible={channelModalVisible}
        title="Filtrer par chaîne"
        onClose={() => setChannelModalVisible(false)}
      >
        <ModalOption
          label="Toutes les chaînes"
          isSelected={!selectedChannel}
          onPress={() => {
            onChannelChange(null);
            setChannelModalVisible(false);
          }}
        />
        {channels.map((channel) => (
          <ModalOption
            key={channel.name}
            label={channel.name}
            subtitle={`${channel.count} contenu${channel.count > 1 ? 's' : ''}`}
            isSelected={selectedChannel === channel.name}
            onPress={() => {
              onChannelChange(channel.name);
              setChannelModalVisible(false);
            }}
          />
        ))}
      </FilterModal>

      {/* Topic Modal */}
      <FilterModal
        visible={topicModalVisible}
        title="Filtrer par topic"
        onClose={() => setTopicModalVisible(false)}
      >
        <ModalOption
          label="Tous les topics"
          isSelected={!selectedTopic}
          onPress={() => {
            onTopicChange(null);
            setTopicModalVisible(false);
          }}
        />
        {topics.map((topic) => (
          <ModalOption
            key={topic}
            label={topic}
            isSelected={selectedTopic === topic}
            onPress={() => {
              onTopicChange(topic);
              setTopicModalVisible(false);
            }}
          />
        ))}
      </FilterModal>
    </View>
  );
}

// Reusable modal component
function FilterModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.modalSheet}>
          {/* Handle */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <Text variant="body" weight="medium">
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={16} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Options */}
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

// Modal option row
function ModalOption({
  label,
  subtitle,
  isSelected,
  onPress,
}: {
  label: string;
  subtitle?: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
      onPress={onPress}
    >
      <View style={styles.modalOptionContent}>
        <Text
          variant="body"
          weight={isSelected ? 'medium' : 'regular'}
          numberOfLines={1}
          style={isSelected ? styles.modalOptionLabelSelected : undefined}
        >
          {label}
        </Text>
        {subtitle && (
          <Text variant="caption" color="secondary" style={styles.modalOptionSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>
      {isSelected && <Check size={16} color={colors.text} strokeWidth={2.5} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.md,
  },

  // Source pills
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
  sourceLabel: {
    color: colors.text,
    fontSize: 13,
  },
  sourceLabelActive: {
    color: colors.background,
  },

  // Secondary filters
  secondaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
    minWidth: 90,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterButtonActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  filterLabel: {
    color: colors.text,
    fontSize: 13,
  },
  filterLabelActive: {
    color: colors.background,
  },
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.overlayStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: 34, // Safe area
    maxHeight: '70%',
    ...shadows.lg,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  modalOptionSelected: {
    backgroundColor: colors.overlay,
  },
  modalOptionContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  modalOptionLabelSelected: {
    color: colors.text,
  },
  modalOptionSubtitle: {
    marginTop: 2,
  },
});
