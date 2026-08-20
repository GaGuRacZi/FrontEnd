import { useRouter } from 'expo-router';
import { getMessaging, getToken } from '@react-native-firebase/messaging';
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
  const {
    activateRemoteSession,
    pendingRemoteSignupUserId,
    prepareRemoteSignup,
  } = useAuthSession();
  const { deleteUserProfileData, registerRemoteProfile } = useMyPageStore();
  const { deleteUserPetData } = usePetStore();
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<KakaoLinkChallenge | null>(null);
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [linkError, setLinkError] = useState<string>();
  const [fcmToken, setFcmToken] = useState<string>();
  const [loadingFcmToken, setLoadingFcmToken] = useState(false);
  const canShowFcmToken = process.env.EXPO_PUBLIC_FCM_TOKEN_DEBUG === 'true';

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

  const finishKakaoLogin = async (session: KakaoSession, linkedLocal = false) => {
    if (session.isNew) {
      if (pendingRemoteSignupUserId !== session.uid) {
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
      }
      await prepareRemoteSignup(session, 'kakao');
      return;
    }

    const profile = await loadRemoteUserProfile(session.accessToken);
    if (profile.uid !== session.uid || profile.isNew) {
      throw new Error('kakao-profile-mismatch');
    }
    await registerRemoteProfile(profile);
    if (linkedLocal) await registerRemoteProfile(profile, 'local');
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
      await finishKakaoLogin(session, true);
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

  const handleLoadFcmToken = async () => {
    if (loadingFcmToken) return;

    setLoadingFcmToken(true);

    try {
      const token = await getToken(getMessaging());
      if (!token) throw new Error('missing-fcm-token');
      if (mountedRef.current) setFcmToken(token);
    } catch {
      showAlert('FCM 토큰을 불러오지 못했어요', '인터넷 연결을 확인한 뒤 다시 시도해주세요.');
    } finally {
      if (mountedRef.current) setLoadingFcmToken(false);
    }
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
          <Text style={styles.description}>이메일로 로그인하거나 새 계정을 만들 수 있어요</Text>

          <AppButton
            accessibilityHint="이메일 로그인 또는 회원가입 화면으로 이동합니다"
            disabled={submitting}
            onPress={() => navigateOnce(() => router.replace('/login'))}
            size="medium"
            title="이메일로 시작하기"
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
          {canShowFcmToken ? (
            <View style={styles.fcmTokenSection}>
              <AppButton
                loading={loadingFcmToken}
                onPress={() => void handleLoadFcmToken()}
                size="medium"
                title="FCM 토큰 확인"
                variant="outline"
              />
              {fcmToken ? (
                <>
                  <Text selectable style={styles.fcmToken}>{fcmToken}</Text>
                  <Text style={styles.fcmTokenGuide}>토큰을 길게 눌러 복사해주세요.</Text>
                </>
              ) : null}
            </View>
          ) : null}
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
  fcmTokenSection: {
    alignItems: 'stretch',
    gap: SPACING.sm,
    width: '100%',
  },
  fcmToken: {
    ...TYPOGRAPHY.caption,
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: 8,
    borderWidth: 1,
    color: COLORS.gray600,
    padding: SPACING.md,
  },
  fcmTokenGuide: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    textAlign: 'center',
  },
});
