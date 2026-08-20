import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from './AppIcon';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/src/constants';

const DAYS_KO = ['월', '화', '수', '목', '금', '토', '일'];

function buildCalendarWeeks(year: number, month: number): (number | null)[][] {
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const jsDay = new Date(year, month, 1).getDay();
	const firstIdx = jsDay === 0 ? 6 : jsDay - 1;
	const cells: (number | null)[] = [
		...Array<null>(firstIdx).fill(null),
		...Array.from({ length: daysInMonth }, (_, i) => i + 1),
	];
	while (cells.length % 7 !== 0) cells.push(null);
	const weeks: (number | null)[][] = [];
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
	return weeks;
}

interface DatePickerSheetProps {
	visible: boolean;
	value: Date;
	title?: string;
	onClose: () => void;
	onSelect: (date: Date) => void;
}

export function DatePickerSheet({ visible, value, title = '날짜 선택', onClose, onSelect }: DatePickerSheetProps) {
	const sheetY = useRef(new Animated.Value(500)).current;
	const [pickerYear, setPickerYear] = useState(value.getFullYear());
	const [pickerMonth, setPickerMonth] = useState(value.getMonth());

	useEffect(() => {
		if (visible) {
			setPickerYear(value.getFullYear());
			setPickerMonth(value.getMonth());
			sheetY.setValue(500);
			Animated.timing(sheetY, { toValue: 0, duration: 300, useNativeDriver: true }).start();
		}
	}, [visible]);

	const close = () => {
		Animated.timing(sheetY, { toValue: 500, duration: 220, useNativeDriver: true }).start(() => onClose());
	};

	const prevMonth = () => {
		if (pickerMonth === 0) { setPickerYear(y => y - 1); setPickerMonth(11); } else setPickerMonth(m => m - 1);
	};
	const nextMonth = () => {
		if (pickerMonth === 11) { setPickerYear(y => y + 1); setPickerMonth(0); } else setPickerMonth(m => m + 1);
	};

	const handleSelect = (day: number) => {
		onSelect(new Date(pickerYear, pickerMonth, day));
		close();
	};

	const weeks = buildCalendarWeeks(pickerYear, pickerMonth);

	return (
		<Modal animationType="none" onRequestClose={close} statusBarTranslucent transparent visible={visible}>
			<Pressable onPress={close} style={styles.overlay}>
				<Animated.View onStartShouldSetResponder={() => true} style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
					<View style={styles.handle} />
					<View style={styles.sheetHeader}>
						<Text style={styles.sheetTitle}>{title}</Text>
						<Pressable hitSlop={8} onPress={close} style={styles.closeCircleBtn}>
							<AppIcon color={COLORS.gray600} name="close" size={18} />
						</Pressable>
					</View>
					<View style={styles.calCard}>
						<View style={styles.calMonthRow}>
							<Text style={styles.calMonthText}>{pickerYear}년 {pickerMonth + 1}월</Text>
							<View style={styles.calArrowGroup}>
								<Pressable hitSlop={12} onPress={prevMonth}>
									<AppIcon color={COLORS.gray500} name="chevron-back" size={16} />
								</Pressable>
								<Pressable hitSlop={12} onPress={nextMonth}>
									<AppIcon color={COLORS.gray500} name="chevron-forward" size={16} />
								</Pressable>
							</View>
						</View>
						<View style={styles.calWeekRow}>
							{DAYS_KO.map((d, i) => (
								<Text key={d} style={[styles.calWeekDay, i === 5 && styles.calWeekDaySat, i === 6 && styles.calWeekDaySun]}>
									{d}
								</Text>
							))}
						</View>
						<View style={styles.calGrid}>
							{weeks.map((week, wi) => (
								<View key={wi} style={styles.calRow}>
									{week.map((d, di) => {
										if (d === null) return <View key={`e-${wi}-${di}`} style={styles.calCell} />;
										const isSat = di === 5;
										const isSun = di === 6;
										const isSelected =
											d === value.getDate() &&
											pickerMonth === value.getMonth() &&
											pickerYear === value.getFullYear();
										return (
											<Pressable key={d} onPress={() => handleSelect(d)} style={styles.calCell}>
												<View style={[styles.calBubble, isSelected && styles.calBubbleSelected]}>
													<Text style={[
														styles.calDateText,
														isSat && !isSelected && styles.calDateTextSat,
														isSun && !isSelected && styles.calDateTextSun,
														isSelected && styles.calDateTextSelected,
													]}>
														{d}
													</Text>
												</View>
											</Pressable>
										);
									})}
								</View>
							))}
						</View>
					</View>
					<Pressable onPress={close} style={styles.submitBtn}>
						<Text style={styles.submitBtnText}>확인</Text>
					</Pressable>
				</Animated.View>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: { backgroundColor: COLORS.overlay, flex: 1, justifyContent: 'flex-end' },
	sheet: {
		backgroundColor: COLORS.background,
		borderTopLeftRadius: RADIUS.modal,
		borderTopRightRadius: RADIUS.modal,
		gap: SPACING.xl,
		paddingBottom: SPACING.jumbo,
		paddingHorizontal: SPACING.xxl,
		paddingTop: SPACING.lg,
		...SHADOWS.modal,
	},
	handle: { alignSelf: 'center', backgroundColor: COLORS.gray300, borderRadius: RADIUS.round, height: 4, marginBottom: SPACING.sm, width: 40 },
	sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	sheetTitle: { color: COLORS.black, fontFamily: 'NotoSansKR_700Bold', fontSize: 17, lineHeight: 26 },
	closeCircleBtn: { alignItems: 'center', backgroundColor: COLORS.gray200, borderRadius: RADIUS.round, height: 32, justifyContent: 'center', width: 32 },
	calCard: { borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
	calMonthRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.lg, paddingHorizontal: SPACING.xs },
	calArrowGroup: { alignItems: 'center', flexDirection: 'row', gap: SPACING.xs },
	calMonthText: { color: COLORS.black, fontFamily: 'NotoSansKR_700Bold', fontSize: 15, lineHeight: 22 },
	calWeekRow: { flexDirection: 'row', marginBottom: SPACING.xxs },
	calWeekDay: { color: COLORS.gray500, flex: 1, fontFamily: 'NotoSansKR_400Regular', fontSize: 11, lineHeight: 18, textAlign: 'center' },
	calWeekDaySat: { color: COLORS.primary },
	calWeekDaySun: { color: COLORS.danger },
	calGrid: { gap: 0 },
	calRow: { flexDirection: 'row' },
	calCell: { alignItems: 'center', flex: 1, paddingVertical: SPACING.xxs + 1 },
	calBubble: { alignItems: 'center', backgroundColor: COLORS.transparent, borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
	calBubbleSelected: { backgroundColor: COLORS.primary },
	calDateText: { color: COLORS.black, fontFamily: 'NotoSansKR_400Regular', fontSize: 13, lineHeight: 20 },
	calDateTextSelected: { color: COLORS.background, fontFamily: 'NotoSansKR_700Bold' },
	calDateTextSat: { color: COLORS.primary },
	calDateTextSun: { color: COLORS.danger },
	submitBtn: { alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: RADIUS.button, marginTop: SPACING.sm, paddingVertical: SPACING.xl + 2 },
	submitBtnText: { color: COLORS.background, fontFamily: 'NotoSansKR_700Bold', fontSize: 15, lineHeight: 22 },
});
