import { Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { MOCK_WALK_RECORDS } from '../mock';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { WalkRecord } from '../types';
import { MonthNavigator } from './MonthNavigator';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseRecordDate = (value: string) => {
	const [y, m, d] = value.split('.').map(Number);
	return new Date(y, (m || 1) - 1, d || 1);
};

const toChartLabel = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;

type WalkEntry = { record: WalkRecord; parsedDate: Date };

const getSortedWalkEntries = (records: WalkRecord[]): WalkEntry[] =>
	records
		.map((record) => ({ record, parsedDate: parseRecordDate(record.date) }))
		.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

const average = (entries: WalkEntry[]) =>
	entries.length > 0
		? Math.round(entries.reduce((sum, entry) => sum + entry.record.durationMinutes, 0) / entries.length)
		: null;

export function WalkTab() {
	const router = useRouter();
	const [year, setYear] = useState(() => new Date().getFullYear());
	const [month, setMonth] = useState(() => new Date().getMonth() + 1);

	const formattedTargetMonth = `${year}.${String(month).padStart(2, '0')}`;
	const filteredRecords = MOCK_WALK_RECORDS.filter((record) =>
		record.date.startsWith(formattedTargetMonth)
	);

	// 가장 최근 기록을 "이번 주"의 기준으로 삼음 (실제 기기 날짜와 무관하게 동작)
	const sortedEntries = getSortedWalkEntries(MOCK_WALK_RECORDS);
	const latestEntry = sortedEntries[sortedEntries.length - 1] ?? null;
	const anchorTime = latestEntry ? latestEntry.parsedDate.getTime() : Date.now();

	const thisWeekEntries = sortedEntries.filter(
		(entry) => anchorTime - entry.parsedDate.getTime() < 7 * MS_PER_DAY
	);
	const lastWeekEntries = sortedEntries.filter((entry) => {
		const gap = anchorTime - entry.parsedDate.getTime();
		return gap >= 7 * MS_PER_DAY && gap < 14 * MS_PER_DAY;
	});

	const thisWeekAvg = average(thisWeekEntries);
	const lastWeekAvg = average(lastWeekEntries);
	const weeklyDiff = thisWeekAvg !== null && lastWeekAvg !== null ? thisWeekAvg - lastWeekAvg : null;

	const barPointsByDate = new Map<string, { date: Date; minutes: number }>();
	MOCK_WALK_RECORDS.forEach((record) => {
		const parsedDate = parseRecordDate(record.date);
		const existing = barPointsByDate.get(record.date);
		if (existing) {
			existing.minutes += record.durationMinutes;
		} else {
			barPointsByDate.set(record.date, { date: parsedDate, minutes: record.durationMinutes });
		}
	});

	const barPoints = Array.from(barPointsByDate.values())
		.sort((a, b) => a.date.getTime() - b.date.getTime())
		.slice(-7)
		.map((entry) => ({ label: toChartLabel(entry.date), minutes: entry.minutes }));

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
						onPress={() => router.push('/health-summary/walk-record' as Href)}
						style={styles.recordItem}
					>
						<View style={styles.recordItemLeft}>
							<View style={styles.walkBadge}>
								<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.walk} style={styles.badgeIcon} />
							</View>
							<View>
								<Text style={styles.recordItemTitle}>{record.dayLabel}</Text>
								<Text style={styles.recordItemSub}>{record.distanceKm}km</Text>
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
					<Text style={styles.emptyText}>해당 월에 기록된 산책이 없어요.</Text>
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
	recordButton: { backgroundColor: COLORS.success, borderRadius: RADIUS.segment, paddingHorizontal: 10, paddingVertical: 12 },
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