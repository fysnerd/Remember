/**
 * GreetingHeader - Casual greeting, motivational subtitle, and streak counter
 */

import { View, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { Text } from '../ui';
import { colors, spacing, fonts } from '../../theme';

interface GreetingHeaderProps {
  userName?: string;
  streak?: number;
}

export function GreetingHeader({ userName, streak }: GreetingHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.greeting}>
          Hey {userName || 'there'} !
        </Text>
        <Text style={styles.subtitle}>
          It's time to remember what you've seen last few days!
        </Text>
      </View>
      {streak != null && streak > 0 && (
        <View style={styles.streakRow}>
          <Text style={styles.streakText}>{streak}</Text>
          <Flame size={18} color="#FF6B35" fill="#FF6B35" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  textBlock: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  greeting: {
    fontSize: 18,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    letterSpacing: -0.64,
  },
  subtitle: {
    fontSize: 34,
    fontFamily: fonts.semibold,
    color: colors.text,
    letterSpacing: -1.2,
    lineHeight: 34,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  streakText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.text,
  },
});
