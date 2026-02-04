/**
 * Signup Screen
 */

import { useState } from 'react';
import { View, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Input, Button, useToast } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { colors, spacing } from '../theme';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signup, isLoading, error, clearError } = useAuthStore();
  const router = useRouter();
  const { show, ToastComponent } = useToast();

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      show('Veuillez remplir tous les champs', 'error');
      return;
    }

    if (password.length < 6) {
      show('Le mot de passe doit faire au moins 6 caractères', 'error');
      return;
    }

    try {
      clearError();
      await signup(email.trim(), password);
      // Auth guard in _layout will redirect to /(tabs)
    } catch {
      show(error || 'Inscription échouée', 'error');
    }
  };

  const goToLogin = () => {
    router.push('/login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ToastComponent />
      <View style={styles.content}>
        <Text variant="h1" style={styles.title}>
          Créer un compte
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
            onPress={handleSignup}
            loading={isLoading}
          >
            S'inscrire
          </Button>
        </View>

        <Pressable onPress={goToLogin} style={styles.link}>
          <Text variant="body" color="secondary">
            Déjà un compte ?{' '}
          </Text>
          <Text variant="body" weight="medium">
            Se connecter
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
