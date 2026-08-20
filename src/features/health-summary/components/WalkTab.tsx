import { Href, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { usePetStore } from '@/src/features/pet/PetStore';

import { MonthNavigator } from './MonthNavigator';
import {
	getWalks,
	getWeeklySummary,
	type WalkRecord,
	type WeeklySummary,
} from '../services/walkService';

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function pad2(n: number) {
	return String(n).padStart(2, '0');
}

/** startTime(UTC naive) → 로컬 KST 날짜 문자열 "2026-08-21" */
function kstDateFromStartTime(startTime: string): string {
	const dt = new Date(startTime + 'Z'); // UTC로 파싱 → 로컬 KST 변환
	return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** "2026-08-21" → "8월 21일 산책" */
function kstDateToTitle(kstDate: string) {
	const [, m, d] = kstDate.split('-').map(Number);
	return `${m}월 ${d}일 산책`;
}

/** "2026-08-21" → "8/21" */
function kstDateToChartLabel(kstDate: string) {
	const [, m, d] = kstDate.split('-').map(Number);
	return `${m}/${d}`;
}

/** 이번 주 월~일 날짜 범위 */
function getThisWeekRange() {
	const today = new Date();
	const dow = today.getDay(); // 0=일
	const monday = new Date(today);
	monday.setDate(today.getDate() - ((dow + 6) % 7));
	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 6);
	const fmt = (d: Date) =>
		`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
	return { start: fmt(monday), end: fmt(sunday) };
}

/** 해당 월의 마지막 날 */
function lastDayOfMonth(year: number, month: number) {
	return new Date(year, month, 0).getDate();
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function WalkTab() {
	const router = useRouter();
	const { selectedPet } = usePetStore();
	const [year, setYear] = useState(() => new Date().getFullYear());
	const [month, setMonth] = useState(() => new Date().getMonth() + 1);

	const [weekSummary, setWeekSummary] = useState<WeeklySummary | null>(null);
	const [monthRecords, setMonthRecords] = useState<WalkRecord[]>([]);

	const petId = selectedPet ? Number(selectedPet.id) : null;

	// ── 주간 요약 ─────────────────────────────────────────────────────────────
	useEffect(() => {
		if (!petId) return;
		getWeeklySummary(petId)
			.then((summary) => { if (summary) setWeekSummary(summary); })
			.catch(() => null);
	}, [petId]);

	// ── 월별 산책 목록 ─────────────────────────────────────────────────────────
	const fetchMonthRecords = useCallback(() => {
		if (!petId) return;
		const startDate = `${year}-${pad2(month)}-01`;
		const endDate = `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`;
		getWalks(petId, { startDate, endDate })
			.then((records) => setMonthRecords(records ?? []))
			.catch(() => setMonthRecords([]));
	}, [petId, year, month]);

	useEffect(() => {
		fetchMonthRecords();
	}, [fetchMonthRecords]);

	// ── 차트 데이터 — 이번 주 월~일 7일 고정, 기록 없는 날은 0 ────────────────
	const { start: weekStart, end: weekEnd } = getThisWeekRange();

	// 이번 주 7일 날짜 배열 (KST 로컬 날짜)
	const weekDays: string[] = [];
	const weekStartDt = new Date(weekStart + 'T00:00:00');
	for (let i = 0; i < 7; i++) {
		const d = new Date(weekStartDt);
		d.setDate(weekStartDt.getDate() + i);
		weekDays.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
	}

	// monthRecords에서 KST 날짜별 분 합산
	const minutesByKstDate = monthRecords
		.filter((r) => r.startTime && r.durationMinutes != null && r.durationMinutes > 0)
		.reduce<Record<string, number>>((acc, r) => {
			const kstDate = kstDateFromStartTime(r.startTime);
			acc[kstDate] = (acc[kstDate] ?? 0) + (r.durationMinutes ?? 0);
			return acc;
		}, {});

	// 7일 막대 데이터 (기록 없으면 0)
	const barPoints = weekDays.map((date) => ({
		label: kstDateToChartLabel(date),
		minutes: minutesByKstDate[date] ?? 0,
	}));

	// ── 월 기록 — startTime KST 날짜 기준 최신순 정렬 ────────────────────────
	const sortedRecords = monthRecords
		.slice()
		.sort((a, b) => b.startTime.localeCompare(a.startTime));

	return (
		<View style={styles.container}>
			{/* 주간 요약 카드 */}
			<View style={styles.summaryCard}>
				<View>
					<Text style={styles.cardLabel}>이번 주 산책</Text>
					<Text style={styles.walkValue}>
						평균 {weekSummary != null ? `${weekSummary.averageMinutes}분` : '-'}
					</Text>
					{weekSummary?.diffMinutes != null ? (
						<Text style={styles.diffValue}>
							지난주 대비 {weekSummary.diffMinutes > 0 ? '+' : ''}{weekSummary.diffMinutes}분
						</Text>
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

			{/* 일별 산책 시간 차트 */}
			<View style={styles.chartCard}>
				<Text style={styles.chartTitle}>일별 산책 시간</Text>
				{barPoints.length > 0 ? (
					<View style={styles.barChartRow}>
						{barPoints.map((pt, idx) => (
							<View key={`${pt.label}-${idx}`} style={styles.barColumn}>
								<View style={styles.barTrack}>
									<View
										style={[
											styles.barFill,
											{ height: `${Math.min(100, (pt.minutes / 60) * 100)}%` },
										]}
									/>
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

			{/* 월 네비게이터 */}
			<MonthNavigator
				month={month}
				onAddPress={() => router.push('/health-summary/walk-record' as Href)}
				onNextMonth={() => {
					if (month === 12) { setYear((y) => y + 1); setMonth(1); }
					else setMonth((m) => m + 1);
				}}
				onPrevMonth={() => {
					if (month === 1) { setYear((y) => y - 1); setMonth(12); }
					else setMonth((m) => m - 1);
				}}
				showAddButton
				year={year}
			/>

			{/* 산책 기록 목록 */}
			{sortedRecords.length > 0 ? (
				sortedRecords.map((record) => (
					<TouchableOpacity
						activeOpacity={0.8}
						key={record.walkId != null ? String(record.walkId) : record.walkDate}
						onPress={() => {
							if (record.walkId == null) return;
							router.push({
								pathname: '/health-summary/walk-record',
								params: { walkId: String(record.walkId) },
							} as Href);
						}}
						style={styles.recordItem}
					>
						<View style={styles.recordItemLeft}>
							<View style={styles.walkBadge}>
								<Image
									resizeMode="contain"
									source={HEALTH_SUMMARY_IMAGES.icons.walk}
									style={styles.badgeIcon}
								/>
							</View>
							<View>
								<Text style={styles.recordItemTitle}>
									{kstDateToTitle(kstDateFromStartTime(record.startTime))}
								</Text>
								<Text style={styles.recordItemSub}>
									{record.walkingAmount > 0
										? `${record.walkingAmount}km`
										: '거리 미기록'}
								</Text>
							</View>
						</View>
						<View style={styles.recordItemRight}>
							{record.durationMinutes != null && record.durationMinutes > 0 ? (
								<Text style={styles.recordDurationText}>
									{record.durationMinutes >= 60
										? `${Math.floor(record.durationMinutes / 60)}시간 ${record.durationMinutes % 60}분`
										: `${record.durationMinutes}분`}
								</Text>
							) : null}
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
	diffValue: { color: COLORS.success, fontWeight: '700' },
	recordButton: {
		alignItems: 'center',
		backgroundColor: COLORS.success,
		borderRadius: RADIUS.segment,
		justifyContent: 'center',
		paddingVertical: 12,
		width: 108,
	},
	recordButtonText: { ...TYPOGRAPHY.smallButton, color: COLORS.background },
	chartCard: {
		backgroundColor: COLORS.background,
		borderColor: COLORS.gray200,
		borderRadius: RADIUS.lg,
		borderWidth: 1,
		padding: SPACING.xxl,
	},
	chartTitle: {
		...TYPOGRAPHY.body1,
		color: COLORS.black,
		fontFamily: TYPOGRAPHY.button.fontFamily,
		marginBottom: SPACING.xxl,
	},
	barChartRow: {
		alignItems: 'flex-end',
		flexDirection: 'row',
		height: 120,
		justifyContent: 'space-between',
	},
	barChartEmptyContainer: { alignItems: 'center', height: 120, justifyContent: 'center' },
	barColumn: { alignItems: 'center', gap: 8, minWidth: 30 },
	barTrack: {
		backgroundColor: COLORS.gray100,
		borderRadius: RADIUS.round,
		height: 86,
		justifyContent: 'flex-end',
		overflow: 'hidden',
		width: 22,
	},
	barFill: { backgroundColor: COLORS.success, borderRadius: RADIUS.round, width: '100%' },
	barLabel: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
	recordItem: {
		alignItems: 'center',
		backgroundColor: COLORS.background,
		borderColor: COLORS.gray200,
		borderRadius: RADIUS.lg,
		borderWidth: 1,
		flexDirection: 'row',
		justifyContent: 'space-between',
		padding: SPACING.xl,
	},
	recordItemLeft: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
	walkBadge: {
		alignItems: 'center',
		backgroundColor: COLORS.successSoft,
		borderRadius: RADIUS.round,
		height: 44,
		justifyContent: 'center',
		width: 44,
	},
	badgeIcon: { height: 22, width: 22 },
	recordItemTitle: {
		...TYPOGRAPHY.body2,
		color: COLORS.black,
		fontFamily: TYPOGRAPHY.button.fontFamily,
	},
	recordItemSub: { ...TYPOGRAPHY.small, color: COLORS.gray500, marginTop: 2 },
	recordItemRight: { alignItems: 'center', flexDirection: 'row', gap: SPACING.xs },
	recordDurationText: {
		...TYPOGRAPHY.body1,
		color: COLORS.success,
		fontFamily: TYPOGRAPHY.button.fontFamily,
	},
	emptyContainer: { alignItems: 'center', paddingVertical: SPACING.xxl },
	emptyText: { ...TYPOGRAPHY.body2, color: COLORS.gray500 },
});
