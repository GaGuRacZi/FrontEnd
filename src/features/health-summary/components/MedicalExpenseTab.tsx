import { Href, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';
import {
    ExpenseListItem,
    ExpenseSummary,
    getExpenses,
    getExpenseSummary,
} from '../services/medicalCostService';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { MonthNavigator } from './MonthNavigator';

const CARROT_AD_IMAGE = require('@/assets/images/health-summary/ad.jpg');

export function MedicalExpenseTab() {
    const router = useRouter();
    const { selectedPet } = usePetStore();
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [month, setMonth] = useState(() => new Date().getMonth() + 1);
    const [summary, setSummary] = useState<ExpenseSummary | null>(null);
    const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
    const [loading, setLoading] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if (!selectedPet) return;
            let cancelled = false;
            setLoading(true);
            Promise.all([
                getExpenseSummary(selectedPet.id, { year, month }),
                getExpenses(selectedPet.id, { year, month }),
            ])
                .then(([summaryData, listData]) => {
                    if (cancelled) return;
                    setSummary(summaryData);
                    setExpenses(listData.expenses);
                })
                .catch(() => {
                    // 에러 시 빈 상태 유지
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
            return () => {
                cancelled = true;
            };
        }, [selectedPet, year, month]),
    );

    return (
        <View style={styles.container}>
            <View style={styles.promoCard}>
                <Text style={styles.promoTitle}>우리아이 맞춤 보험</Text>
                <Image source={CARROT_AD_IMAGE} style={styles.promoImage} />
                <Text style={styles.promoSubtitle}>
                    우리아이 맞춤 보험을 유지하는 동안, PAW 요금제가 매달 50% 할인 됩니다.
                </Text>
            </View>

            <View style={styles.summaryCard}>
                <View style={styles.summaryText}>
                    <Text style={styles.cardLabel}>이번 달 병원비</Text>
                    <Text adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={styles.expenseValue}>
                        {(summary?.monthlyTotalAmount ?? 0).toLocaleString()}원
                    </Text>
                    <Text numberOfLines={1} style={styles.totalValue}>
                        총 병원비: {(summary?.totalAmount ?? 0).toLocaleString()}원
                    </Text>
                </View>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => router.push('/health-summary/medical-expense-record' as Href)}
                    style={styles.recordButton}
                >
                    <Text style={styles.recordButtonText}>기록 하기</Text>
                </TouchableOpacity>
            </View>

            <MonthNavigator
                month={month}
                onNextMonth={() => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }}
                onPrevMonth={() => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }}
                year={year}
            />

            {loading ? (
                <ActivityIndicator color={COLORS.primary} style={styles.loadingIndicator} />
            ) : expenses.length > 0 ? (
                expenses.map((record) => (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        key={record.expenseId}
                        onPress={() =>
                            router.push({
                                pathname: '/health-summary/medical-expense-record',
                                params: { expenseId: record.expenseId },
                            } as Href)
                        }
                        style={styles.recordItem}
                    >
                        <View style={styles.recordItemLeft}>
                            <View style={styles.expenseBadge}>
                                <Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.bill} style={styles.badgeIcon} />
                            </View>
                            <View>
                                <Text style={styles.recordItemTitle}>{record.expenseName}</Text>
                                <Text style={styles.recordItemSub}>{record.expenseDate}</Text>
                            </View>
                        </View>
                        <View style={styles.recordItemRight}>
                            <Text style={styles.recordExpenseText}>
                                {record.expenseAmount.toLocaleString()}원
                            </Text>
                            <AppIcon color={COLORS.gray500} name="chevron-forward" size={16} />
                        </View>
                    </TouchableOpacity>
                ))
            ) : (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>해당 월에 기록된 의료비가 없어요.</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: SPACING.jumbo },
    promoCard: {
        backgroundColor: COLORS.background,
        borderColor: COLORS.gray200,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        padding: SPACING.xl,
        gap: SPACING.md,
    },
    promoTitle: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
    promoImage: {
        width: '100%',
        height: 170,
        resizeMode: 'contain',
    },
    promoSubtitle: {
        ...TYPOGRAPHY.small,
        color: COLORS.gray500,
        marginBottom: 0,
    },
    summaryCard: {
        alignItems: 'center',
        backgroundColor: COLORS.yellow,
        borderRadius: RADIUS.lg,
        flexDirection: 'row',
        height: 140,
        justifyContent: 'space-between',
        paddingLeft: 38,
        gap: SPACING.lg,
        paddingRight: SPACING.xxl,
    },
    summaryText: { flex: 1, minWidth: 0 },
    cardLabel: { ...TYPOGRAPHY.body2, color: COLORS.gray800, fontFamily: TYPOGRAPHY.button.fontFamily },
    expenseValue: { ...TYPOGRAPHY.title1, color: COLORS.black, fontSize: 30, lineHeight: 40, marginVertical: 4 },
    totalValue: { color: COLORS.primary, fontFamily: TYPOGRAPHY.button.fontFamily },
    recordButton: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: RADIUS.segment, flexShrink: 0, justifyContent: 'center', paddingVertical: 12, width: 108 },
    recordButtonText: { ...TYPOGRAPHY.smallButton, color: COLORS.background },
    loadingIndicator: { paddingVertical: SPACING.xxl },
    recordItem: { alignItems: 'center', backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.xl },
    recordItemLeft: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
    expenseBadge: { alignItems: 'center', backgroundColor: COLORS.summarycontainer, borderRadius: RADIUS.round, height: 44, justifyContent: 'center', width: 44 },
    badgeIcon: { height: 20, width: 20 },
    recordItemTitle: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
    recordItemSub: { ...TYPOGRAPHY.caption, color: COLORS.gray500, marginTop: 2 },
    recordItemRight: { alignItems: 'center', flexDirection: 'row', gap: SPACING.xs },
    recordExpenseText: { ...TYPOGRAPHY.body1, color: COLORS.primary, fontFamily: TYPOGRAPHY.button.fontFamily },
    emptyContainer: { alignItems: 'center', paddingVertical: SPACING.xxl },
    emptyText: { ...TYPOGRAPHY.body2, color: COLORS.gray500 },
});
