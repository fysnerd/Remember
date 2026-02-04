/**
 * TopicEditModal - Modal to edit topics for a content
 */

import { useState, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text, TopicChip, Button } from './ui';
import { colors, spacing, borderRadius, layout } from '../theme';
import { useTopics, useUpdateContentTopics } from '../hooks';

interface TopicEditModalProps {
  visible: boolean;
  onClose: () => void;
  contentId: string;
  currentTopics: string[];
}

export function TopicEditModal({
  visible,
  onClose,
  contentId,
  currentTopics,
}: TopicEditModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(currentTopics);
  const { data: allTopics = [] } = useTopics();
  const updateTopics = useUpdateContentTopics();

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedTopics(currentTopics);
      setInputValue('');
    }
  }, [visible, currentTopics]);

  // Filter suggestions based on input
  const suggestions = inputValue.trim()
    ? allTopics.filter(
        (topic) =>
          topic.toLowerCase().includes(inputValue.toLowerCase()) &&
          !selectedTopics.includes(topic)
      )
    : allTopics.filter((topic) => !selectedTopics.includes(topic)).slice(0, 5);

  const handleAddTopic = (topic: string) => {
    const cleanTopic = topic.toLowerCase().trim();
    if (cleanTopic && !selectedTopics.includes(cleanTopic)) {
      setSelectedTopics([...selectedTopics, cleanTopic]);
    }
    setInputValue('');
  };

  const handleRemoveTopic = (topic: string) => {
    setSelectedTopics(selectedTopics.filter((t) => t !== topic));
  };

  const handleSave = async () => {
    try {
      await updateTopics.mutateAsync({ contentId, tags: selectedTopics });
      onClose();
    } catch (error) {
      console.error('Failed to update topics:', error);
    }
  };

  const handleSubmitInput = () => {
    if (inputValue.trim()) {
      handleAddTopic(inputValue);
    }
  };

  const hasChanges =
    selectedTopics.length !== currentTopics.length ||
    selectedTopics.some((t) => !currentTopics.includes(t));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="h2">Modifier les topics</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text variant="h2">×</Text>
            </Pressable>
          </View>

          {/* Current topics */}
          <View style={styles.section}>
            <Text variant="label" color="secondary" style={styles.sectionLabel}>
              Topics actuels
            </Text>
            <View style={styles.chipContainer}>
              {selectedTopics.length === 0 ? (
                <Text variant="body" color="secondary">
                  Aucun topic
                </Text>
              ) : (
                selectedTopics.map((topic) => (
                  <TopicChip
                    key={topic}
                    label={topic}
                    onRemove={() => handleRemoveTopic(topic)}
                  />
                ))
              )}
            </View>
          </View>

          {/* Add new topic */}
          <View style={styles.section}>
            <Text variant="label" color="secondary" style={styles.sectionLabel}>
              Ajouter un topic
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Nouveau topic..."
                placeholderTextColor={colors.textSecondary}
                value={inputValue}
                onChangeText={setInputValue}
                onSubmitEditing={handleSubmitInput}
                autoCapitalize="none"
                returnKeyType="done"
              />
              {inputValue.trim() && (
                <Pressable onPress={handleSubmitInput} style={styles.addButton}>
                  <Text variant="body" weight="medium">
                    +
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <View style={styles.section}>
              <Text variant="label" color="secondary" style={styles.sectionLabel}>
                Suggestions
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsScroll}
              >
                {suggestions.slice(0, 8).map((topic) => (
                  <TopicChip
                    key={topic}
                    label={topic}
                    onPress={() => handleAddTopic(topic)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              variant="outline"
              onPress={onClose}
              style={styles.actionButton}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onPress={handleSave}
              disabled={!hasChanges || updateTopics.isPending}
              style={styles.actionButton}
            >
              {updateTopics.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: layout.inputHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  addButton: {
    width: layout.inputHeight,
    height: layout.inputHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsScroll: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
