/**
 * Onboarding Step 1: Authentication
 *
 * Full dark mode, consistent with app design system.
 * Logo, tagline, social auth, email input.
 */

import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Input, Button, useToast } from '../../components/ui';
import { SocialAuthButton } from '../../components/onboarding/SocialAuthButton';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, fonts, typography, borderRadius } from '../../theme';

export default function AuthScreen() {
  const router = useRouter();
  const { loginWithApple, loginWithGoogle, login, clearError } = useAuthStore();
  const { show, ToastComponent } = useToast();

  const [email, setEmail] = useState('');
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);
      clearError();
      const AppleAuthentication = await import('expo-apple-authentication');
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
      }
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        show('Apple Sign-In indisponible', 'error');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      clearError();
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (idToken) {
        await loginWithGoogle(idToken);
      }
    } catch (error: any) {
      if (error.code !== 'SIGN_IN_CANCELLED') {
        show('Google Sign-In indisponible', 'error');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailContinue = () => {
    if (!email.trim()) {
      show('Entre ton email', 'error');
      return;
    }
    router.push({
      pathname: '/onboarding/password',
      params: { email: email.trim().toLowerCase() },
    });
  };

  const handleDevLogin = async () => {
    try {
      setDevLoading(true);
      clearError();
      await login('test@remember.app', 'testpassword123');
    } catch {
      show('Dev login failed', 'error');
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ToastComponent />

        <View style={styles.content}>
          {/* Logo horizontal: symbol + wordmark */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/ankora-symbol.png')}
              style={styles.logoSymbol}
              resizeMode="contain"
            />
            <Image
              source={require('../../assets/images/ankora-wordmark.png')}
              style={styles.logoWordmark}
              resizeMode="contain"
            />
          </View>

          {/* Tagline */}
          <View style={styles.taglineContainer}>
            <Text style={styles.taglineSmall}>
              BIENVENUE SUR ANKORA
            </Text>
            <Text style={styles.tagline}>
              Transforme ce que tu{'\n'}regardes en connaissances{'\n'}durables.
            </Text>
          </View>

          {/* Auth options */}
          <View style={styles.authSection}>
            {/* Social buttons */}
            <View style={styles.socialButtons}>
              <SocialAuthButton
                provider="apple"
                onPress={handleAppleSignIn}
                loading={appleLoading}
                disabled={googleLoading}
              />
              <SocialAuthButton
                provider="google"
                onPress={handleGoogleSignIn}
                loading={googleLoading}
                disabled={appleLoading}
              />
            </View>

            {/* Separator */}
            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>ou</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Email */}
            <Input
              placeholder="ton@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Button
              variant="primary"
              fullWidth
              size="lg"
              onPress={handleEmailContinue}
            >
              Continuer
            </Button>

            {Platform.OS === 'web' && (
              <Button
                variant="secondary"
                fullWidth
                onPress={handleDevLogin}
                loading={devLoading}
              >
                Dev Login
              </Button>
            )}
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

  // Logo
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  logoSymbol: {
    width: 36,
    height: 36,
  },
  logoWordmark: {
    width: 90,
    height: 20,
  },

  // Tagline
  taglineContainer: {
    marginBottom: spacing.xl,
  },
  taglineSmall: {
    ...typography.caption,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.h1,
    fontFamily: fonts.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  // Auth section
  authSection: {
    gap: spacing.md + 4,
  },
  socialButtons: {
    gap: spacing.md,
  },

  // Separator
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separatorText: {
    ...typography.label,
    fontFamily: fonts.regular,
    color: colors.textTertiary,
  },
});
