/**
 * Login Screen
 */

import { useState } from 'react';
import { View, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, Input, Button, useToast } from '../components/ui';
import { AnkoraLogo } from '../components/icons';
import { useAuthStore } from '../stores/authStore';
import { colors, spacing } from '../theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const router = useRouter();
  const { show, ToastComponent } = useToast();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      show(t('auth.fillAllFields'), 'error');
      return;
    }

    try {
      clearError();
      await login(email.trim(), password);
      // Auth guard in _layout will redirect to /(tabs)
    } catch {
      show(error || t('auth.loginFailed'), 'error');
    }
  };

  const goToSignup = () => {
    router.push('/signup');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ToastComponent />
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <AnkoraLogo width={220} />
        </View>

        <View style={styles.form}>
          <Input
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label={t('auth.password')}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            variant="primary"
            fullWidth
            onPress={handleLogin}
            loading={isLoading}
          >
            {t('auth.login')}
          </Button>
        </View>

        <Pressable onPress={goToSignup} style={styles.link}>
          <Text variant="body" color="secondary">
            {t('auth.noAccount')}{' '}
          </Text>
          <Text variant="body" weight="medium">
            {t('auth.signup')}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.lg,
  },
  logoContainer: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.md,
  },
  link: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
});
