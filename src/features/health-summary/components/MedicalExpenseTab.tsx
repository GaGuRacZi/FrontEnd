import { Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { MOCK_EXPENSE_RECORDS } from '../mock';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { MonthNavigator } from './MonthNavigator';

const CARROT_AD_IMAGE = require('@/assets/images/health-summary/ad.jpg');

export function MedicalExpenseTab() {
	const router = useRouter();
	const [year, setYear] = useState(() => new Date().getFullYear());
	const [month, setMonth] = useState(() => new Date().getMonth() + 1);

	const formattedTargetMonth = `${year}.${String(month).padStart(2, '0')}`;
	const filteredRecords = MOCK_EXPENSE_RECORDS.filter((record) =>
		record.date.startsWith(formattedTargetMonth)
	);

	const monthlyExpenseTotal = filteredRecords.reduce((sum, record) => sum + record.totalCost, 0);
	const allTimeExpenseTotal = MOCK_EXPENSE_RECORDS.reduce((sum, record) => sum + record.totalCost, 0);

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
				<View>
					<Text style={styles.cardLabel}>이번 달 병원비</Text>
					<Text style={styles.expenseValue}>{monthlyExpenseTotal.toLocaleString()}원</Text>
					<Text style={styles.totalValue}>총 병원비: {allTimeExpenseTotal.toLocaleString()}원</Text>
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
						onPress={() => router.push('/health-summary/medical-expense-record' as Href)}
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
        padding: SPACING.xl, // 카드의 전체적인 안쪽 여백을 타이트하게 조절합니다.
        gap: SPACING.md // 💡 타이틀 - 사진 - 서브타이틀 사이의 간격만 딱 예쁘게 띄워줍니다.
    },
    promoTitle: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
    promoImage: {
        width: '100%',
        height: 170, // 💡 핵심: % 대신 170 픽셀로 고정! 이전의 그 예쁜 비율이 확정적으로 나옵니다.
        resizeMode: 'contain', // 원본이 잘리지 않고 완벽하게 쏙 들어갑니다.
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
		paddingRight: 37,
	},
	cardLabel: { ...TYPOGRAPHY.body2, color: COLORS.gray800, fontFamily: TYPOGRAPHY.button.fontFamily },
	expenseValue: { ...TYPOGRAPHY.title1, color: COLORS.black, fontSize: 32, lineHeight: 42, marginVertical: 4 },
	totalBadge: { ...TYPOGRAPHY.small, color: COLORS.primary },
	totalValue: { color: COLORS.primary, fontFamily: TYPOGRAPHY.button.fontFamily },
	recordButton: { backgroundColor: COLORS.gold, borderRadius: RADIUS.segment, paddingHorizontal: 20, paddingVertical: 12 },
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