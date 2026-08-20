import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { AppCheckbox } from '@/src/components/form';
import { AppModal, useAppAlert } from '@/src/components/modal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useAccountLifecycle } from '@/src/hooks/useAccountLifecycle';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import { MyPageCard, MyPageHeader } from '../components';
import { useMyPageStore } from '../MyPageStore';
import { getRemoteWithdrawalPreview } from '../services/mypageApi';

export function MyPageWithdrawScreen() {
  const navigateOnce = useNavigationLock();
  const showAlert = useAppAlert();
  const { withdrawAccount } = useAccountLifecycle();
  const { isReady, profile } = useMyPageStore();
  const [checked, setChecked] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [withdrawError, setWithdrawError] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof getRemoteWithdrawalPreview>> | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [previewRequest, setPreviewRequest] = useState(0);

  useEffect(() => {
    if (!isReady || !profile) return;

    let active = true;
    setPreview(null);
    setPreviewError(false);
    void getRemoteWithdrawalPreview()
      .then((nextPreview) => {
        if (active) setPreview(nextPreview);
      })
      .catch(() => {
        if (active) setPreviewError(true);
      });

    return () => {
      active = false;
    };
  }, [isReady, previewRequest, profile]);
  if (!isReady) {
    return (
      <MyPageHeader title="탈퇴 확인">
        <LoadingView label="계정 정보를 확인하고 있어요." />
      </MyPageHeader>
    );
  }

  if (!profile) {
    return (
      <MyPageHeader title="탈퇴 확인">
        <EmptyState title="계정 정보를 찾지 못했어요." />
      </MyPageHeader>
    );
  }

  if (previewError) {
    return (
      <MyPageHeader title="탈퇴 확인">
        <EmptyState
          actionLabel="다시 시도"
          description="잠시 후 다시 시도해주세요."
          onActionPress={() => setPreviewRequest((current) => current + 1)}
          title="탈퇴 정보를 불러오지 못했어요"
        />
      </MyPageHeader>
    );
  }

  if (!preview) {
    return (
      <MyPageHeader title="탈퇴 확인">
        <LoadingView label="탈퇴 정보를 확인하고 있어요." />
      </MyPageHeader>
    );
  }

  const hasWithdrawalRestriction = preview.subscribing || preview.hasOngoingMarketTrade;
  const canWithdraw = checked && !hasWithdrawalRestriction && !withdrawing;
  const modalBusy = withdrawing;

  const resetVerification = () => {
    setWithdrawError(false);
  };

  const closeModal = () => {
    if (withdrawing) return;
    setModalVisible(false);
    resetVerification();
  };

  const submit = () => {
    if (!isReady) return;
    if (preview.subscribing) {
      showAlert('구독을 먼저 확인해주세요', '이용 중인 구독을 정리한 뒤 탈퇴할 수 있어요.');
      return;
    }
    if (preview.hasOngoingMarketTrade) {
      showAlert('진행 중인 거래가 있어요', '진행 중인 장터 거래를 마친 뒤 탈퇴할 수 있어요.');
      return;
    }
    resetVerification();
    setModalVisible(true);
  };

  const confirmWithdraw = () => {
    navigateOnce(async () => {
      if (withdrawing) return;
      setWithdrawError(false);
      setWithdrawing(true);
      try {
        await withdrawAccount();
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
                이용 중인 구독이 있으면 정리한 뒤 탈퇴할 수 있어요.
              </Text>
            </View>
          </View>
          <View style={styles.checkItem}>
            <AppIcon color={COLORS.primary} name="checkmark-circle" size={22} />
            <View style={styles.checkText}>
              <Text style={styles.checkTitle}>안내를 확인한 뒤 탈퇴해요</Text>
              <Text style={styles.checkDescription}>
                탈퇴 후에는 계정 데이터를 되돌릴 수 없어요.
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
          title={
            preview.subscribing
              ? '구독 확인이 필요해요'
              : preview.hasOngoingMarketTrade
                ? '진행 중인 거래가 있어요'
                : '탈퇴하기'
          }
          variant="danger"
        />
      </ScrollView>

      <AppModal
        closeOnBackdropPress={!modalBusy}
        onClose={closeModal}
        primaryAction={{
          disabled:
            modalBusy,
          label: withdrawError ? '다시 시도' : '탈퇴하기',
          loading: modalBusy,
          onPress: confirmWithdraw,
          variant: 'danger',
        }}
        secondaryAction={{
          disabled: modalBusy,
          label: withdrawError ? '닫기' : '취소',
          onPress: closeModal,
        }}
        title={
          withdrawError
            ? '탈퇴를 완료하지 못했어요'
            : '정말 탈퇴할까요?'
        }
        variant="center"
        visible={modalVisible}
      >
        <Text style={[styles.modalDescription, withdrawError && styles.modalError]}>
          {withdrawError
            ? '계정 정보를 모두 삭제하지 못했어요.\n잠시 후 다시 시도해주세요.'
            : '탈퇴 후에는 현재 계정 데이터를 되돌릴 수 없어요.'}
        </Text>
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
  modalError: {
    color: COLORS.error,
    textAlign: 'center',
  },
});
