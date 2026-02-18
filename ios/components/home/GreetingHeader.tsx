/**
 * GreetingHeader - Time-of-day greeting with user name + daily progress dots
 */

import { View, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { colors, spacing, fonts } from '../../theme';
import type { DailyProgress } from '../../types/content';

interface GreetingHeaderProps {
  userName?: string;
  dailyProgress?: DailyProgress;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon apres-midi';
  return 'Bonsoir';
}

export function GreetingHeader({ userName, dailyProgress }: GreetingHeaderProps) {
  const greeting = getGreeting();

  return (
    <View style={styles.container}>
      <Text variant="h2">
        {greeting}, {userName || 'there'}
      </Text>
      {dailyProgress && dailyProgress.total > 0 && (
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {dailyProgress.completed}/{dailyProgress.total} quiz du jour
          </Text>
          <View style={styles.dots}>
            {Array.from({ length: dailyProgress.total }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < dailyProgress.completed ? styles.dotFilled : styles.dotEmpty,
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  progressText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: colors.accent,
  },
  dotEmpty: {
    backgroundColor: colors.surfaceElevated,
  },
});
