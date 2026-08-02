import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { AppCheckbox, AppInput } from '@/src/components/form';
import { AppModal, useAppAlert } from '@/src/components/modal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { useAccountLifecycle } from '@/src/hooks/useAccountLifecycle';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import { MyPageCard, MyPageHeader } from '../components';
import { useMyPageStore } from '../MyPageStore';

export function MyPageWithdrawScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const showAlert = useAppAlert();
  const { withdrawAccount } = useAccountLifecycle();
  const { verifyCurrentUserPassword } = useAuthSession();
  const { isReady, profile, subscription } = useMyPageStore();
  const [checked, setChecked] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [reauthenticated, setReauthenticated] = useState(false);
  const [verificationValue, setVerificationValue] = useState('');
  const [verificationError, setVerificationError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const verifyingRef = useRef(false);
  const [withdrawError, setWithdrawError] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  if (!isReady) {
    return (
      <MyPageHeader title="탈퇴 확인">
        <LoadingView label="계정 정보를 확인하고 있어요." />
      </MyPageHeader>
    );
  }

  if (!profile || !subscription) {
    return (
      <MyPageHeader title="탈퇴 확인">
        <EmptyState title="계정 정보를 찾지 못했어요." />
      </MyPageHeader>
    );
  }

  const requiresSubscriptionAction =
    subscription.currentPlanId !== 'baby-jelly' && subscription.pendingType !== 'cancel';
  const canWithdraw = isReady && checked && !requiresSubscriptionAction && !withdrawing;
  const usesKakao = profile.loginConnections.some((connection) => connection.method === 'kakao');
  const loginMethodLabel = usesKakao ? '카카오 재인증' : '비밀번호 확인';
  const modalBusy = verifying || withdrawing;

  const resetVerification = () => {
    setReauthenticated(false);
    setVerificationValue('');
    setVerificationError(undefined);
    setWithdrawError(false);
  };

  const closeModal = () => {
    if (verifyingRef.current || withdrawing) return;
    setModalVisible(false);
    resetVerification();
  };

  const submit = () => {
    if (!isReady) return;
    if (requiresSubscriptionAction) {
      showAlert('구독 해지가 먼저 필요해요', '내 요금제에서 구독 해지를 예약한 뒤 탈퇴할 수 있어요.');
      return;
    }
    if (usesKakao) {
      showAlert(
        '카카오 확인이 필요해요',
        '카카오 재인증 API 연결 후 탈퇴할 수 있어요.',
      );
      return;
    }
    resetVerification();
    setModalVisible(true);
  };

  const confirmIdentity = async () => {
    if (verifyingRef.current || withdrawing) return;
    if (usesKakao) {
      setVerificationError('카카오 재인증은 로그인 API 연결 후 사용할 수 있어요.');
      return;
    }
    if (!verificationValue) return;

    verifyingRef.current = true;
    setVerifying(true);
    setVerificationError(undefined);

    try {
      const result = await verifyCurrentUserPassword(verificationValue);

      if (result === 'verified') {
        setVerificationValue('');
        setReauthenticated(true);
        return;
      }

      setVerificationError(
        result === 'missing'
          ? '이 계정의 비밀번호 확인 정보가 없어요. API 연결 후 다시 시도해주세요.'
          : '비밀번호가 일치하지 않아요.',
      );
    } catch {
      setVerificationError('비밀번호를 확인하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  const confirmWithdraw = () => {
    if (!reauthenticated) return;

    navigateOnce(async () => {
      if (withdrawing) return;
      setWithdrawError(false);
      setWithdrawing(true);
      try {
        await withdrawAccount();
        router.replace('/');
      } catch (error) {
        setWithdrawError(true);
        throw error;
      } finally {
        setWithdrawing(false);
      }
    });
  };

  return (
    <MyPageHeader title="탈퇴 확인">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.warningCard}>
          <View style={styles.warningIcon}>
            <AppIcon color={COLORS.error} name="trash-outline" size={24} />
          </View>
          <View style={styles.warningText}>
            <Text style={styles.warningTitle}>계정을 삭제하시겠어요?</Text>
            <Text style={styles.warningDescription}>
              탈퇴하면 프로필, 펫 정보, 설정과 이미지가 삭제돼요.
            </Text>
          </View>
        </View>

        <MyPageCard title="탈퇴 전 확인">
          <View style={styles.checkItem}>
            <AppIcon color={COLORS.primary} name="checkmark-circle" size={22} />
            <View style={styles.checkText}>
              <Text style={styles.checkTitle}>구독 상태를 확인했어요</Text>
              <Text style={styles.checkDescription}>
                구독 중이면 해지 예약 후 탈퇴할 수 있어요.
              </Text>
            </View>
          </View>
          <View style={styles.checkItem}>
            <AppIcon color={COLORS.primary} name="checkmark-circle" size={22} />
            <View style={styles.checkText}>
              <Text style={styles.checkTitle}>전송 완료 채팅은 보존될 수 있어요</Text>
              <Text style={styles.checkDescription}>
                남은 참여자에게는 탈퇴한 사용자로 표시돼요.
              </Text>
            </View>
          </View>
          <View style={styles.checkItem}>
            <AppIcon color={COLORS.primary} name="checkmark-circle" size={22} />
            <View style={styles.checkText}>
              <Text style={styles.checkTitle}>{loginMethodLabel} 후 탈퇴해요</Text>
              <Text style={styles.checkDescription}>
                본인 확인 후 계정 삭제를 진행해요.
              </Text>
            </View>
          </View>
        </MyPageCard>

        <View style={styles.agreeBox}>
          <AppCheckbox
            checked={checked}
            label="안내 내용을 확인했고 계정 삭제에 동의합니다."
            onChange={setChecked}
          />
        </View>

        <AppButton
          disabled={!canWithdraw}
          onPress={submit}
          title={requiresSubscriptionAction ? '구독 해지 예약이 필요해요' : '탈퇴하기'}
          variant="danger"
        />
      </ScrollView>

      <AppModal
        closeOnBackdropPress={!modalBusy}
        onClose={closeModal}
        primaryAction={{
          disabled:
            modalBusy ||
            (!withdrawError && !reauthenticated && !usesKakao && !verificationValue),
          label: withdrawError
            ? '다시 시도'
            : reauthenticated
              ? '탈퇴하기'
              : usesKakao
                ? '카카오로 확인'
                : '확인',
          loading: modalBusy,
          onPress:
            withdrawError || reauthenticated
              ? confirmWithdraw
              : () => void confirmIdentity(),
          variant: withdrawError || reauthenticated ? 'danger' : 'primary',
        }}
        secondaryAction={{
          disabled: modalBusy,
          label: withdrawError ? '닫기' : '취소',
          onPress: closeModal,
        }}
        title={
          withdrawError
            ? '탈퇴를 완료하지 못했어요'
            : reauthenticated
              ? '정말 탈퇴할까요?'
              : usesKakao
                ? '카카오 계정을 확인해주세요'
                : '비밀번호를 확인해주세요'
        }
        variant="center"
        visible={modalVisible}
      >
        {withdrawError || reauthenticated ? (
          <Text style={[styles.modalDescription, withdrawError && styles.modalError]}>
            {withdrawError
              ? '계정 정보를 모두 삭제하지 못했어요.\n잠시 후 다시 시도해주세요.'
              : '탈퇴 후에는 현재 계정 데이터를 되돌릴 수 없어요.'}
          </Text>
        ) : usesKakao ? (
          <View style={styles.modalMessage}>
            <Text style={styles.modalDescription}>
              카카오 계정으로 본인 확인을 진행해주세요.
            </Text>
            {verificationError ? (
              <Text accessibilityLiveRegion="polite" style={styles.modalError}>
                {verificationError}
              </Text>
            ) : null}
          </View>
        ) : (
          <AppInput
            autoCapitalize="none"
            autoComplete="current-password"
            error={verificationError}
            label="비밀번호"
            onChangeText={(value) => {
              setVerificationValue(value);
              if (verificationError) setVerificationError(undefined);
            }}
            onSubmitEditing={() => void confirmIdentity()}
            placeholder="비밀번호를 입력해주세요"
            returnKeyType="done"
            secureTextEntry
            textContentType="password"
            value={verificationValue}
          />
        )}
      </AppModal>
    </MyPageHeader>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.xxl,
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.xl,
  },
  warningCard: {
    alignItems: 'center',
    backgroundColor: COLORS.errorBackground,
    borderRadius: 20,
    flexDirection: 'row',
    gap: SPACING.xxl,
    padding: SPACING.xxl,
  },
  warningIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.round,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  warningText: {
    flex: 1,
  },
  warningTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  warningDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  checkItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  checkText: {
    flex: 1,
  },
  checkTitle: {
    ...TYPOGRAPHY.body2,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
  checkDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  agreeBox: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xxl,
  },
  modalDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  modalMessage: {
    gap: SPACING.md,
  },
  modalError: {
    color: COLORS.error,
    textAlign: 'center',
  },
});
