/**
 * Check Email Screen - Magic Link Waiting
 *
 * Shown after the user enters their email and a magic link is sent.
 * They wait here until they click the link in their email.
 */

import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, AppState, AppStateStatus } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Mail, RefreshCw } from 'lucide-react-native';
import { Text, Button, useToast } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { haptics } from '../../lib/haptics';
import { colors, spacing, fonts, typography, borderRadius } from '../../theme';

export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { sendMagicLink, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const { show, ToastComponent } = useToast();
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If the user gets authenticated (magic link verified via deep link), the auth guard
  // in _layout.tsx will redirect them automatically. Nothing to do here.

  // Start cooldown after initial send
  useEffect(() => {
    setCooldown(60);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown > 0]);

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    try {
      setResending(true);
      await sendMagicLink(email);
      haptics.success();
      show('Email sent!', 'success');
      setCooldown(60);
    } catch {
      show('Failed to resend', 'error');
    } finally {
      setResending(false);
    }
  };

  const handleBack = () => {
    haptics.light();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ToastComponent />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Mail size={48} color={colors.accent} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Check your email</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          We sent a sign-in link to
        </Text>
        <Text style={styles.email}>{email}</Text>

        <Text style={styles.instructions}>
          Click the link in the email to sign in. It expires in 15 minutes.
        </Text>

        {/* Resend */}
        <View style={styles.resendSection}>
          <Button
            variant="secondary"
            fullWidth
            onPress={handleResend}
            loading={resending}
            disabled={cooldown > 0}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
          </Button>
        </View>

        {/* Hint */}
        <Text style={styles.hint}>
          Check your spam folder if you don't see it.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    fontFamily: fonts.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  email: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  instructions: {
    ...typography.caption,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  resendSection: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  hint: {
    ...typography.caption,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
