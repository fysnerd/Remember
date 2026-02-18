/**
 * Onboarding - Magic Link Screen
 *
 * Email-based passwordless authentication.
 * Sends a magic link and shows confirmation.
 * Progress: 0.25
 */

import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingScreen } from '../../components/onboarding/OnboardingScreen';
import { Input, Button, Text } from '../../components/ui';
import api from '../../lib/api';
import { colors, spacing } from '../../theme';

export default function OnboardingMagicLink() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Countdown timer after sending
  useEffect(() => {
    if (sent && !canResend) {
      setCountdown(30);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sent, canResend]);

  const handleSend = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await api.post('/auth/magic-link/send', { email: email.trim().toLowerCase() });
      setSent(true);
      setCanResend(false);
    } catch {
      setError("Impossible d'envoyer le lien. Verifie ton email et reessaie.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setCanResend(false);
    await handleSend();
  };

  if (sent) {
    return (
      <OnboardingScreen
        progress={0.25}
        title="Verifie ta boite mail !"
        subtitle="Un lien de connexion t'a ete envoye."
        showBack
        onBack={() => router.back()}
      >
        <View style={styles.sentContainer}>
          <Text variant="body" color="secondary" style={styles.emailSent}>
            Email envoye a {email}
          </Text>

          {canResend ? (
            <Button variant="outline" fullWidth onPress={handleResend} loading={isLoading}>
              Renvoyer
            </Button>
          ) : (
            <Text variant="caption" color="secondary" style={styles.countdown}>
              Renvoyer dans {countdown}s
            </Text>
          )}
        </View>
      </OnboardingScreen>
    );
  }

  return (
    <OnboardingScreen
      progress={0.25}
      title="Connexion par email"
      showBack
      onBack={() => router.back()}
      footer={
        <Button
          fullWidth
          disabled={!isValidEmail}
          loading={isLoading}
          onPress={handleSend}
        >
          Envoyer le lien
        </Button>
      }
    >
      <Input
        label="Adresse email"
        placeholder="ton@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={error ?? undefined}
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  sentContainer: {
    alignItems: 'center',
    gap: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emailSent: {
    textAlign: 'center',
  },
  countdown: {
    textAlign: 'center',
  },
});
