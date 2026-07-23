import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppIcon, EmptyState } from '@/src/components/common';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import { MyPageHeader } from '../components';
import { useMyPageStore } from '../MyPageStore';
import type { PaymentMethod } from '../types';

function createEasyPayMethod(): PaymentMethod {
  return {
    brand: '간편페이',
    id: `easy-pay-${Date.now()}`,
    isDefault: false,
    label: 'PAW 간편페이',
    last4: '연결됨',
  };
}

export function MyPagePaymentMethodsScreen() {
  const { paymentMethods, updatePaymentMethods } = useMyPageStore();
  const [updating, setUpdating] = useState(false);

  const addMethod = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      const nextMethods = [...paymentMethods, createEasyPayMethod()].map((method, index) => ({
        ...method,
        isDefault: index === 0,
      }));
      const result = await updatePaymentMethods(nextMethods);
      if (!result.ok) Alert.alert('결제 수단을 저장하지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      setUpdating(false);
    }
  };

  const removeMethod = async (methodId: string) => {
    if (updating) return;
    setUpdating(true);
    try {
      const nextMethods = paymentMethods
        .filter((method) => method.id !== methodId)
        .map((method, index) => ({ ...method, isDefault: index === 0 }));
      const result = await updatePaymentMethods(nextMethods);
      if (!result.ok) Alert.alert('결제 수단을 저장하지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <MyPageHeader title="결제 수단 관리">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>등록된 결제 수단</Text>
        {paymentMethods.length === 0 ? (
          <EmptyState description="결제 수단을 등록하면 이곳에 표시돼요." title="결제 수단이 없어요." />
        ) : (
          paymentMethods.map((method) => (
            <View key={method.id} style={styles.methodCard}>
              <View style={styles.methodIcon}>
                <AppIcon color={COLORS.primary} name="wallet-outline" size={22} />
              </View>
              <View style={styles.methodText}>
                <Text style={styles.methodTitle}>{method.label}</Text>
                <Text style={styles.methodMeta}>
                  {method.last4 === '등록 대기' ? '간편결제 연결 전' : method.last4}
                </Text>
              </View>
              {method.isDefault ? (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultText}>기본</Text>
                </View>
              ) : (
                <AppButton
                  disabled={updating}
                  fullWidth={false}
                  onPress={() => void removeMethod(method.id)}
                  size="medium"
                  style={styles.deleteButton}
                  title="삭제"
                  variant="outline"
                />
              )}
            </View>
          ))
        )}
        <AppButton
          disabled={updating}
          loading={updating}
          onPress={() =>
            paymentMethods.length >= 3
              ? Alert.alert('최대 3개까지 등록할 수 있어요')
              : void addMethod()
          }
          title="결제 수단 추가"
        />
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
  sectionLabel: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
    marginLeft: SPACING.md,
  },
  methodCard: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xl,
    minHeight: 68,
    paddingHorizontal: SPACING.xxl,
  },
  methodIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.round,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  methodText: {
    flex: 1,
  },
  methodTitle: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
  methodMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  defaultBadge: {
    backgroundColor: '#EEF3FF',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
  },
  defaultText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  deleteButton: {
    height: 34,
    minWidth: 62,
  },
});
