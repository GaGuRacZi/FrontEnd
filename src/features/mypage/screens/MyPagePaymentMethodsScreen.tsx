import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppIcon, EmptyState } from '@/src/components/common';
import { AppModal } from '@/src/components/modal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import { MyPageHeader } from '../components';
import { useMyPageStore } from '../MyPageStore';
import type { PaymentMethod } from '../types';

const SAVE_ERROR_TITLE = '결제 수단을 저장하지 못했어요';
const SAVE_ERROR_MESSAGE = '잠시 후 다시 시도해주세요.';

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
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(null);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const sortedPaymentMethods = [...paymentMethods].sort((left, right) =>
    Number(right.isDefault) - Number(left.isDefault),
  );

  const addMethod = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      const nextMethods = [...paymentMethods, createEasyPayMethod()].map((method, index) => ({
        ...method,
        isDefault: index === 0,
      }));
      const result = await updatePaymentMethods(nextMethods);
      if (!result.ok) Alert.alert(SAVE_ERROR_TITLE, SAVE_ERROR_MESSAGE);
    } catch {
      Alert.alert(SAVE_ERROR_TITLE, SAVE_ERROR_MESSAGE);
    } finally {
      setUpdating(false);
    }
  };

  const removeMethod = async () => {
    if (!methodToDelete) return;
    if (updating) return;
    setUpdating(true);
    try {
      const nextMethods = paymentMethods
        .filter((method) => method.id !== methodToDelete.id)
        .map((method, index) => ({ ...method, isDefault: index === 0 }));
      const result = await updatePaymentMethods(nextMethods);
      if (!result.ok) Alert.alert(SAVE_ERROR_TITLE, SAVE_ERROR_MESSAGE);
      if (result.ok) setMethodToDelete(null);
    } catch {
      Alert.alert(SAVE_ERROR_TITLE, SAVE_ERROR_MESSAGE);
    } finally {
      setUpdating(false);
    }
  };

  const setDefaultMethod = async (methodId: string) => {
    if (updating) return;
    setUpdating(true);
    try {
      const selectedMethod = paymentMethods.find((method) => method.id === methodId);
      if (!selectedMethod) return;
      const nextMethods = [
        { ...selectedMethod, isDefault: true },
        ...paymentMethods
          .filter((method) => method.id !== methodId)
          .map((method) => ({ ...method, isDefault: false })),
      ];
      const result = await updatePaymentMethods(nextMethods);
      if (!result.ok) Alert.alert(SAVE_ERROR_TITLE, SAVE_ERROR_MESSAGE);
    } catch {
      Alert.alert(SAVE_ERROR_TITLE, SAVE_ERROR_MESSAGE);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <MyPageHeader title="결제 수단 관리">
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>등록된 결제 수단</Text>
          {paymentMethods.length === 0 ? (
            <EmptyState description="결제 수단을 등록하면 이곳에 표시돼요." title="결제 수단이 없어요." />
          ) : (
            sortedPaymentMethods.map((method) => (
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
                  <View style={styles.methodActions}>
                    <AppButton
                      disabled={updating}
                      fullWidth={false}
                      onPress={() => void setDefaultMethod(method.id)}
                      size="medium"
                      style={styles.defaultButton}
                      title="기본 설정"
                      variant="secondary"
                    />
                    <Pressable
                      accessibilityLabel="결제 수단 삭제"
                      accessibilityRole="button"
                      disabled={updating}
                      onPress={() => setMethodToDelete(method)}
                      style={({ pressed }) => [
                        styles.deleteIconButton,
                        pressed && !updating && styles.pressedIconButton,
                        updating && styles.disabledIconButton,
                      ]}
                    >
                      <AppIcon color={COLORS.danger} name="trash-outline" size={18} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
          <AppButton
            disabled={updating}
            loading={updating}
            onPress={() =>
              paymentMethods.length >= 3
                ? setLimitModalVisible(true)
                : void addMethod()
            }
            title="결제 수단 추가"
          />
        </ScrollView>
      </MyPageHeader>
      <AppModal
        closeOnBackdropPress={!updating}
        onClose={() => {
          if (!updating) setMethodToDelete(null);
        }}
        primaryAction={{
          label: '삭제',
          loading: updating,
          onPress: () => void removeMethod(),
          variant: 'danger',
        }}
        secondaryAction={{
          disabled: updating,
          label: '취소',
          onPress: () => setMethodToDelete(null),
        }}
        title="결제 수단을 삭제할까요?"
        variant="center"
        visible={Boolean(methodToDelete)}
      >
        <Text style={styles.modalDescription}>
          {methodToDelete?.label} 결제 수단이 목록에서 삭제돼요.
        </Text>
      </AppModal>
      <AppModal
        onClose={() => setLimitModalVisible(false)}
        primaryAction={{
          label: '확인',
          onPress: () => setLimitModalVisible(false),
        }}
        title="최대 3개까지 등록할 수 있어요"
        variant="center"
        visible={limitModalVisible}
      >
        <Text style={styles.modalDescription}>
          새 결제 수단을 추가하려면{'\n'}기존 결제 수단을 먼저 삭제해주세요.
        </Text>
      </AppModal>
    </>
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
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
  },
  defaultText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  methodActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  defaultButton: {
    height: 30,
    minWidth: 72,
    paddingHorizontal: SPACING.md,
  },
  deleteIconButton: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  pressedIconButton: {
    opacity: 0.72,
  },
  disabledIconButton: {
    opacity: 0.45,
  },
  modalDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
