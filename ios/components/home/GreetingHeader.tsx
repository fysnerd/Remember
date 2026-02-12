/**
 * GreetingHeader - Time-of-day greeting with user name + review stats
 */

import { View, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { colors, spacing } from '../../theme';

interface GreetingHeaderProps {
  userName?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon apres-midi';
  return 'Bonsoir';
}

export function GreetingHeader({ userName }: GreetingHeaderProps) {
  const greeting = getGreeting();

  return (
    <View style={styles.container}>
      <Text variant="h2">
        {greeting}, {userName || 'there'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
});
