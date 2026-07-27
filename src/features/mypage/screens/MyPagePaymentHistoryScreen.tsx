import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/common';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import { MyPageHeader } from '../components';
import { useMyPageStore } from '../MyPageStore';
import type { PaymentStatus } from '../types';

const STATUS_LABELS: Record<PaymentStatus, string> = {
  canceled: '결제취소',
  failed: '결제실패',
  paid: '결제완료',
};

const STATUS_BADGES: Record<PaymentStatus, { backgroundColor: string; color: string }> = {
  canceled: {
    backgroundColor: COLORS.gray200,
    color: COLORS.gray600,
  },
  failed: {
    backgroundColor: COLORS.errorBackground,
    color: COLORS.danger,
  },
  paid: {
    backgroundColor: COLORS.primarySoft,
    color: COLORS.primary,
  },
};

export function MyPagePaymentHistoryScreen() {
  const { paymentHistory } = useMyPageStore();

  return (
    <MyPageHeader title="결제 내역">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {paymentHistory.length === 0 ? (
          <EmptyState
            description="아직 결제한 내역이 없어요."
            icon={<Image source={require('@/assets/images/paw-logo.png')} style={styles.emptyLogo} />}
            title="결제 내역이 없어요."
          />
        ) : (
          paymentHistory.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.historyText}>
                <Text style={styles.historyTitle}>{item.title}</Text>
                <Text style={styles.historyMeta}>
                  {item.date} · {item.methodLabel}
                </Text>
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
            </View>
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
  emptyLogo: {
    height: 34,
    width: 34,
  },
  historyText: {
    flex: 1,
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
