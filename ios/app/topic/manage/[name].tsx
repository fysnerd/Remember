/**
 * Topic Management Screen - Rename or delete a topic globally
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
import { Text, Button, Card } from '../../../components/ui';
import { PlatformIcon } from '../../../components/icons';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useContentList, useRenameUserTopic, useDeleteUserTopic } from '../../../hooks';
import { colors, spacing, borderRadius, layout } from '../../../theme';

export default function TopicManageScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const decodedName = decodeURIComponent(name || '');
  const [newName, setNewName] = useState(decodedName);
  const [isRenaming, setIsRenaming] = useState(false);

  const { data: contentData, isLoading } = useContentList({ topic: decodedName });
  const renameTopic = useRenameUserTopic();
  const deleteTopic = useDeleteUserTopic();

  const items = contentData?.items ?? [];
  const hasNameChanged = newName.trim().toLowerCase() !== decodedName.toLowerCase();

  const handleRename = async () => {
    if (!hasNameChanged || !newName.trim()) return;

    setIsRenaming(true);
    try {
      await renameTopic.mutateAsync({
        oldName: decodedName,
        newName: newName.trim(),
      });
      // Navigate to the new topic screen
      router.replace({
        pathname: '/topic/[name]',
        params: { name: encodeURIComponent(newName.trim().toLowerCase()) },
      });
    } catch (error) {
      console.error('Failed to rename topic:', error);
      Alert.alert('Erreur', 'Impossible de renommer le topic.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer le topic',
      `Êtes-vous sûr de vouloir supprimer "${decodedName}" de ${items.length} contenu(s) ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTopic.mutateAsync(decodedName);
              // Go back to feed
              router.replace('/(tabs)');
            } catch (error) {
              console.error('Failed to delete topic:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le topic.');
            }
          },
        },
      ]
    );
  };

  const handleContentPress = (id: string) => {
    router.push({ pathname: '/content/[id]', params: { id } });
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Gérer le topic',
          headerBackTitle: 'Retour',
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Rename Section */}
        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>
            Renommer
          </Text>
          <View style={styles.renameRow}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nouveau nom..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />
            <Button
              variant="primary"
              onPress={handleRename}
              disabled={!hasNameChanged || isRenaming || renameTopic.isPending}
              style={styles.renameButton}
            >
              {isRenaming ? '...' : 'OK'}
            </Button>
          </View>
        </View>

        {/* Content List */}
        <View style={styles.section}>
          <Text variant="h2" style={styles.sectionTitle}>
            Contenus ({items.length})
          </Text>
          <View style={styles.list}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => handleContentPress(item.id)}
              >
                <Card padding="md" style={styles.card}>
                  <View style={styles.row}>
                    <View style={styles.iconContainer}>
                      <PlatformIcon platform={item.source} size={20} colored />
                    </View>
                    <View style={styles.info}>
                      <Text variant="body" weight="medium" numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <Text variant="h2" style={styles.dangerTitle}>
            Zone de danger
          </Text>
          <Text variant="caption" color="secondary" style={styles.dangerDescription}>
            Supprimer ce topic le retirera de tous vos contenus. Cette action est
            irréversible.
          </Text>
          <Button
            variant="outline"
            onPress={handleDelete}
            disabled={deleteTopic.isPending}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>
              {deleteTopic.isPending ? 'Suppression...' : `Supprimer "${decodedName}"`}
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
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  renameRow: {
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
  renameButton: {
    minWidth: 60,
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
  iconContainer: {
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
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
