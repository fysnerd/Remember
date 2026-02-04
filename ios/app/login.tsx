/**
 * Login Screen
 */

import { useState } from 'react';
import { View, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Input, Button, useToast } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { colors, spacing } from '../theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const router = useRouter();
  const { show, ToastComponent } = useToast();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      show('Veuillez remplir tous les champs', 'error');
      return;
    }

    try {
      clearError();
      await login(email.trim(), password);
      // Auth guard in _layout will redirect to /(tabs)
    } catch {
      show(error || 'Connexion échouée', 'error');
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
        <Text variant="h1" style={styles.title}>
          ANKORA
        </Text>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="votre@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Mot de passe"
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
            Se connecter
          </Button>
        </View>

        <Pressable onPress={goToSignup} style={styles.link}>
          <Text variant="body" color="secondary">
            Pas de compte ?{' '}
          </Text>
          <Text variant="body" weight="medium">
            S'inscrire
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
  title: {
    textAlign: 'center',
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
