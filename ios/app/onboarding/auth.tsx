/**
 * Onboarding Step 1: Authentication
 *
 * Full dark mode, consistent with app design system.
 * Logo, tagline, social auth, email input.
 */

import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text, Input, Button, useToast } from '../../components/ui';
import { AnkoraLogo } from '../../components/icons';
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
        show('Apple Sign-In unavailable', 'error');
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
        show('Google Sign-In unavailable', 'error');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailContinue = () => {
    if (!email.trim()) {
      show('Enter your email', 'error');
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={20}
      >
        <ToastComponent />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <AnkoraLogo width={140} />
          </View>

          {/* Tagline */}
          <View style={styles.taglineContainer}>
            <Text style={styles.tagline}>
              Turn what you watch into lasting knowledge.
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
              <Text style={styles.separatorText}>or</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Email */}
            <Input
              placeholder="your@email.com"
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
              Continue
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
        </ScrollView>
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
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.xxl * 2,
  },

  // Logo
  logoContainer: {
    alignItems: 'flex-start',
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl * 1.25,
  },

  // Tagline
  taglineContainer: {
    marginBottom: spacing.xxl,
    paddingRight: spacing.lg,
  },
  tagline: {
    ...typography.jumbo,
    lineHeight: 40,
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
