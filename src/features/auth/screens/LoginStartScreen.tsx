import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { AppIcon } from '@/src/components/common/AppIcon';
import { AppInput } from '@/src/components/form';
import { AppScreen } from '@/src/components/layout/AppScreen';
import { AppModal, useAppAlert } from '@/src/components/modal';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { AuthActionPanel } from '@/src/features/auth/components/AuthActionPanel';
import { AuthBrandHero } from '@/src/features/auth/components/AuthBrandHero';
import { PasswordVisibilityButton } from '@/src/features/auth/components/PasswordVisibilityButton';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import type { KakaoLinkChallenge, KakaoSession } from '@/src/features/auth/services/kakaoAuthContract';
import {
  confirmKakaoLinkWithLocalPassword,
  KakaoAuthError,
  loadRemoteUserProfile,
  startKakaoLogin,
} from '@/src/features/auth/services/kakaoAuthService';
import {
  clearSignupTransaction,
  loadSignupTransaction,
} from '@/src/features/auth/signup/services/signupTransactionStore';
import {
  consentStore,
  getSignupConsentUserId,
} from '@/src/features/auth/terms';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import { usePetStore } from '@/src/features/pet/PetStore';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

export function LoginStartScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const showAlert = useAppAlert();
  const { activateRemoteSession, prepareRemoteSignup } = useAuthSession();
  const { deleteUserProfileData, registerRemoteProfile } = useMyPageStore();
  const { deleteUserPetData } = usePetStore();
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<KakaoLinkChallenge | null>(null);
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [linkError, setLinkError] = useState<string>();

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const showKakaoError = (error: unknown) => {
    if (error instanceof KakaoAuthError && error.kind === 'cancelled') return;
    showAlert(
      '카카오 로그인을 완료하지 못했어요',
      error instanceof KakaoAuthError
        ? error.message
        : '잠시 후 다시 시도해주세요.',
    );
  };

  const finishKakaoLogin = async (session: KakaoSession) => {
    if (session.isNew) {
      const storedTransaction = await loadSignupTransaction(session.uid);
      const cleanupResults = await Promise.allSettled([
        deleteUserPetData(session.uid),
        deleteUserProfileData(session.uid),
        consentStore.deleteHistory(session.uid),
        storedTransaction.transaction
          ? consentStore.deleteHistory(
              getSignupConsentUserId(storedTransaction.transaction.sessionId),
            )
          : Promise.resolve(),
      ]);
      const cleanupFailure = cleanupResults.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      if (cleanupFailure) throw cleanupFailure.reason;
      await clearSignupTransaction(session.uid);
      await prepareRemoteSignup(session);
      return;
    }

    const profile = await loadRemoteUserProfile(session.accessToken);
    if (profile.uid !== session.uid || profile.isNew) {
      throw new Error('kakao-profile-mismatch');
    }
    await registerRemoteProfile(profile);
    await activateRemoteSession(session);
  };

  const handleKakaoLogin = async () => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const outcome = await startKakaoLogin();
      if (outcome.kind === 'link-required') {
        if (outcome.challenge.existingProvider !== 'LOCAL') {
          throw new Error('unsupported-kakao-link-challenge');
        }
        setChallenge(outcome.challenge);
        setPassword('');
        setLinkError(undefined);
        return;
      }
      await finishKakaoLogin(outcome.session);
    } catch (error) {
      showKakaoError(error);
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleLinkConfirm = async () => {
    if (!challenge || submittingRef.current || !password) return;

    submittingRef.current = true;
    setSubmitting(true);
    setLinkError(undefined);

    try {
      const session = await confirmKakaoLinkWithLocalPassword(
        challenge.linkToken,
        password,
      );
      await finishKakaoLogin(session);
      if (mountedRef.current) setChallenge(null);
    } catch (error) {
      if (mountedRef.current) {
        setLinkError(
          error instanceof KakaoAuthError
            ? error.message
            : '계정 연동을 완료하지 못했어요. 다시 시도해주세요.',
        );
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const closeLinkModal = () => {
    if (submitting) return;
    setChallenge(null);
    setPassword('');
    setPasswordVisible(false);
    setLinkError(undefined);
  };

  return (
    <>
      <AppScreen
        contentContainerStyle={styles.scrollContent}
        edges={['top', 'left', 'right']}
        padded={false}
        scrollable
      >
        <AuthBrandHero largeLogo style={styles.hero} tagline="우리 아이 건강을 가장 가까이에서" />

        <AuthActionPanel style={styles.actionPanel}>
          <Text style={styles.title}>파우 시작하기</Text>
          <Text style={styles.description}>이메일로 로그인하거나 회원가입하세요</Text>

          <AppButton
            accessibilityHint="로그인 화면으로 이동합니다"
            disabled={submitting}
            onPress={() => navigateOnce(() => router.replace('/login'))}
            size="medium"
            title="로그인/회원가입 하기"
            variant="secondary"
          />
          <AppButton
            accessibilityHint="카카오 계정으로 로그인하거나 회원가입합니다"
            accessibilityLabel="카카오로 시작하기"
            leftIcon={
              <AppIcon accessible={false} color={COLORS.black} name="chatbubble" size={24} />
            }
            loading={submitting && !challenge}
            onPress={() => void handleKakaoLogin()}
            title="카카오로 시작하기"
            variant="kakao"
          />
        </AuthActionPanel>
      </AppScreen>

      <AppModal
        closeOnBackdropPress={!submitting}
        onClose={closeLinkModal}
        primaryAction={{
          disabled: !password,
          label: '계정 연동하기',
          loading: submitting,
          onPress: () => void handleLinkConfirm(),
        }}
        secondaryAction={{
          disabled: submitting,
          label: '취소',
          onPress: closeLinkModal,
        }}
        title="기존 계정과 연결할까요?"
        variant="center"
        visible={Boolean(challenge)}
      >
        <View style={styles.linkContent}>
          <Text style={styles.linkDescription}>
            {challenge?.email} 계정의 비밀번호를 입력해주세요.
          </Text>
          <AppInput
            autoCapitalize="none"
            autoComplete="current-password"
            error={linkError}
            label="비밀번호"
            maxLength={64}
            onChangeText={(value) => {
              setPassword(value);
              if (linkError) setLinkError(undefined);
            }}
            onSubmitEditing={() => void handleLinkConfirm()}
            placeholder="비밀번호를 입력해주세요"
            returnKeyType="done"
            rightElement={
              <PasswordVisibilityButton
                onPress={() => setPasswordVisible((current) => !current)}
                visible={passwordVisible}
              />
            }
            secureTextEntry={!passwordVisible}
            textContentType="password"
            value={password}
          />
        </View>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    backgroundColor: COLORS.gray100,
  },
  hero: {
    flexGrow: 1,
    minHeight: 500,
  },
  actionPanel: {
    minHeight: 304,
  },
  title: {
    ...TYPOGRAPHY.authTitle,
    color: COLORS.black,
    textAlign: 'center',
  },
  description: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  linkContent: {
    gap: SPACING.xxl,
  },
  linkDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
