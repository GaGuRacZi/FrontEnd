import { Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { MOCK_WEIGHT_RECORDS } from '../mock';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { WeightRecord } from '../types';
import { MonthNavigator } from './MonthNavigator';

const CHART_HEIGHT = 120;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseRecordDate = (value: string) => {
	const [y, m, d] = value.split('.').map(Number);
	return new Date(y, (m || 1) - 1, d || 1);
};

const toChartLabel = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;

type WeightEntry = { record: WeightRecord; parsedDate: Date };

const getSortedWeightEntries = (records: WeightRecord[]): WeightEntry[] =>
	records
		.map((record) => ({ record, parsedDate: parseRecordDate(record.date) }))
		.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

export function WeightTab() {
	const router = useRouter();
	const [rangeTab, setRangeTab] = useState<'1m' | '6m'>('1m');
	const [year, setYear] = useState(() => new Date().getFullYear());
	const [month, setMonth] = useState(() => new Date().getMonth() + 1);
	const [chartWidth, setChartWidth] = useState(0);

	const formattedTargetMonth = `${year}.${String(month).padStart(2, '0')}`;
	const filteredRecords = MOCK_WEIGHT_RECORDS.filter((record) =>
		record.date.startsWith(formattedTargetMonth)
	);

	// 가장 최근 기록을 "현재 시점"으로 삼아서, 실제 기기 날짜와 상관없이
	// 목데이터/실기록 모두 항상 최신 구간이 그래프·요약에 잡히게 함
	const sortedEntries = getSortedWeightEntries(MOCK_WEIGHT_RECORDS);
	const latestEntry = sortedEntries[sortedEntries.length - 1] ?? null;
	const currentWeight = latestEntry?.record.weight ?? null;

	const targetBaselineTime = latestEntry ? latestEntry.parsedDate.getTime() - 30 * MS_PER_DAY : 0;
	const baselineEntry = latestEntry
		? sortedEntries
			.filter((entry) => entry !== latestEntry)
			.reduce<WeightEntry | null>((closest, entry) => {
				if (!closest) return entry;
				const closestDiff = Math.abs(closest.parsedDate.getTime() - targetBaselineTime);
				const entryDiff = Math.abs(entry.parsedDate.getTime() - targetBaselineTime);
				return entryDiff < closestDiff ? entry : closest;
			}, null)
		: null;

	const weightDiff = latestEntry && baselineEntry
		? Math.round((latestEntry.record.weight - baselineEntry.record.weight) * 10) / 10
		: null;

	const rangeDays = rangeTab === '1m' ? 30 : 180;
	const anchorTime = latestEntry ? latestEntry.parsedDate.getTime() : Date.now();
	const cutoffTime = anchorTime - rangeDays * MS_PER_DAY;

	const chartPointsByDate = new Map<string, { date: Date; weight: number }>();
	MOCK_WEIGHT_RECORDS.forEach((record) => {
		const parsedDate = parseRecordDate(record.date);
		if (parsedDate.getTime() < cutoffTime) return;
		if (!chartPointsByDate.has(record.date)) {
			chartPointsByDate.set(record.date, { date: parsedDate, weight: record.weight });
		}
	});

	const chartPoints = Array.from(chartPointsByDate.values())
		.sort((a, b) => a.date.getTime() - b.date.getTime())
		.map((entry) => ({ label: toChartLabel(entry.date), weight: entry.weight }));

	const weightValues = chartPoints.map((p) => p.weight);
	const minWeight = weightValues.length ? Math.min(...weightValues) : 0;
	const maxWeight = weightValues.length ? Math.max(...weightValues) : 0;
	const valueSpan = Math.max(maxWeight - minWeight, 0.4);
	const chartBaseline = minWeight - valueSpan * 0.15;
	const valueScale = 70 / (valueSpan * 1.3);

	const pointCount = chartPoints.length;
	const columnWidth = pointCount > 0 ? chartWidth / pointCount : 0;
	const getPointCenter = (index: number, weight: number) => {
		const x = columnWidth * (index + 0.5);
		const bottomY = (weight - chartBaseline) * valueScale + 6;
		return { x, topY: CHART_HEIGHT - bottomY };
	};

	return (
		<View style={styles.container}>
			<View style={styles.summaryCard}>
				<View>
					<Text style={styles.cardLabel}>현재 체중</Text>
					<Text style={styles.weightValue}>
						{currentWeight !== null ? currentWeight.toFixed(1) : '-'}
						<Text style={styles.weightUnit}>kg</Text>
					</Text>
					{weightDiff !== null ? (
						<Text style={styles.diffValue}>이번 달 {weightDiff > 0 ? '+' : ''}{weightDiff}kg</Text>
					) : null}
				</View>
				<TouchableOpacity
					activeOpacity={0.8}
					onPress={() => router.push('/health-summary/weight-record' as Href)}
					style={styles.recordButton}
				>
					<Text style={styles.recordButtonText}>기록 하기</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.chartCard}>
				<View style={styles.chartHeader}>
					<Text style={styles.chartTitle}>최근 체중 변화</Text>
					<View style={styles.rangeSelector}>
						<TouchableOpacity
							activeOpacity={0.7}
							onPress={() => setRangeTab('1m')}
							style={[styles.rangeTab, rangeTab === '1m' && styles.rangeTabActive]}
						>
							<Text style={[styles.rangeTabText, rangeTab === '1m' && styles.rangeTabTextActive]}>1개월</Text>
						</TouchableOpacity>
						<TouchableOpacity
							activeOpacity={0.7}
							onPress={() => setRangeTab('6m')}
                            style={[styles.rangeTab, rangeTab === '6m' && styles.rangeTabActive]}						>
							<Text style={[styles.rangeTabText, rangeTab === '6m' && styles.rangeTabTextActive]}>6개월</Text>
						</TouchableOpacity>
					</View>
				</View>

				{chartPoints.length > 0 ? (
					<View
						onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
						style={styles.chartArea}
					>
						<View style={styles.gridLineTop} />
						<View style={styles.gridLineBottom} />

						{chartWidth > 0 ? (
							<View pointerEvents="none" style={StyleSheet.absoluteFill}>
								{chartPoints.slice(0, -1).map((pt, idx) => {
									const nextPt = chartPoints[idx + 1];
									const p1 = getPointCenter(idx, pt.weight);
									const p2 = getPointCenter(idx + 1, nextPt.weight);
									const dx = p2.x - p1.x;
									const dy = p2.topY - p1.topY;
									const length = Math.sqrt(dx * dx + dy * dy);
									const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
									const midX = (p1.x + p2.x) / 2;
									const midTopY = (p1.topY + p2.topY) / 2;

									return (
										<View
											key={`${pt.label}-${nextPt.label}-${idx}`}
											style={[
												styles.chartLineSegment,
												{
													left: midX - length / 2,
													top: midTopY - 1,
													transform: [{ rotate: `${angleDeg}deg` }],
													width: length,
												},
											]}
										/>
									);
								})}
							</View>
						) : null}

						<View style={styles.chartPointsRow}>
							{chartPoints.map((pt, idx) => (
								<View key={`${pt.label}-${idx}`} style={styles.pointColumn}>
									<View style={[styles.chartDot, { bottom: (pt.weight - chartBaseline) * valueScale }]} />
									<Text style={styles.chartXLabel}>{pt.label}</Text>
								</View>
							))}
						</View>
					</View>
				) : (
					<View style={styles.chartEmptyContainer}>
						<Text style={styles.emptyText}>이 기간에 기록된 체중이 없어요.</Text>
					</View>
				)}
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
						onPress={() => router.push('/health-summary/weight-record' as Href)}
						style={styles.recordItem}
					>
						<View style={styles.recordItemLeft}>
							<View style={styles.cameraBadge}>
								<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.weight} style={styles.badgeIcon} />
							</View>
							<View>
								<Text style={styles.recordItemTitle}>오늘 기록</Text>
								<Text style={styles.recordItemSub}>
									{record.date} · {record.isDirectInput ? '직접 입력' : '측정'}
								</Text>
							</View>
						</View>
						<View style={styles.recordItemRight}>
							<Text style={styles.recordWeightText}>{record.weight}kg</Text>
							<AppIcon color={COLORS.gray500} name="chevron-forward" size={16} />
						</View>
					</TouchableOpacity>
				))
			) : (
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>해당 월에 기록된 체중이 없어요.</Text>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { gap: SPACING.xl },
	summaryCard: {
		alignItems: 'center',
		backgroundColor: COLORS.weightcontainer,
		borderRadius: RADIUS.lg,
		flexDirection: 'row',
		height: 140,
		justifyContent: 'space-between',
		paddingLeft: 38,
		paddingRight: 60,
	},
	cardLabel: { ...TYPOGRAPHY.body1, color: COLORS.gray600, fontFamily: TYPOGRAPHY.button.fontFamily },
	weightValue: { ...TYPOGRAPHY.title1, color: COLORS.black, fontSize: 36, lineHeight: 46, marginVertical: 4 },
	weightUnit: { fontSize: 24, fontWeight: 'normal', lineHeight: 46 },
	diffText: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	diffValue: { color: COLORS.alert, fontWeight: '700' },
	recordButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.segment, paddingHorizontal: 20, paddingVertical: 12 },
	recordButtonText: { ...TYPOGRAPHY.smallButton, color: COLORS.background },
	chartCard: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.xxl },
	chartHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xxl },
	chartTitle: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	rangeSelector: { backgroundColor: COLORS.gray100, borderRadius: RADIUS.round, flexDirection: 'row', padding: 2 },
	rangeTab: { borderRadius: RADIUS.round, paddingHorizontal: SPACING.lg, paddingVertical: 6 },
	rangeTabActive: { backgroundColor: COLORS.primary },
	rangeTabText: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
	rangeTabTextActive: { color: COLORS.background, fontFamily: TYPOGRAPHY.button.fontFamily },
	chartArea: { height: CHART_HEIGHT, justifyContent: 'flex-end', position: 'relative' },
	chartEmptyContainer: { alignItems: 'center', height: CHART_HEIGHT, justifyContent: 'center' },
	gridLineTop: { backgroundColor: COLORS.gray200, height: 1, left: 0, position: 'absolute', right: 0, top: 20 },
	gridLineBottom: { backgroundColor: COLORS.gray200, bottom: 30, height: 1, left: 0, position: 'absolute', right: 0 },
	chartLineSegment: { backgroundColor: COLORS.primary, height: 2, position: 'absolute' },
	chartPointsRow: { flexDirection: 'row', height: '100%' },
	pointColumn: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end', position: 'relative' },
	chartDot: { backgroundColor: COLORS.background, borderColor: COLORS.primary, borderRadius: 6, borderWidth: 3, height: 12, position: 'absolute', width: 12 },
	chartXLabel: { ...TYPOGRAPHY.caption, color: COLORS.gray500, marginTop: 14 },
	recordItem: { alignItems: 'center', backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.xl },
	recordItemLeft: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
	cameraBadge: { alignItems: 'center', backgroundColor: COLORS.summarycontainer, borderRadius: RADIUS.round, height: 36, justifyContent: 'center', width: 36 },
	badgeIcon: { height: 20, width: 20 },
	recordItemTitle: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	recordItemSub: { ...TYPOGRAPHY.small, color: COLORS.gray500, marginTop: 2 },
	recordItemRight: { alignItems: 'center', flexDirection: 'row', gap: SPACING.xs },
	recordWeightText: { ...TYPOGRAPHY.body1, color: COLORS.primary, fontFamily: TYPOGRAPHY.button.fontFamily },
	emptyContainer: { alignItems: 'center', paddingVertical: SPACING.xxl },
	emptyText: { ...TYPOGRAPHY.body2, color: COLORS.gray500 },
});