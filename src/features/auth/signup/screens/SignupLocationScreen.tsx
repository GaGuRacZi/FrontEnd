import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { useAppAlert } from '@/src/components/modal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import {
  getSignupUserId,
  useAuthSession,
} from '@/src/features/auth/session/AuthSessionStore';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import { signupDataToPetEntity } from '@/src/features/pet/petMappers';
import { usePetStore } from '@/src/features/pet/PetStore';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import {
  consentStore,
  hasCurrentRequiredSignupConsents,
  TERM_IDS,
  termsRepository,
  useTerms,
} from '../../terms';
import { AddressSearchScreen } from '../components/AddressSearchScreen';
import { SignupScaffold } from '../components/SignupScaffold';
import {
  getBestCurrentPosition,
  getRegionFromPosition,
  MAX_LOCATION_ACCURACY_METERS,
} from '../services/locationService';
import {
  clearSignupTransaction,
  isSignupTransactionOwner,
  loadSignupTransaction,
  saveSignupTransaction,
  type SignupTransactionOwner,
} from '../services/signupTransactionStore';
import { useSignup } from '../SignupContext';
import { hasValidSignupLocation } from '../signupValidation';

async function openLocationSettings() {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      return;
    } catch {
      await Linking.openSettings();
      return;
    }
  }

  await Linking.openSettings();
}

export function SignupLocationScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const showAlert = useAppAlert();
  const {
    committedSignupRecovery,
    data,
    markSignupCompleted,
    signupSessionId,
    updateField,
  } = useSignup();
  const {
    activateLocalCredential,
    activateSignupUser,
    deleteLocalCredential,
    hasLocalCredential,
    registerLocalCredential,
  } = useAuthSession();
  const { deleteUserPetData, hasStoredUserPetData, registerSignupPet } = usePetStore();
  const {
    deleteUserProfileData,
    hasStoredUserProfileData,
    registerSignupProfile,
  } = useMyPageStore();
  const [searching, setSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);
  const locating = useRef(false);
  const locationRequestId = useRef(0);
  const currentLocationSelected = data.regionSource === 'current';
  const {
    finalizeSignupConsents,
    getTerm,
    hasCurrentConsent,
    signupIdentityFinalized,
    status: termsStatus,
  } = useTerms();

  const invalidateLocationRequest = useCallback(() => {
    locationRequestId.current += 1;
    locating.current = false;
  }, []);

  const cancelLocationRequest = useCallback(() => {
    invalidateLocationRequest();
    setIsLocating(false);
  }, [invalidateLocationRequest]);

  useFocusEffect(
    useCallback(() => {
      setIsLocating(false);

      return () => invalidateLocationRequest();
    }, [invalidateLocationRequest]),
  );

  const handleCurrentLocation = async () => {
    if (termsStatus !== 'ready') {
      setLocationError('위치 약관을 불러온 뒤 다시 시도해주세요.');
      return;
    }

    if (!getTerm(TERM_IDS.location)) {
      setLocationError('위치 약관을 찾을 수 없어요. 지역을 직접 검색해주세요.');
      return;
    }

    if (!hasCurrentConsent(TERM_IDS.location)) {
      navigateOnce(() => {
        router.push({
          pathname: '/signup/terms/[termId]',
          params: { action: 'consent', termId: TERM_IDS.location },
        });
      });
      return;
    }

    if (locating.current) return;

    locating.current = true;
    const requestId = locationRequestId.current + 1;
    locationRequestId.current = requestId;
    const isCurrentRequest = () => locationRequestId.current === requestId;
    setIsLocating(true);
    setLocationError(undefined);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!isCurrentRequest()) return;

      if (!permission.granted) {
        setLocationError('현재 위치를 사용하려면 위치 권한을 허용해주세요.');
        showAlert(
          '위치 권한이 필요해요',
          '현재 위치로 설정하려면 앱 설정에서 위치 권한을 허용해주세요.',
          [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }

      const androidAccuracy = permission.android?.accuracy;

      if (Platform.OS === 'android' && androidAccuracy && androidAccuracy !== 'fine') {
        setLocationError('정확한 위치 권한을 켠 뒤 다시 시도해주세요.');
        showAlert(
          '정확한 위치가 필요해요',
          '현재 지역을 정확하게 설정하려면 앱 위치 권한에서 정확한 위치를 켜주세요.',
          [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!isCurrentRequest()) return;

      if (!servicesEnabled) {
        setLocationError('기기의 위치 서비스를 켠 뒤 다시 시도해주세요.');
        showAlert('위치 서비스가 꺼져 있어요', '기기 설정에서 위치 서비스를 켜주세요.', [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => void openLocationSettings() },
        ]);
        return;
      }

      const position = await getBestCurrentPosition();

      if (!isCurrentRequest()) return;

      if (!position) {
        setLocationError('현재 위치를 확인하지 못했어요. 지역을 직접 검색해주세요.');
        return;
      }

      if (
        position.coords.accuracy !== null &&
        position.coords.accuracy > MAX_LOCATION_ACCURACY_METERS
      ) {
        setLocationError('위치 정확도가 낮아요. 잠시 후 다시 시도하거나 지역을 검색해주세요.');
        return;
      }

      const region = await getRegionFromPosition(position);

      if (!isCurrentRequest()) return;

      if (!region) {
        setLocationError('현재 위치의 지역 정보를 찾지 못했어요. 지역을 직접 검색해주세요.');
        return;
      }

      updateField('region', region);
      updateField('regionSource', 'current');
    } catch {
      if (isCurrentRequest()) {
        setLocationError('현재 위치를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      if (isCurrentRequest()) {
        locating.current = false;
        setIsLocating(false);
      }
    }
  };

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    const currentUserId = getSignupUserId(data.method, data.email, signupSessionId);
    const transactionOwner: SignupTransactionOwner = committedSignupRecovery ?? {
      email: data.email,
      method: data.method,
      sessionId: signupSessionId,
      userId: currentUserId,
    };
    const userId = transactionOwner.userId;
    let consentsFinalized = signupIdentityFinalized;
    let ownsTransaction = false;

    try {
      if (
        getSignupUserId(
          transactionOwner.method,
          transactionOwner.email,
          transactionOwner.sessionId,
        ) !== userId
      ) {
        throw new Error('signup-owner-mismatch');
      }

      const storedTransaction = await loadSignupTransaction(userId);
      const transaction = storedTransaction.transaction;
      const ownsStoredTransaction = Boolean(
        transaction && isSignupTransactionOwner(transaction, transactionOwner),
      );
      const [hasPetData, profileStatus, consentHistory, hasCredentialData, currentTerms] =
        await Promise.all([
          hasStoredUserPetData(userId),
          hasStoredUserProfileData(userId),
          consentStore.getHistory(userId),
          transactionOwner.method === 'local'
            ? hasLocalCredential(userId)
            : Promise.resolve(true),
          termsRepository.getTerms(),
        ]);
      const hasCompleteAccount =
        hasPetData &&
        profileStatus === 'valid' &&
        hasCurrentRequiredSignupConsents(consentHistory, currentTerms) &&
        hasCredentialData;

      if (
        ownsStoredTransaction &&
        (transaction?.status === 'committed' ||
          signupIdentityFinalized ||
          hasCompleteAccount)
      ) {
        if (hasCompleteAccount) {
          if (transaction?.status !== 'committed') {
            await saveSignupTransaction(transactionOwner, 'committed');
          }
          if (transactionOwner.method === 'local') {
            await activateLocalCredential(userId);
          }
          await activateSignupUser(
            transactionOwner.method,
            transactionOwner.email,
            transactionOwner.sessionId,
          );
          markSignupCompleted();
          await clearSignupTransaction(
            userId,
            transactionOwner.sessionId,
          ).catch(() => undefined);
          cancelLocationRequest();
          router.push('/signup/complete');
          return;
        }
        throw new Error('signup-committed-data-incomplete');
      }

      if (committedSignupRecovery) {
        throw new Error('signup-committed-transaction-missing');
      }

      if (!signupIdentityFinalized) {
        if (transaction?.status === 'pending' && ownsStoredTransaction) {
          ownsTransaction = true;
          const recoveryResults = await Promise.allSettled([
            deleteUserPetData(userId),
            deleteUserProfileData(userId),
            consentStore.deleteHistory(userId),
            transactionOwner.method === 'local'
              ? deleteLocalCredential(userId)
              : Promise.resolve(),
          ]);
          if (recoveryResults.some((result) => result.status === 'rejected')) {
            throw new Error('signup-recovery-failed');
          }
          await clearSignupTransaction(userId, transactionOwner.sessionId);
        } else if (
          hasPetData ||
          profileStatus !== 'missing' ||
          consentHistory.length > 0 ||
          (transactionOwner.method === 'local' && hasCredentialData)
        ) {
          showAlert('이미 가입된 계정이에요', '기존 계정으로 로그인해주세요.', [
            { text: '닫기', style: 'cancel' },
            {
              text: '로그인하기',
              onPress: () => navigateOnce(() => router.replace('/login')),
            },
          ]);
          throw new Error('signup-account-exists');
        }

        if (storedTransaction.exists) {
          await clearSignupTransaction(userId);
        }
        await saveSignupTransaction(transactionOwner, 'pending');
        ownsTransaction = true;
      }

      const initialPet = signupDataToPetEntity(data, userId);
      await registerSignupPet(userId, initialPet);
      await registerSignupProfile(data, userId);
      if (transactionOwner.method === 'local') {
        await registerLocalCredential(userId, data.password);
      }
      await finalizeSignupConsents(userId);
      consentsFinalized = true;
      await saveSignupTransaction(transactionOwner, 'committed');
      if (transactionOwner.method === 'local') {
        await activateLocalCredential(userId);
      }
      await activateSignupUser(
        transactionOwner.method,
        transactionOwner.email,
        transactionOwner.sessionId,
      );
      markSignupCompleted();
      await clearSignupTransaction(userId, transactionOwner.sessionId).catch(
        () => undefined,
      );
      cancelLocationRequest();
      router.push('/signup/complete');
    } catch (error) {
      if (ownsTransaction && !consentsFinalized) {
        const cleanupResults = await Promise.allSettled([
          deleteUserPetData(userId),
          deleteUserProfileData(userId),
          consentStore.deleteHistory(userId),
          transactionOwner.method === 'local'
            ? deleteLocalCredential(userId)
            : Promise.resolve(),
        ]);
        if (cleanupResults.every((result) => result.status === 'fulfilled')) {
          await clearSignupTransaction(userId, transactionOwner.sessionId).catch(
            () => undefined,
          );
        }
      }
      if (
        !(error instanceof Error) ||
        error.message !== 'signup-account-exists'
      ) {
        showAlert('회원가입을 완료하지 못했어요', '잠시 후 다시 시도해주세요.');
      }
      throw error;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    activateLocalCredential,
    activateSignupUser,
    cancelLocationRequest,
    committedSignupRecovery,
    data,
    deleteLocalCredential,
    deleteUserPetData,
    deleteUserProfileData,
    finalizeSignupConsents,
    hasLocalCredential,
    hasStoredUserPetData,
    hasStoredUserProfileData,
    markSignupCompleted,
    navigateOnce,
    registerSignupPet,
    registerSignupProfile,
    registerLocalCredential,
    router,
    showAlert,
    signupIdentityFinalized,
    signupSessionId,
  ]);

  useEffect(() => {
    if (!committedSignupRecovery || recoveryAttemptedRef.current) return;

    recoveryAttemptedRef.current = true;
    void handleSubmit().catch(() => undefined);
  }, [committedSignupRecovery, handleSubmit]);

  if (searching) {
    return (
      <AddressSearchScreen
        onBack={() => {
          cancelLocationRequest();
          setSearching(false);
        }}
        onSelect={(address) => {
          cancelLocationRequest();
          updateField('region', address);
          updateField('regionSource', 'search');
          setLocationError(undefined);
          setSearching(false);
        }}
      />
    );
  }

  return (
    <SignupScaffold
      backDisabled={signupIdentityFinalized || Boolean(committedSignupRecovery)}
      bodyStyle={styles.body}
      buttonTitle="회원가입 완료하기"
      contentDisabled={signupIdentityFinalized || Boolean(committedSignupRecovery)}
      currentStep={5}
      nextDisabled={!committedSignupRecovery && !hasValidSignupLocation(data)}
      nextLoading={submitting}
      onNext={handleSubmit}
      title="위치 정보를 설정해주세요"
    >
      <Text style={styles.description}>
        {'지역 기반 병원 검색 및 알림을\n받기 위해 필요해요.'}
      </Text>

      <View style={styles.locationSection}>
        <Text style={styles.label}>지역 검색</Text>
        <Pressable
          accessibilityHint="지역 검색 화면을 엽니다"
          accessibilityRole="button"
          onPress={() => {
            cancelLocationRequest();
            setLocationError(undefined);
            setSearching(true);
          }}
          style={({ pressed }) => [styles.locationSelector, pressed && styles.pressed]}
        >
          <Text
            numberOfLines={1}
            style={[styles.locationPlaceholder, data.region && styles.selectedLocation]}
          >
            {data.region || '여기를 눌러 지역을 선택해주세요'}
          </Text>
          <AppIcon color={COLORS.black} name="chevron-down" size={22} />
        </Pressable>
      </View>

      <Pressable
        accessibilityHint="위치 약관 동의 후 현재 지역을 자동으로 설정합니다"
        accessibilityRole="button"
        accessibilityState={{ busy: isLocating, disabled: isLocating }}
        disabled={isLocating}
        onPress={handleCurrentLocation}
        style={({ pressed }) => [
          styles.currentLocationCard,
          currentLocationSelected && styles.selectedLocationCard,
          pressed && styles.pressed,
        ]}
      >
        <View>
          <Text style={styles.currentLocationTitle}>내 위치로 설정</Text>
          <Text style={styles.currentLocationDescription}>
            {'현재 위치를 기반으로\n자동 설정할 수 있어요.'}
          </Text>
        </View>
        {isLocating ? (
          <ActivityIndicator color={COLORS.primary} size="large" />
        ) : (
          <AppIcon color={COLORS.primary} name="location" size={52} />
        )}
      </Pressable>
      {locationError ? (
        <Text accessibilityLiveRegion="polite" style={styles.locationError}>
          {locationError}
        </Text>
      ) : null}
    </SignupScaffold>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: 34,
  },
  description: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  locationSection: {
    gap: SPACING.xl,
    marginTop: 40,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  locationSelector: {
    alignItems: 'center',
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: SIZE.inputHeight,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xxl,
  },
  locationPlaceholder: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray500,
    flex: 1,
  },
  selectedLocation: {
    color: COLORS.black,
  },
  currentLocationCard: {
    alignItems: 'center',
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    height: 128,
    justifyContent: 'space-between',
    marginTop: 64,
    paddingHorizontal: SPACING.xxl,
  },
  selectedLocationCard: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.sub,
  },
  locationError: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    marginTop: SPACING.md,
  },
  currentLocationTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  currentLocationDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  pressed: {
    opacity: 0.65,
  },
});
