import { usePreventRemove } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppIcon, EmptyState } from '@/src/components/common';
import { AppModal, useAppAlert } from '@/src/components/modal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import { MyPageCard, MyPageHeader } from '../components';
import {
  PLAN_DEFINITIONS,
  getPlan,
  getPlanRank,
  getUpgradePaymentAmount,
} from '../mypageData';
import { useMyPageStore } from '../MyPageStore';
import type { PaymentStatus, PlanId } from '../types';

function getMockPaymentStatus(): PaymentStatus {
  const status = process.env.EXPO_PUBLIC_MOCK_PAYMENT_STATUS;
  return status === 'failed' || status === 'canceled' ? status : 'paid';
}

function isPlanId(value: string | string[] | undefined): value is PlanId {
  return typeof value === 'string' && PLAN_DEFINITIONS.some((plan) => plan.id === value);
}

function formatWon(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function MyPageCheckoutScreen() {
  const router = useRouter();
  const showAlert = useAppAlert();
  const { planId } = useLocalSearchParams();
  const { subscription, switchPlan } = useMyPageStore();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [submittedUpgradeStatus, setSubmittedUpgradeStatus] =
    useState<PaymentStatus | null>(null);

  usePreventRemove(submitting, () => {
    showAlert('처리 중이에요', '처리가 끝날 때까지 잠시 기다려주세요.');
  });

  if (!isPlanId(planId)) {
    return (
      <MyPageHeader title="결제 확인">
        <EmptyState title="요금제를 찾지 못했어요." />
      </MyPageHeader>
    );
  }

  const selectedPlan = getPlan(planId);
  const currentPlan = getPlan(subscription?.currentPlanId ?? 'baby-jelly');
  const selectedRank = getPlanRank(selectedPlan.id);
  const currentRank = getPlanRank(currentPlan.id);
  const isSamePlan = selectedPlan.id === currentPlan.id;
  const isUpgrade = selectedRank > currentRank;
  const isCancel = !isSamePlan && selectedRank < currentRank && selectedPlan.id === 'baby-jelly';
  const paymentAmount = isUpgrade ? getUpgradePaymentAmount(currentPlan.id, selectedPlan.id) : 0;
  const paymentStatus = isUpgrade ? getMockPaymentStatus() : 'paid';
  const resultIsUpgrade = submittedUpgradeStatus !== null || isUpgrade;
  const resultPaymentStatus = submittedUpgradeStatus ?? paymentStatus;
  const buttonTitle = isSamePlan
    ? '현재 이용 중'
    : isUpgrade
      ? '결제하기'
      : isCancel
        ? '해지 예약하기'
        : '변경 예약하기';
  const resultTitle =
    resultIsUpgrade && resultPaymentStatus === 'failed'
      ? '결제에 실패했어요'
      : resultIsUpgrade && resultPaymentStatus === 'canceled'
        ? '결제가 취소됐어요'
        : resultIsUpgrade
          ? '결제가 완료됐어요'
          : isCancel
            ? '구독 해지를 예약했어요'
            : '요금제 변경을 예약했어요';
  const resultDescription =
    resultIsUpgrade && resultPaymentStatus === 'failed'
      ? '결제를 완료하지 못했어요. 잠시 후 다시 시도해주세요.'
      : resultIsUpgrade && resultPaymentStatus === 'canceled'
        ? '결제가 진행되지 않았어요. 다시 결제할 수 있어요.'
        : resultIsUpgrade
          ? `${selectedPlan.name} 혜택을 바로 사용할 수 있어요.`
          : isCancel
            ? '다음 결제일부터 아기 젤리로 변경돼요.'
            : '다음 결제일부터 선택한 요금제가 적용돼요.';
  const checkoutNotice = isUpgrade
    ? `${formatWon(paymentAmount)} 결제 후 선택한 요금제로 바로 변경돼요.`
    : isSamePlan
      ? '이미 이용 중인 요금제예요.'
      : isCancel
        ? '다음 결제일에 무료 요금제로 변경돼요.'
        : '다음 결제일부터 낮은 요금제가 적용돼요.';
  const closeResult = () => {
    setResultVisible(false);
    setSubmittedUpgradeStatus(null);
    if (!resultIsUpgrade || resultPaymentStatus === 'paid') router.dismissTo('/mypage');
  };

  const submit = () => {
    if (submittingRef.current || isSamePlan) return;

    submittingRef.current = true;
    void (async () => {
      setSubmitting(true);
      try {
        const result = await switchPlan(selectedPlan.id, paymentStatus);

        if (!result.ok) {
          showAlert('처리하지 못했어요', '잠시 후 다시 시도해주세요.');
          return;
        }

        if (isUpgrade) setSubmittedUpgradeStatus(paymentStatus);
        setResultVisible(true);
      } catch {
        showAlert('처리하지 못했어요', '잠시 후 다시 시도해주세요.');
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    })();
  };

  return (
    <MyPageHeader title="결제 확인">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.planCard}>
          <Image source={selectedPlan.icon} style={styles.planIcon} />
          <Text style={styles.planName}>{selectedPlan.name}</Text>
          <Text style={styles.planPrice}>{selectedPlan.priceLabel}</Text>
        </View>

        <MyPageCard title="결제 요약">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>현재 요금제</Text>
            <Text style={styles.summaryValue}>{currentPlan.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>변경 요금제</Text>
            <Text style={styles.summaryValue}>{selectedPlan.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>결제 금액</Text>
            <Text style={styles.priceValue}>
              {isUpgrade ? formatWon(paymentAmount) : isSamePlan ? '변경 없음' : '이번 달 결제 없음'}
            </Text>
          </View>
        </MyPageCard>

        <View style={styles.noticeBox}>
          <AppIcon color={COLORS.primary} name="information-circle-outline" size={20} />
          <Text style={styles.noticeText}>
            {checkoutNotice}
            {'\n'}
            요금제와 결제 금액을 확인해주세요.
          </Text>
        </View>

        <AppButton
          disabled={isSamePlan || submitting}
          loading={submitting}
          onPress={submit}
          title={buttonTitle}
        />
      </ScrollView>

      <AppModal
        closeOnBackdropPress={false}
        onClose={closeResult}
        onRequestClose={closeResult}
        primaryAction={{
          label: '확인',
          onPress: closeResult,
        }}
        title={resultTitle}
        variant="center"
        visible={resultVisible}
      >
        <View style={styles.resultContent}>
          <View
            style={[
              styles.resultIcon,
              resultPaymentStatus === 'failed' && styles.resultIconFailed,
              resultPaymentStatus === 'canceled' && styles.resultIconCanceled,
            ]}
          >
            <AppIcon
              color={
                resultPaymentStatus === 'failed'
                  ? COLORS.danger
                  : resultPaymentStatus === 'canceled'
                    ? COLORS.gray600
                    : COLORS.primary
              }
              name={resultPaymentStatus === 'paid' ? 'checkmark' : 'close'}
              size={26}
            />
          </View>
          <Text style={styles.resultDescription}>{resultDescription}</Text>
        </View>
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
  planCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: 24,
    gap: SPACING.sm,
    padding: SPACING.xxxl,
  },
  planIcon: {
    height: 72,
    width: 72,
  },
  planName: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  planPrice: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  summaryLabel: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  summaryValue: {
    ...TYPOGRAPHY.body2,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
  priceValue: {
    ...TYPOGRAPHY.title3,
    color: COLORS.primary,
  },
  noticeBox: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.xxl,
  },
  noticeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    flex: 1,
  },
  resultContent: {
    alignItems: 'center',
    gap: SPACING.xl,
  },
  resultIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  resultIconCanceled: {
    backgroundColor: COLORS.gray200,
  },
  resultIconFailed: {
    backgroundColor: COLORS.errorBackground,
  },
  resultDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
