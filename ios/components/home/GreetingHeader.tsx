/**
 * GreetingHeader - Time-of-day greeting with user name + review stats
 */

import { View, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { colors, spacing } from '../../theme';

interface GreetingHeaderProps {
  userName?: string;
  stats?: { todayCount: number; streak: number };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon apres-midi';
  return 'Bonsoir';
}

export function GreetingHeader({ userName, stats }: GreetingHeaderProps) {
  const greeting = getGreeting();

  return (
    <View style={styles.container}>
      <Text variant="h2">
        {greeting}, {userName || 'there'}
      </Text>

      {stats != null && (
        <View style={styles.statsRow}>
          <Text variant="caption" color="secondary">
            {stats.todayCount} revision{stats.todayCount !== 1 ? 's' : ''} aujourd'hui
          </Text>
          <Text variant="caption" color="secondary" style={styles.statsDot}>
            {'\u00B7'}
          </Text>
          <Text variant="caption" color="secondary">
            Serie: {stats.streak} jour{stats.streak !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statsDot: {
    marginHorizontal: spacing.xs,
  },
});
