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
import { colors, spacing, fonts, typography } from '../../theme';

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

          {/* Tagline - same style as home */}
          <View style={styles.taglineContainer}>
            <Text style={styles.taglineSmall}>
              Bienvenue sur Ankora
            </Text>
            <Text style={styles.tagline}>
              Transforme ce que tu regardes en connaissances durables.
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
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },

  // Logo
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  logoSymbol: {
    width: 44,
    height: 44,
  },
  logoWordmark: {
    width: 100,
    height: 24,
  },

  // Tagline - matches GreetingHeader pattern
  taglineContainer: {
    marginBottom: spacing.xxl,
    paddingRight: spacing.lg,
  },
  taglineSmall: {
    ...typography.h3,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  tagline: {
    ...typography.jumbo,
    fontFamily: fonts.semibold,
    color: colors.text,
    letterSpacing: -1.2,
  },
  // Auth section
  authSection: {
    gap: spacing.md,
  },
  socialButtons: {
    gap: spacing.sm,
  },

  // Separator
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separatorText: {
    ...typography.caption,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});
