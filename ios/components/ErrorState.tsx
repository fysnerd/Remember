/**
 * Error state component
 */

import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button } from './ui';
import { colors, spacing } from '../theme';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  /** Set to true when used in a screen with a header (skips top safe area) */
  hasHeader?: boolean;
}

export function ErrorState({ message, onRetry, hasHeader = false }: ErrorStateProps) {
  const edges = hasHeader ? ['bottom'] : ['top', 'bottom'];

  return (
    <SafeAreaView style={styles.container} edges={edges as any}>
      <View style={styles.content}>
        <Text variant="h1" style={styles.icon}>
          ⚠️
        </Text>
        <Text variant="body" color="secondary" style={styles.message}>
          {message}
        </Text>
        {onRetry && (
          <Button variant="outline" onPress={onRetry}>
            Réessayer
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  message: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
