import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingView } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { MyPageHeader } from '../components';
import { useMyPageStore } from '../MyPageStore';
import type { PaymentHistoryItem } from '../types';

export function MyPagePaymentDetailScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const { getPaymentHistoryItem } = useMyPageStore();
  const [payment, setPayment] = useState<PaymentHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    void getPaymentHistoryItem(paymentId)
      .then((item) => {
        if (active) setPayment(item);
      })
      .catch(() => {
        if (active) {
          setPayment(null);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [getPaymentHistoryItem, paymentId, request]);

  return (
    <MyPageHeader title="결제 상세">
      {loading ? (
        <LoadingView label="결제 내역을 불러오고 있어요." />
      ) : payment ? (
        <View style={styles.card}>
          <Text style={styles.title}>{payment.title}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>결제일</Text>
            <Text style={styles.value}>{payment.date}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>결제 상태</Text>
            <Text style={styles.status}>결제 완료</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>결제 금액</Text>
            <Text style={styles.amount}>{payment.amount.toLocaleString('ko-KR')}원</Text>
          </View>
        </View>
      ) : loadError ? (
        <EmptyState
          actionLabel="다시 시도"
          onActionPress={() => setRequest((current) => current + 1)}
          title="결제 내역을 불러오지 못했어요."
        />
      ) : (
        <EmptyState title="결제 내역을 찾지 못했어요." />
      )}
    </MyPageHeader>
  );
}

const styles = StyleSheet.create({
  amount: { ...TYPOGRAPHY.title3, color: COLORS.primary },
  card: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.xl,
    marginTop: SPACING.xl,
    padding: SPACING.xxl,
  },
  label: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  status: { ...TYPOGRAPHY.body2, color: COLORS.primary },
  title: { ...TYPOGRAPHY.title3, color: COLORS.black },
  value: { ...TYPOGRAPHY.body2, color: COLORS.black },
});
