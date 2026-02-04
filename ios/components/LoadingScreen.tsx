/**
 * Loading screen shown during auth check
 */

import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from './ui';
import { colors, spacing } from '../theme';

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text variant="body" color="secondary" style={styles.text}>
        Chargement...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  text: {
    marginTop: spacing.md,
  },
});
