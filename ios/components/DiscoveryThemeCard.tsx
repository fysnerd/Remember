/**
 * DiscoveryThemeCard - Editable card for the theme discovery onboarding flow
 *
 * Shows emoji, editable name, color bar, content count,
 * and action buttons for merge and dismiss.
 */

import { useState, useRef } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Text } from './ui';
import { colors, spacing, borderRadius, shadows } from '../theme';

interface DiscoveryThemeCardProps {
  id: string;
  name: string;
  emoji: string;
  color: string;
  contentCount: number;
  onRename: (id: string, newName: string) => void;
  onMerge: (sourceId: string) => void;
  onDismiss: (id: string) => void;
}

export function DiscoveryThemeCard({
  id,
  name,
  emoji,
  color,
  contentCount,
  onRename,
  onMerge,
  onDismiss,
}: DiscoveryThemeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<TextInput>(null);

  const handleStartEdit = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleEndEdit = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) {
      onRename(id, trimmed);
    } else {
      setEditValue(name);
    }
  };

  return (
    <View style={styles.card}>
      <View style={[styles.colorBar, { backgroundColor: color }]} />
      <View style={styles.mainContent}>
        <View style={styles.topRow}>
          <Text style={styles.emoji}>{emoji}</Text>
          <View style={styles.nameContainer}>
            {isEditing ? (
              <TextInput
                ref={inputRef}
                value={editValue}
                onChangeText={setEditValue}
                onBlur={handleEndEdit}
                onSubmitEditing={handleEndEdit}
                style={styles.nameInput}
                returnKeyType="done"
                selectTextOnFocus
              />
            ) : (
              <Pressable onPress={handleStartEdit}>
                <Text variant="body" weight="medium" numberOfLines={1}>
                  {editValue}
                </Text>
              </Pressable>
            )}
            <Text variant="caption" color="secondary">
              {contentCount} contenu{contentCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => onMerge(id)}
            style={({ pressed }) => [styles.mergeButton, pressed && styles.buttonPressed]}
          >
            <Text variant="caption" weight="medium" style={styles.mergeText}>
              Fusionner
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onDismiss(id)}
            style={({ pressed }) => [styles.dismissButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.dismissText}>X</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  colorBar: {
    width: 4,
  },
  mainContent: {
    flex: 1,
    padding: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  nameContainer: {
    flex: 1,
  },
  nameInput: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingVertical: 2,
    marginBottom: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  mergeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  mergeText: {
    color: colors.textSecondary,
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  },
  buttonPressed: {
    opacity: 0.6,
  },
});
