import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { COLORS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { AppModal } from '@/src/components/modal';

import { MyPageCard, MyPageDivider, MyPageHeader, MyPageRow } from '../components';
import { getPlan } from '../mypageData';
import { useMyPageStore } from '../MyPageStore';

const CANCEL_ERROR_TITLE = '해지 예약을 저장하지 못했어요';
const CANCEL_ERROR_MESSAGE = '잠시 후 다시 시도해주세요.';

export function MyPagePlanScreen() {
  const router = useRouter();
  const { scheduleCancelSubscription, subscription } = useMyPageStore();
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const plan = getPlan(subscription?.currentPlanId ?? 'baby-jelly');
  const canCancel = Boolean(subscription && subscription.currentPlanId !== 'baby-jelly');
  const nextBillingDate = subscription?.nextBillingDate ?? '다음 결제일';

  const confirmCancel = async () => {
    setCanceling(true);
    try {
      const result = await scheduleCancelSubscription();
      if (result.ok) setCancelModalVisible(false);
      else Alert.alert(CANCEL_ERROR_TITLE, CANCEL_ERROR_MESSAGE);
    } catch {
      Alert.alert(CANCEL_ERROR_TITLE, CANCEL_ERROR_MESSAGE);
    } finally {
      setCanceling(false);
    }
  };

  return (
    <MyPageHeader title="내 요금제">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.currentPlan}>
          <Image source={plan.icon} style={styles.currentPlanIcon} />
          <Text style={styles.currentPlanTitle}>{plan.name} 이용 중</Text>
          <Text style={styles.currentPlanMeta}>
            {plan.priceLabel}
            {subscription?.nextBillingDate ? ` · 다음 결제일 ${subscription.nextBillingDate}` : ''}
          </Text>
          {subscription?.pendingType ? (
            <Text style={styles.pendingText}>
              {subscription.pendingType === 'cancel' ? '구독 해지' : '요금제 변경'} 예약됨
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>포함된 혜택</Text>
        <MyPageCard>
          <Text style={styles.benefit}>· {plan.aiSummary}</Text>
          <Text style={styles.benefit}>· {plan.recording}</Text>
          <Text style={styles.benefit}>· {plan.commonBenefit}</Text>
        </MyPageCard>

        <MyPageCard>
          <MyPageRow
            onPress={() => router.push('/mypage/subscription')}
            title="요금제 변경하기"
          />
          <MyPageDivider />
          <MyPageRow
            onPress={() => router.push('/mypage/payment-history')}
            title="결제 내역"
          />
          {canCancel ? (
            <>
              <MyPageDivider />
              <MyPageRow
                description={`${nextBillingDate}까지 현재 혜택을 사용할 수 있어요`}
                onPress={() => setCancelModalVisible(true)}
                title="구독 해지"
              />
            </>
          ) : null}
        </MyPageCard>
      </ScrollView>

      <AppModal
        onClose={() => setCancelModalVisible(false)}
        primaryAction={{
          label: '해지 예약하기',
          loading: canceling,
          onPress: confirmCancel,
          variant: 'danger',
        }}
        secondaryAction={{ label: '계속 이용하기', onPress: () => setCancelModalVisible(false) }}
        title="구독을 해지할까요?"
        variant="center"
        visible={cancelModalVisible}
      >
        <Text style={styles.modalDescription}>
          {nextBillingDate}까지 {plan.name} 혜택을 이용할 수 있고,{'\n'}
          이후 아기 젤리로 변경돼요.
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
  currentPlan: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: 20,
    gap: SPACING.sm,
    padding: SPACING.xxxl,
  },
  currentPlanIcon: {
    height: 74,
    width: 74,
  },
  currentPlanTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  currentPlanMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  pendingText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  sectionLabel: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
    marginLeft: SPACING.md,
  },
  benefit: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray800,
    paddingVertical: SPACING.xs,
  },
  modalDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
