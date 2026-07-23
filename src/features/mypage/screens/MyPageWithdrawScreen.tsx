import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { AppCheckbox } from '@/src/components/form';
import { AppModal } from '@/src/components/modal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useAccountLifecycle } from '@/src/hooks/useAccountLifecycle';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import { MyPageCard, MyPageHeader } from '../components';
import { useMyPageStore } from '../MyPageStore';

export function MyPageWithdrawScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { withdrawAccount } = useAccountLifecycle();
  const { isReady, profile, subscription } = useMyPageStore();
  const [checked, setChecked] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
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
  const loginMethodLabel = profile.loginConnections.some((connection) => connection.method === 'kakao')
    ? '카카오 재인증'
    : '비밀번호 확인';

  const submit = () => {
    if (!isReady) return;
    if (requiresSubscriptionAction) {
      Alert.alert('구독 해지가 먼저 필요해요', '내 요금제에서 구독 해지를 예약한 뒤 탈퇴할 수 있어요.');
      return;
    }
    setModalVisible(true);
  };

  const confirmWithdraw = () => {
    navigateOnce(async () => {
      if (withdrawing) return;
      setWithdrawing(true);
      try {
        await withdrawAccount();
        router.replace('/');
      } catch {
        Alert.alert('탈퇴 처리를 다시 확인해주세요', '로그인 화면으로 이동한 뒤 필요하면 다시 시도해주세요.');
        router.replace('/');
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
        onClose={() => setModalVisible(false)}
        primaryAction={{
          label: '탈퇴하기',
          loading: withdrawing,
          onPress: confirmWithdraw,
          variant: 'danger',
        }}
        secondaryAction={{ label: '취소', onPress: () => setModalVisible(false) }}
        title="정말 탈퇴할까요?"
        variant="center"
        visible={modalVisible}
      >
        <Text style={styles.modalDescription}>
          탈퇴 후에는 현재 계정 데이터를 되돌릴 수 없어요.
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
});
