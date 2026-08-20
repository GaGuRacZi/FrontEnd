import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/common';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import { MyPageHeader } from '../components';
import { useMyPageStore } from '../MyPageStore';
import type { PaymentStatus } from '../types';

const STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: '결제 완료',
};

const STATUS_BADGES: Record<PaymentStatus, { backgroundColor: string; color: string }> = {
  paid: {
    backgroundColor: COLORS.primarySoft,
    color: COLORS.primary,
  },
};

export function MyPagePaymentHistoryScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { paymentHistory, paymentHistoryLoadError, reloadMyPage } = useMyPageStore();

  return (
    <MyPageHeader title="결제 내역">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {paymentHistoryLoadError ? (
          <EmptyState
            actionLabel="다시 시도"
            description="네트워크 상태를 확인한 뒤 다시 불러와주세요."
            onActionPress={reloadMyPage}
            title="결제 내역을 불러오지 못했어요"
          />
        ) : paymentHistory.length === 0 ? (
          <EmptyState
            description="아직 결제한 내역이 없어요."
            title="결제 내역이 없어요."
          />
        ) : (
          paymentHistory.map((item) => (
            <Pressable
              accessibilityLabel={`${item.title} 상세 보기`}
              accessibilityRole="button"
              key={item.id}
              onPress={() => navigateOnce(() => router.push({
                pathname: '/mypage/payment-history/[paymentId]',
                params: { paymentId: item.id },
              }))}
              style={({ pressed }) => [styles.historyCard, pressed && styles.historyCardPressed]}
            >
              <View style={styles.historyText}>
                <Text style={styles.historyTitle}>{item.title}</Text>
                <Text style={styles.historyMeta}>{item.date}</Text>
              </View>
              <View style={styles.amountBox}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_BADGES[item.status].backgroundColor },
                  ]}
                >
                  <Text style={[styles.statusText, { color: STATUS_BADGES[item.status].color }]}>
                    {STATUS_LABELS[item.status]}
                  </Text>
                </View>
                <Text style={styles.amount}>{item.amount.toLocaleString('ko-KR')}원</Text>
              </View>
            </Pressable>
          ))
        )}
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
  historyCard: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 80,
    paddingHorizontal: SPACING.xxl,
  },
  historyText: {
    flex: 1,
  },
  historyCardPressed: {
    opacity: 0.72,
  },
  historyTitle: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
  historyMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  amountBox: {
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  statusBadge: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  statusText: {
    ...TYPOGRAPHY.smallButton,
  },
  amount: {
    ...TYPOGRAPHY.body2,
    color: COLORS.black,
  },
});
