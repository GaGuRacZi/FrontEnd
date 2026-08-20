import { Href, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { useHealthSummaryStore } from '../HealthSummaryStore';
import { MonthNavigator } from './MonthNavigator';
import { usePetStore } from '@/src/features/pet/PetStore';

const CARROT_AD_IMAGE = require('@/assets/images/health-summary/ad.jpg');

export function MedicalExpenseTab() {
    const router = useRouter();
    const { expenseSummaries, loadMonth, medicalExpenseRecords } = useHealthSummaryStore();
    const { selectedPet } = usePetStore();
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [month, setMonth] = useState(() => new Date().getMonth() + 1);

    const formattedTargetMonth = `${year}.${String(month).padStart(2, '0')}`;
    const filteredRecords = medicalExpenseRecords.filter((record) =>
        record.petId === selectedPet?.id && record.date.startsWith(formattedTargetMonth)
    );

    const summary = selectedPet ? expenseSummaries[selectedPet.id] : undefined;
    const monthlyExpenseTotal = summary?.monthlyTotalAmount ?? filteredRecords.reduce((sum, record) => sum + record.totalCost, 0);
    const allTimeExpenseTotal = summary?.totalAmount ?? filteredRecords.reduce((sum, record) => sum + record.totalCost, 0);

    useEffect(() => {
        if (selectedPet) void loadMonth(selectedPet.id, year, month).catch(() => undefined);
    }, [loadMonth, month, selectedPet, year]);

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
                        {monthlyExpenseTotal.toLocaleString()}원
                    </Text>
                    <Text numberOfLines={1} style={styles.totalValue}>총 병원비: {allTimeExpenseTotal.toLocaleString()}원</Text>
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

            {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        key={record.id}
                        onPress={() => router.push({ pathname: '/health-summary/medical-expense-record', params: { recordId: record.id } } as Href)}
                        style={styles.recordItem}
                    >
                        <View style={styles.recordItemLeft}>
                            <View style={styles.expenseBadge}>
                                <Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.bill} style={styles.badgeIcon} />
                            </View>
                            <View>
                                <Text style={styles.recordItemTitle}>{record.hospitalName}</Text>
                                <Text style={styles.recordItemSub}>{record.date}</Text>
                            </View>
                        </View>
                        <View style={styles.recordItemRight}>
                            <Text style={styles.recordExpenseText}>
                                {record.totalCost.toLocaleString()}원
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
        gap: SPACING.md 
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
        marginBottom: 0 
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
    totalBadge: { ...TYPOGRAPHY.small, color: COLORS.primary },
    totalValue: { color: COLORS.primary, fontFamily: TYPOGRAPHY.button.fontFamily },
    recordButton: { alignItems: 'center', backgroundColor: COLORS.gold, borderRadius: RADIUS.segment, flexShrink: 0, justifyContent: 'center', paddingVertical: 12, width: 108 },
    recordButtonText: { ...TYPOGRAPHY.smallButton, color: COLORS.background },
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
