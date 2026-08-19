import { Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { MOCK_EXPENSE_RECORDS } from '../mock';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { MonthNavigator } from './MonthNavigator';

const parseRecordDate = (value: string) => {
	const [y, m, d] = value.split('.').map(Number);
	return new Date(y, (m || 1) - 1, d || 1);
};

export function MedicalExpenseTab() {
	const router = useRouter();
	const [year, setYear] = useState(() => new Date().getFullYear());
	const [month, setMonth] = useState(() => new Date().getMonth() + 1);

	const formattedTargetMonth = `${year}.${String(month).padStart(2, '0')}`;
	const filteredRecords = MOCK_EXPENSE_RECORDS.filter((record) =>
		record.date.startsWith(formattedTargetMonth)
	);

	// 가장 최근 기록이 속한 달을 "이번 달"로 삼음 (실제 기기 날짜와 무관하게 동작)
	const sortedExpenseDates = MOCK_EXPENSE_RECORDS
		.map((record) => parseRecordDate(record.date))
		.sort((a, b) => a.getTime() - b.getTime());
	const anchorDate = sortedExpenseDates[sortedExpenseDates.length - 1] ?? new Date();
	const anchorYear = anchorDate.getFullYear();
	const anchorMonth = anchorDate.getMonth();

	const monthlyExpenseTotal = MOCK_EXPENSE_RECORDS.reduce((sum, record) => {
		const parsed = parseRecordDate(record.date);
		if (parsed.getFullYear() === anchorYear && parsed.getMonth() === anchorMonth) {
			return sum + record.totalCost;
		}
		return sum;
	}, 0);

	const allTimeExpenseTotal = MOCK_EXPENSE_RECORDS.reduce((sum, record) => sum + record.totalCost, 0);

	return (
		<View style={styles.container}>
			<View style={styles.promoCard}>
				<Text style={styles.promoTitle}>우리아이 맞춤 보험</Text>
				<View style={styles.promoBlankSpace} />
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
				onNextMonth={() => setMonth(m => (m === 12 ? 1 : m + 1))}
				onPrevMonth={() => setMonth(m => (m === 1 ? 12 : m - 1))}
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
	container: { gap: SPACING.xl },
	promoCard: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.xxl },
	promoTitle: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	promoBlankSpace: { height: 80 },
	promoSubtitle: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
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