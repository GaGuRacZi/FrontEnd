import { Href, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { usePetStore } from '@/src/features/pet/PetStore';

import { getHealthRecordLoadKey, useHealthSummaryStore } from '../HealthSummaryStore';
import { getRecordsForMonth, getWalkOverview } from '../healthSummarySelectors';
import { MonthNavigator } from './MonthNavigator';

const toChartLabel = (value: string) => {
	const [, month, day] = value.split('.');
	return `${Number(month)}/${Number(day)}`;
};

export function WalkTab() {
	const router = useRouter();
	const { selectedPet } = usePetStore();
	const { loadMonth, recordLoadErrors, walkDailySummaries, walkRecords, walkWeeklySummaries } = useHealthSummaryStore();
	const [year, setYear] = useState(() => new Date().getFullYear());
	const [month, setMonth] = useState(() => new Date().getMonth() + 1);

	const records = selectedPet
		? walkRecords.filter((record) => record.petId === selectedPet.id)
		: [];
	const filteredRecords = getRecordsForMonth(records, year, month);
	const recordsLoadFailed = selectedPet
		? recordLoadErrors[getHealthRecordLoadKey(selectedPet.id, year, month)]?.walk
		: false;
	const fallbackOverview = getWalkOverview(records);
	const weeklySummary = selectedPet ? walkWeeklySummaries[selectedPet.id] : undefined;
	const thisWeekAvg = weeklySummary?.averageMinutes ?? fallbackOverview.average;
	const weeklyDiff = weeklySummary?.diffMinutes ?? fallbackOverview.difference;
	const dailySummaries = selectedPet ? (walkDailySummaries[selectedPet.id] ?? []) : [];
	const barPoints = dailySummaries.some((entry) => entry.totalMinutes > 0)
		? dailySummaries.map((entry) => ({ label: toChartLabel(entry.date), minutes: entry.totalMinutes }))
		: [];

	useEffect(() => {
		if (selectedPet) void loadMonth(selectedPet.id, year, month).catch(() => undefined);
	}, [loadMonth, month, selectedPet, year]);

	return (
		<View style={styles.container}>
			<View style={styles.summaryCard}>
				<View>
					<Text style={styles.cardLabel}>이번 주 산책</Text>
					<Text style={styles.walkValue}>평균 {thisWeekAvg !== null ? `${thisWeekAvg}분` : '-'}</Text>
					{weeklyDiff !== null ? (
						<Text style={styles.diffValue}>지난주 대비 {weeklyDiff > 0 ? '+' : ''}{weeklyDiff}분</Text>
					) : null}
				</View>
				<TouchableOpacity
					activeOpacity={0.8}
					onPress={() => router.push('/health-summary/walk-tracking' as Href)}
					style={styles.recordButton}
				>
					<Text style={styles.recordButtonText}>자동 기록 하기</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.chartCard}>
				<Text style={styles.chartTitle}>일별 산책 시간</Text>
				{barPoints.length > 0 ? (
					<View style={styles.barChartRow}>
						{barPoints.map((pt, idx) => (
							<View key={`${pt.label}-${idx}`} style={styles.barColumn}>
								<View style={styles.barTrack}>
									<View style={[styles.barFill, { height: `${Math.min(100, (pt.minutes / 60) * 100)}%` }]} />
								</View>
								<Text style={styles.barLabel}>{pt.label}</Text>
							</View>
						))}
					</View>
				) : (
					<View style={styles.barChartEmptyContainer}>
						<Text style={styles.emptyText}>기록된 산책이 없어요.</Text>
					</View>
				)}
			</View>

			<MonthNavigator
				month={month}
				onAddPress={() => router.push('/health-summary/walk-record' as Href)}
				onNextMonth={() => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }}
				onPrevMonth={() => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }}
				showAddButton
				year={year}
			/>

			{filteredRecords.length > 0 ? (
				filteredRecords.map((record) => (
					<TouchableOpacity
						activeOpacity={0.8}
						key={record.id}
						onPress={() => router.push({ pathname: '/health-summary/walk-record', params: { recordId: record.id } } as Href)}
						style={styles.recordItem}
					>
						<View style={styles.recordItemLeft}>
							<View style={styles.walkBadge}>
								<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.walk} style={styles.badgeIcon} />
							</View>
							<View>
								<Text style={styles.recordItemTitle}>{record.dayLabel}</Text>
								<Text style={styles.recordItemSub}>{record.distanceKm > 0 ? `${record.distanceKm}km` : '거리 미기록'}</Text>
							</View>
						</View>
						<View style={styles.recordItemRight}>
							<Text style={styles.recordDurationText}>
								{record.durationMinutes >= 60
									? `${Math.floor(record.durationMinutes / 60)}시간 ${record.durationMinutes % 60}분`
									: `${record.durationMinutes}분`}
							</Text>
							<AppIcon color={COLORS.gray500} name="chevron-forward" size={16} />
						</View>
					</TouchableOpacity>
				))
			) : (
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>
						{recordsLoadFailed ? '산책 기록을 불러오지 못했어요.' : '해당 월에 기록된 산책이 없어요.'}
					</Text>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { gap: SPACING.xl },
	summaryCard: {
		alignItems: 'center',
		backgroundColor: COLORS.successSoft,
		borderRadius: RADIUS.lg,
		flexDirection: 'row',
		height: 140,
		justifyContent: 'space-between',
		paddingLeft: 38,
		paddingRight: 45,
	},
	cardLabel: { ...TYPOGRAPHY.body1, color: COLORS.gray600, fontFamily: TYPOGRAPHY.button.fontFamily },
	walkValue: { ...TYPOGRAPHY.title1, color: COLORS.black, fontSize: 32, lineHeight: 42, marginVertical: 4 },
	diffText: { ...TYPOGRAPHY.small, color: COLORS.gray600 },
	diffValue: { color: COLORS.success, fontWeight: '700' },
	recordButton: { alignItems: 'center', backgroundColor: COLORS.success, borderRadius: RADIUS.segment, justifyContent: 'center', paddingVertical: 12, width: 108 },
	recordButtonText: { ...TYPOGRAPHY.smallButton, color: COLORS.background },
	chartCard: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.xxl },
	chartTitle: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily, marginBottom: SPACING.xxl },
	barChartRow: { alignItems: 'flex-end', flexDirection: 'row', height: 120, justifyContent: 'space-between' },
	barChartEmptyContainer: { alignItems: 'center', height: 120, justifyContent: 'center' },
	barColumn: { alignItems: 'center', gap: 8, minWidth: 30 },
	barTrack: { backgroundColor: COLORS.gray100, borderRadius: RADIUS.round, height: 86, justifyContent: 'flex-end', overflow: 'hidden', width: 22 },
	barFill: { backgroundColor: COLORS.success, borderRadius: RADIUS.round, width: '100%' },
	barLabel: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
    recordItem: { alignItems: 'center', backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.xl },
	recordItemLeft: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
	walkBadge: { alignItems: 'center', backgroundColor: COLORS.successSoft, borderRadius: RADIUS.round, height: 44, justifyContent: 'center', width: 44 },
	badgeIcon: { height: 22, width: 22 },
	recordItemTitle: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	recordItemSub: { ...TYPOGRAPHY.small, color: COLORS.gray500, marginTop: 2 },
	recordItemRight: { alignItems: 'center', flexDirection: 'row', gap: SPACING.xs },
	recordDurationText: { ...TYPOGRAPHY.body1, color: COLORS.success, fontFamily: TYPOGRAPHY.button.fontFamily },
	emptyContainer: { alignItems: 'center', paddingVertical: SPACING.xxl },
	emptyText: { ...TYPOGRAPHY.body2, color: COLORS.gray500 },
});
