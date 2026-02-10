/**
 * Theme Creation Screen - Create a new theme with name, emoji, and color
 */

import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Text, Button } from '../components/ui';
import { useCreateTheme } from '../hooks';
import { colors, spacing, borderRadius, layout } from '../theme';

const EMOJI_PALETTE = [
  '\u{1F4DA}', '\u{1F3B5}', '\u{1F4BB}', '\u{1F9E0}', '\u{1F3AE}',
  '\u{1F3CB}\u{FE0F}', '\u{1F4B0}', '\u{1F3A8}', '\u{1F30D}', '\u{1F52C}',
  '\u{1F4CA}', '\u{1F3E5}', '\u{1F3AC}', '\u{1F373}', '\u{2708}\u{FE0F}',
  '\u{1F4F1}', '\u{1F527}', '\u{1F4A1}', '\u{1F3AF}', '\u{2764}\u{FE0F}',
];

const COLOR_PALETTE = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#3B82F6',
  '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#06B6D4', '#84CC16',
];

export default function ThemeCreateScreen() {
  const router = useRouter();
  const createTheme = useCreateTheme();

  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_PALETTE[0]);
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);

  const isValid = name.trim().length >= 2;

  const handleCreate = async () => {
    if (!isValid) return;

    try {
      await createTheme.mutateAsync({
        name: name.trim(),
        emoji: selectedEmoji,
        color: selectedColor,
      });
      router.back();
    } catch (error: any) {
      if (error?.response?.status === 409) {
        Alert.alert('Erreur', 'Un theme avec ce nom existe deja.');
      } else {
        console.error('Failed to create theme:', error);
        Alert.alert('Erreur', 'Impossible de creer le theme.');
      }
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Nouveau theme',
          headerBackTitle: 'Retour',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Name Input */}
        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>
            Nom
          </Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nom du theme..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoFocus
          />
          {name.length > 0 && name.trim().length < 2 && (
            <Text variant="caption" style={styles.hint}>
              Le nom doit contenir au moins 2 caracteres
            </Text>
          )}
        </View>

        {/* Emoji Palette */}
        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>
            Emoji
          </Text>
          <View style={styles.palette}>
            {EMOJI_PALETTE.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => setSelectedEmoji(emoji)}
                style={[
                  styles.emojiOption,
                  selectedEmoji === emoji && styles.emojiOptionSelected,
                ]}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Color Palette */}
        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>
            Couleur
          </Text>
          <View style={styles.palette}>
            {COLOR_PALETTE.map((color) => (
              <Pressable
                key={color}
                onPress={() => setSelectedColor(color)}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorOptionSelected,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Preview */}
        <View style={styles.previewSection}>
          <Text variant="caption" color="secondary" style={styles.previewLabel}>
            Apercu
          </Text>
          <View style={[styles.previewCard, { borderLeftColor: selectedColor }]}>
            <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
            <Text variant="body" weight="medium">
              {name.trim() || 'Mon theme'}
            </Text>
          </View>
        </View>

        {/* Create Button */}
        <Button
          variant="primary"
          fullWidth
          onPress={handleCreate}
          disabled={!isValid || createTheme.isPending}
        >
          {createTheme.isPending ? 'Creation...' : 'Creer'}
        </Button>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
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
  input: {
    height: layout.inputHeight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  hint: {
    color: colors.error,
    marginTop: spacing.xs,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emojiOption: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  emojiText: {
    fontSize: 24,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: colors.accent,
  },
  previewSection: {
    marginBottom: spacing.xl,
  },
  previewLabel: {
    marginBottom: spacing.sm,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
    gap: spacing.sm,
  },
  previewEmoji: {
    fontSize: 24,
  },
});
