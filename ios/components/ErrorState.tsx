/**
 * Error state component
 */

import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TriangleAlert } from 'lucide-react-native';
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
        <TriangleAlert size={48} color={colors.error} strokeWidth={1.5} />
        <Text variant="body" color="secondary" style={styles.message}>
          {message}
        </Text>
        {onRetry && (
          <Button variant="outline" onPress={onRetry}>
            Reessayer
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
    gap: spacing.md,
  },
  message: {
    textAlign: 'center',
  },
});
