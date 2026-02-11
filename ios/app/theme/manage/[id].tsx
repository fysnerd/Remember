/**
 * Theme Management Screen - Rename, edit emoji/color, remove content, or delete a theme
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { Text, Button, Card } from '../../../components/ui';
import { PlatformIcon } from '../../../components/icons';
import { LoadingScreen } from '../../../components/LoadingScreen';
import {
  useThemeDetail,
  useUpdateTheme,
  useDeleteTheme,
  useRemoveContentFromTheme,
} from '../../../hooks';
import { colors, spacing, borderRadius, layout } from '../../../theme';

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

export default function ThemeManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useThemeDetail(id);
  const updateTheme = useUpdateTheme();
  const deleteTheme = useDeleteTheme();
  const removeContent = useRemoveContentFromTheme();

  const theme = data?.theme;
  const contents = data?.contents ?? [];

  const [newName, setNewName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize local state from fetched theme data (once)
  if (theme && !initialized) {
    setNewName(theme.name);
    setSelectedEmoji(theme.emoji);
    setSelectedColor(theme.color);
    setInitialized(true);
  }

  const hasChanges =
    initialized &&
    theme &&
    (newName.trim() !== theme.name ||
      selectedEmoji !== theme.emoji ||
      selectedColor !== theme.color);

  const handleSave = async () => {
    if (!hasChanges || !id) return;

    try {
      const body: { id: string; name?: string; emoji?: string; color?: string } = { id };
      if (newName.trim() !== theme!.name) body.name = newName.trim();
      if (selectedEmoji !== theme!.emoji) body.emoji = selectedEmoji;
      if (selectedColor !== theme!.color) body.color = selectedColor;

      await updateTheme.mutateAsync(body);
      router.replace({ pathname: '/theme/[id]' as any, params: { id } });
    } catch (error) {
      console.error('Failed to update theme:', error);
      Alert.alert('Erreur', 'Impossible de mettre a jour le theme.');
    }
  };

  const handleRemoveContent = async (contentId: string) => {
    if (!id) return;
    try {
      await removeContent.mutateAsync({ themeId: id, contentId });
    } catch (error) {
      console.error('Failed to remove content from theme:', error);
      Alert.alert('Erreur', 'Impossible de retirer le contenu du theme.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer le theme',
      'Supprimer ce theme le retirera de votre liste. Les contenus seront conserves.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTheme.mutateAsync(id!);
              router.replace('/(tabs)');
            } catch (error) {
              console.error('Failed to delete theme:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le theme.');
            }
          },
        },
      ]
    );
  };

  const handleContentPress = (contentId: string) => {
    router.push({ pathname: '/content/[id]', params: { id: contentId } });
  };

  if (isLoading || !initialized) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Gerer le theme',
          headerBackTitle: 'Retour',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Rename Section */}
        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>
            Nom
          </Text>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="Nom du theme..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
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

        {/* Save Button */}
        <View style={styles.saveSection}>
          <Button
            variant="primary"
            fullWidth
            onPress={handleSave}
            disabled={!hasChanges || updateTheme.isPending}
          >
            {updateTheme.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </View>

        {/* Content List */}
        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>
            Contenus ({contents.length})
          </Text>
          <View style={styles.list}>
            {contents.map((item) => (
              <Card key={item.id} padding="md" style={styles.card}>
                <View style={styles.row}>
                  <Pressable
                    style={styles.contentInfo}
                    onPress={() => handleContentPress(item.id)}
                  >
                    <View style={styles.iconContainer}>
                      <PlatformIcon platform={item.source} size={20} colored />
                    </View>
                    <View style={styles.info}>
                      <Text variant="body" weight="medium" numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemoveContent(item.id)}
                    hitSlop={8}
                    style={styles.removeButton}
                  >
                    <X size={16} color={colors.error} strokeWidth={2} />
                  </Pressable>
                </View>
              </Card>
            ))}
            {contents.length === 0 && (
              <Text variant="caption" color="secondary">
                Aucun contenu dans ce theme
              </Text>
            )}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <Text variant="h2" style={styles.dangerTitle}>
            Zone de danger
          </Text>
          <Text variant="caption" color="secondary" style={styles.dangerDescription}>
            Supprimer ce theme le retirera de votre liste. Les contenus seront conserves.
          </Text>
          <Button
            variant="outline"
            onPress={handleDelete}
            disabled={deleteTheme.isPending}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>
              {deleteTheme.isPending ? 'Suppression...' : `Supprimer "${theme?.name}"`}
            </Text>
          </Button>
        </View>
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
  saveSection: {
    marginBottom: spacing.xl,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    marginBottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  dangerSection: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  dangerTitle: {
    color: colors.error,
    marginBottom: spacing.sm,
  },
  dangerDescription: {
    marginBottom: spacing.lg,
  },
  deleteButton: {
    borderColor: colors.error,
  },
  deleteButtonText: {
    color: colors.error,
  },
});
