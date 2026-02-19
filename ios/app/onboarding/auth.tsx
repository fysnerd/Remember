/**
 * Onboarding Step 1: Authentication
 * Apple Sign-In / Google Sign-In / Email (magic link or password)
 */

import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Text, Input, Button, useToast } from '../../components/ui';
import { SocialAuthButton } from '../../components/onboarding/SocialAuthButton';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing } from '../../theme';

type AuthMode = 'initial' | 'email-login' | 'email-signup' | 'magic-link-sent';

export default function AuthScreen() {
  const router = useRouter();
  const { loginWithApple, loginWithGoogle, login, signup, sendMagicLink, isLoading, clearError } = useAuthStore();
  const { show, ToastComponent } = useToast();

  const [mode, setMode] = useState<AuthMode>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);
      clearError();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        await loginWithApple(credential.identityToken, {
          givenName: credential.fullName?.givenName,
          familyName: credential.fullName?.familyName,
        });
        // Auth guard in _layout will handle redirect
      }
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        show('Connexion Apple échouée', 'error');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      clearError();
      // Import dynamically to avoid crash if not configured
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (idToken) {
        await loginWithGoogle(idToken);
      }
    } catch (error: any) {
      if (error.code !== 'SIGN_IN_CANCELLED') {
        show('Connexion Google échouée', 'error');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      show('Entre ton email', 'error');
      return;
    }
    try {
      setMagicLinkLoading(true);
      await sendMagicLink(email.trim().toLowerCase());
      setMode('magic-link-sent');
    } catch {
      show("Impossible d'envoyer le lien", 'error');
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      show('Remplis tous les champs', 'error');
      return;
    }
    try {
      clearError();
      await login(email.trim(), password);
    } catch {
      show('Email ou mot de passe incorrect', 'error');
    }
  };

  const handleEmailSignup = async () => {
    if (!email.trim() || !password.trim()) {
      show('Remplis tous les champs', 'error');
      return;
    }
    if (password.length < 8) {
      show('8 caractères minimum', 'error');
      return;
    }
    try {
      clearError();
      await signup(email.trim(), password);
    } catch {
      show('Inscription échouée', 'error');
    }
  };

  if (mode === 'magic-link-sent') {
    return (
      <SafeAreaView style={styles.container}>
        <ToastComponent />
        <View style={styles.content}>
          <Text variant="h2" style={styles.centered}>
            Vérifie ta boîte mail
          </Text>
          <Text variant="body" color="secondary" style={[styles.centered, { marginTop: spacing.md }]}>
            On a envoyé un lien de connexion à
          </Text>
          <Text variant="body" weight="semibold" style={[styles.centered, { marginTop: spacing.xs }]}>
            {email}
          </Text>
          <Text variant="caption" color="secondary" style={[styles.centered, { marginTop: spacing.xl }]}>
            Le lien expire dans 15 minutes.
          </Text>
          <Pressable onPress={() => setMode('initial')} style={{ marginTop: spacing.xl }}>
            <Text variant="body" color="secondary" style={styles.centered}>
              Utiliser un autre email
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'email-login' || mode === 'email-signup') {
    const isLogin = mode === 'email-login';
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ToastComponent />
          <View style={styles.content}>
            <Text variant="h2" style={styles.centered}>
              {isLogin ? 'Se connecter' : 'Créer un compte'}
            </Text>

            <View style={styles.form}>
              <Input
                label="Email"
                placeholder="ton@email.com"
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
                onPress={isLogin ? handleEmailLogin : handleEmailSignup}
                loading={isLoading}
              >
                {isLogin ? 'Se connecter' : "S'inscrire"}
              </Button>
            </View>

            <View style={styles.switchRow}>
              <Text variant="caption" color="secondary">
                {isLogin ? 'Pas de compte ?' : 'Déjà un compte ?'}
              </Text>
              <Pressable onPress={() => setMode(isLogin ? 'email-signup' : 'email-login')}>
                <Text variant="caption" weight="medium" style={{ color: colors.accent }}>
                  {isLogin ? " S'inscrire" : ' Se connecter'}
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={() => setMode('initial')} style={{ marginTop: spacing.md }}>
              <Text variant="caption" color="secondary" style={styles.centered}>
                Retour
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Initial mode - social buttons + email options
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ToastComponent />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text variant="h1" style={styles.centered}>
              ANKORA
            </Text>
            <Text variant="body" color="secondary" style={[styles.centered, { marginTop: spacing.sm }]}>
              Apprends de ce que tu regardes.
            </Text>
          </View>

          <View style={styles.buttons}>
            <SocialAuthButton
              provider="apple"
              onPress={handleAppleSignIn}
              loading={appleLoading}
            />
            <SocialAuthButton
              provider="google"
              onPress={handleGoogleSignIn}
              loading={googleLoading}
            />

            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text variant="caption" color="secondary" style={styles.separatorText}>ou</Text>
              <View style={styles.separatorLine} />
            </View>

            <View style={styles.emailSection}>
              <Input
                placeholder="ton@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={styles.emailButtons}>
                <Button
                  variant="primary"
                  fullWidth
                  onPress={handleMagicLink}
                  loading={magicLinkLoading}
                >
                  Envoyer un lien magique
                </Button>
                <Pressable
                  onPress={() => {
                    if (email.trim()) setMode('email-login');
                    else show('Entre ton email', 'error');
                  }}
                >
                  <Text variant="caption" color="secondary" style={styles.centered}>
                    Utiliser un mot de passe
                  </Text>
                </Pressable>
              </View>
            </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  centered: {
    textAlign: 'center',
  },
  buttons: {
    gap: spacing.md,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separatorText: {
    marginHorizontal: spacing.md,
  },
  emailSection: {
    gap: spacing.md,
  },
  emailButtons: {
    gap: spacing.sm,
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
});
