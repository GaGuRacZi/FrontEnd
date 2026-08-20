import { Href, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { usePetStore } from '@/src/features/pet/PetStore';

import { useHealthSummaryStore } from '../HealthSummaryStore';
import { getRecordsForMonth, getWeightOverview } from '../healthSummarySelectors';
import { MonthNavigator } from './MonthNavigator';

const CHART_HEIGHT = 120;
const GRID_BOTTOM_OFFSET = 30;

const toChartLabel = (value: string) => {
	const [, month, day] = value.split('.');
	return `${Number(month)}/${Number(day)}`;
};

export function WeightTab() {
	const router = useRouter();
	const { selectedPet } = usePetStore();
	const { loadMonth, weightGraphs, weightRecords, weightSummaries } = useHealthSummaryStore();
	const [rangeTab, setRangeTab] = useState<'1m' | '6m'>('1m');
	const [year, setYear] = useState(() => new Date().getFullYear());
	const [month, setMonth] = useState(() => new Date().getMonth() + 1);
	const [chartWidth, setChartWidth] = useState(0);

	const records = selectedPet
		? weightRecords.filter((record) => record.petId === selectedPet.id)
		: [];
	const filteredRecords = getRecordsForMonth(records, year, month);
	const fallbackOverview = getWeightOverview(records);
	const summary = selectedPet ? weightSummaries[selectedPet.id] : undefined;
	const currentWeight = summary?.currentWeight ?? fallbackOverview.currentWeight;
	const weightDiff = summary?.monthChange ?? fallbackOverview.difference;
	const chartPoints = selectedPet
		? (weightGraphs[`${selectedPet.id}:${rangeTab === '1m' ? 'ONE_MONTH' : 'SIX_MONTHS'}`] ?? [])
			.map((point) => ({ label: toChartLabel(point.date), weight: point.weight }))
		: [];

	useEffect(() => {
		if (selectedPet) void loadMonth(selectedPet.id, year, month).catch(() => undefined);
	}, [loadMonth, month, selectedPet, year]);

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
						<Text style={styles.diffValue}>이전 기록 대비 {weightDiff > 0 ? '+' : ''}{weightDiff}kg</Text>
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
				onNextMonth={() => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }}
				onPrevMonth={() => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }}
				year={year}
			/>

			{filteredRecords.length > 0 ? (
				filteredRecords.map((record) => (
					<TouchableOpacity
						activeOpacity={0.8}
						key={record.id}
						onPress={() => router.push({ pathname: '/health-summary/weight-record', params: { recordId: record.id } } as Href)}
						style={styles.recordItem}
					>
						<View style={styles.recordItemLeft}>
							<View style={styles.cameraBadge}>
								<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.weight} style={styles.badgeIcon} />
							</View>
							<View>
								<Text style={styles.recordItemTitle}>{record.time}</Text>
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
		paddingRight: 45,
	},
	cardLabel: { ...TYPOGRAPHY.body1, color: COLORS.gray600, fontFamily: TYPOGRAPHY.button.fontFamily },
	weightValue: { ...TYPOGRAPHY.title1, color: COLORS.black, fontSize: 36, lineHeight: 46, marginVertical: 4 },
	weightUnit: { fontSize: 24, fontWeight: 'normal', lineHeight: 46 },
	diffText: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	diffValue: { color: COLORS.alert, fontWeight: '700' },
	recordButton: { alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: RADIUS.segment, justifyContent: 'center', paddingVertical: 12, width: 108 },
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
	pointColumn: { alignItems: 'center', flex: 1, height: '100%', position: 'relative' },
	chartDot: { backgroundColor: COLORS.background, borderColor: COLORS.primary, borderRadius: 6, borderWidth: 3, height: 12, position: 'absolute', width: 12 },
	chartXLabel: {
		...TYPOGRAPHY.caption,
		color: COLORS.gray500,
		left: 0,
		position: 'absolute',
		right: 0,
		textAlign: 'center',
		top: CHART_HEIGHT - GRID_BOTTOM_OFFSET + 24,
	},
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
