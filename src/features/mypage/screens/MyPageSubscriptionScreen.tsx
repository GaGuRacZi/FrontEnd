import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppButton } from '@/src/components/common';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import { MyPageHeader } from '../components';
import { PLAN_DEFINITIONS, getPlanRank } from '../mypageData';
import { useMyPageStore } from '../MyPageStore';

export function MyPageSubscriptionScreen() {
  const router = useRouter();
  const { subscription } = useMyPageStore();
  const currentPlanId = subscription?.currentPlanId ?? 'baby-jelly';
  const currentRank = getPlanRank(currentPlanId);

  return (
    <MyPageHeader title="구독 살펴보기">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>우리 아이에게 맞는 요금제를 선택하세요</Text>
        {PLAN_DEFINITIONS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const planRank = getPlanRank(plan.id);
          const actionLabel =
            planRank > currentRank
              ? '업그레이드'
              : planRank < currentRank
                ? plan.id === 'baby-jelly'
                  ? '해지 예약'
                  : '변경 예약'
                : '이용 중';

          return (
            <View key={plan.id} style={[styles.planCard, isCurrent && styles.currentCard]}>
              <View style={styles.planHeader}>
                <Image source={plan.icon} style={styles.planIcon} />
                <View style={styles.planTitleWrap}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planPrice}>{plan.priceLabel}</Text>
                </View>
                {isCurrent ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>이용 중</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.benefits}>
                <Text style={styles.benefit}>· {plan.aiSummary}</Text>
                <Text style={styles.benefit}>· {plan.recording}</Text>
                <Text style={styles.benefit}>· {plan.commonBenefit}</Text>
              </View>
              <AppButton
                disabled={isCurrent}
                onPress={() => router.push({ pathname: './checkout', params: { planId: plan.id } })}
                size="medium"
                title={actionLabel}
                variant={isCurrent ? 'secondary' : 'primary'}
              />
            </View>
          );
        })}
      </ScrollView>
    </MyPageHeader>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.xxl,
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.xl,
  },
  lead: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    paddingHorizontal: SPACING.lg,
  },
  planCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: 20,
    borderWidth: 1,
    gap: SPACING.xxl,
    padding: SPACING.xxl,
  },
  currentCard: {
    backgroundColor: COLORS.cream,
    borderColor: COLORS.yellow,
  },
  planHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  planIcon: {
    height: 44,
    width: 44,
  },
  planTitleWrap: {
    flex: 1,
  },
  planName: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  planPrice: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  currentBadge: {
    backgroundColor: '#EEF3FF',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  currentBadgeText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  benefits: {
    gap: SPACING.xs,
  },
  benefit: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray800,
  },
});
