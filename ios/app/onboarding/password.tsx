/**
 * Password Screen - Login or Signup flow
 *
 * Receives email from auth screen and handles:
 * - Login for existing users
 * - Signup for new users
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Text, Input, Button, useToast } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { haptics } from '../../lib/haptics';
import { colors, spacing, fonts, typography, borderRadius } from '../../theme';

export default function PasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const { login, signup, isLoading, error, clearError } = useAuthStore();
  const router = useRouter();
  const { show, ToastComponent } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      if (!email) {
        router.back();
        return;
      }
      // TODO: Call API to check if email exists
      setIsChecking(false);
      setIsNewUser(false);
    };
    checkUser();
  }, [email]);

  const handleSubmit = async () => {
    if (!password.trim()) {
      show('Entre ton mot de passe', 'error');
      return;
    }

    if (isNewUser) {
      if (password.length < 8) {
        show('8 caracteres minimum', 'error');
        return;
      }
      if (password !== confirmPassword) {
        show('Les mots de passe ne correspondent pas', 'error');
        return;
      }
      try {
        clearError();
        await signup(email!, password);
        haptics.success();
      } catch {
        show(error || 'Inscription echouee', 'error');
      }
    } else {
      try {
        clearError();
        await login(email!, password);
        haptics.success();
      } catch {
        show(error || 'Connexion echouee', 'error');
      }
    }
  };

  const handleBack = () => {
    haptics.light();
    router.back();
  };

  const toggleMode = () => {
    setIsNewUser(!isNewUser);
    setPassword('');
    setConfirmPassword('');
  };

  if (isChecking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text variant="body" color="secondary">Verification...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ToastComponent />

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.content}>
          {/* Title - same style as auth */}
          <View style={styles.titleContainer}>
            <Text style={styles.titleSmall}>
              {isNewUser ? 'Nouveau compte' : 'Content de te revoir'}
            </Text>
            <Text style={styles.title}>
              {email}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Mot de passe"
              placeholder="********"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {isNewUser && (
              <Input
                label="Confirmer"
                placeholder="********"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            )}

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleSubmit}
              loading={isLoading}
            >
              {isNewUser ? "S'inscrire" : 'Se connecter'}
            </Button>

            <Pressable onPress={toggleMode} style={styles.toggleMode}>
              <Text variant="caption" color="secondary">
                {isNewUser ? 'Deja un compte ? ' : 'Pas de compte ? '}
              </Text>
              <Text variant="caption" style={{ color: colors.accent }}>
                {isNewUser ? 'Se connecter' : "S'inscrire"}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
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

  // Content
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Title - matches auth screen pattern
  titleContainer: {
    marginBottom: spacing.xxl,
    paddingRight: spacing.lg,
  },
  titleSmall: {
    ...typography.h3,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    fontFamily: fonts.semibold,
    color: colors.accent,
  },

  // Form
  form: {
    gap: spacing.md,
  },
  toggleMode: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
});
