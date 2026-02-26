/**
 * GreetingHeader - Casual greeting and motivational subtitle
 */

import { View, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { colors, spacing, fonts } from '../../theme';

interface GreetingHeaderProps {
  userName?: string;
}

export function GreetingHeader({ userName }: GreetingHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        Hey {userName || 'there'} !
      </Text>
      <Text style={styles.subtitle}>
        It's time to remember what you've seen last few days!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  greeting: {
    fontSize: 20,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    letterSpacing: -0.64,
  },
  subtitle: {
    fontSize: 38,
    fontFamily: fonts.semibold,
    color: colors.text,
    letterSpacing: -1.2,
    lineHeight: 40,
  },
});
