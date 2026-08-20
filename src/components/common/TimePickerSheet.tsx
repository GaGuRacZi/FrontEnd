import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from './AppIcon';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/src/constants';

export interface TimeValue {
	hour: number;
	minute: number;
}

interface TimePickerSheetProps {
	visible: boolean;
	value: TimeValue;
	title?: string;
	onClose: () => void;
	onSelect: (time: TimeValue) => void;
}

export function TimePickerSheet({ visible, value, title = '시간 설정', onClose, onSelect }: TimePickerSheetProps) {
	const sheetY = useRef(new Animated.Value(500)).current;
	const valueHour = value.hour;
	const valueMinute = value.minute;
	const [hour, setHour] = useState(valueHour);
	const [minute, setMinute] = useState(valueMinute);

	useEffect(() => {
		if (visible) {
			setHour(valueHour);
			setMinute(valueMinute);
			sheetY.setValue(500);
			Animated.timing(sheetY, { toValue: 0, duration: 300, useNativeDriver: true }).start();
		}
	}, [sheetY, valueHour, valueMinute, visible]);

	const close = () => {
		Animated.timing(sheetY, { toValue: 500, duration: 220, useNativeDriver: true }).start(() => onClose());
	};

	const handleConfirm = () => {
		onSelect({ hour, minute });
		close();
	};

	return (
		<Modal animationType="none" onRequestClose={close} statusBarTranslucent transparent visible={visible}>
			<Pressable onPress={close} style={styles.overlay}>
				<Animated.View onStartShouldSetResponder={() => true} style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
					<View style={styles.handle} />
					<View style={styles.sheetHeader}>
						<Text style={styles.sheetTitle}>{title}</Text>
						<Pressable accessibilityLabel="닫기" accessibilityRole="button" hitSlop={8} onPress={close} style={styles.closeCircleBtn}>
							<AppIcon color={COLORS.gray600} name="close" size={18} />
						</Pressable>
					</View>
					<View style={styles.timePickerWrap}>
						<View style={styles.timePickerCol}>
							<Pressable accessibilityLabel={`시간 올리기, 현재 ${hour}시`} accessibilityRole="button" onPress={() => setHour(h => (h + 1) % 24)} style={styles.timeArrowBtn}>
								<AppIcon color={COLORS.primary} name="chevron-up" size={28} />
							</Pressable>
							<View style={styles.timeValueBox}>
								<Text style={styles.timePickerValue}>{String(hour).padStart(2, '0')}</Text>
							</View>
							<Pressable accessibilityLabel={`시간 내리기, 현재 ${hour}시`} accessibilityRole="button" onPress={() => setHour(h => (h - 1 + 24) % 24)} style={styles.timeArrowBtn}>
								<AppIcon color={COLORS.primary} name="chevron-down" size={28} />
							</Pressable>
							<Text style={styles.timePickerUnit}>시</Text>
						</View>
						<Text style={styles.timeColon}>:</Text>
						<View style={styles.timePickerCol}>
							<Pressable accessibilityLabel={`분 올리기, 현재 ${minute}분`} accessibilityRole="button" onPress={() => setMinute(m => (m + 5) % 60)} style={styles.timeArrowBtn}>
								<AppIcon color={COLORS.primary} name="chevron-up" size={28} />
							</Pressable>
							<View style={styles.timeValueBox}>
								<Text style={styles.timePickerValue}>{String(minute).padStart(2, '0')}</Text>
							</View>
							<Pressable accessibilityLabel={`분 내리기, 현재 ${minute}분`} accessibilityRole="button" onPress={() => setMinute(m => (m - 5 + 60) % 60)} style={styles.timeArrowBtn}>
								<AppIcon color={COLORS.primary} name="chevron-down" size={28} />
							</Pressable>
							<Text style={styles.timePickerUnit}>분</Text>
						</View>
					</View>
					<Pressable accessibilityLabel="확인" accessibilityRole="button" onPress={handleConfirm} style={styles.submitBtn}>
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
	timePickerWrap: { alignItems: 'center', flexDirection: 'row', gap: SPACING.xxl, justifyContent: 'center', paddingVertical: SPACING.xxl },
	timePickerCol: { alignItems: 'center', gap: SPACING.md },
	timeArrowBtn: { alignItems: 'center', justifyContent: 'center', padding: SPACING.sm },
	timeValueBox: { alignItems: 'center', backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, justifyContent: 'center', minWidth: 72, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.lg },
	timePickerValue: { color: COLORS.primary, fontFamily: 'NotoSansKR_700Bold', fontSize: 36, lineHeight: 44 },
	timePickerUnit: { color: COLORS.gray500, fontFamily: 'NotoSansKR_400Regular', fontSize: 13, lineHeight: 20 },
	timeColon: { color: COLORS.black, fontFamily: 'NotoSansKR_700Bold', fontSize: 32, lineHeight: 40, paddingBottom: 24 },
	submitBtn: { alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: RADIUS.button, marginTop: SPACING.sm, paddingVertical: SPACING.xl + 2 },
	submitBtnText: { color: COLORS.background, fontFamily: 'NotoSansKR_700Bold', fontSize: 15, lineHeight: 22 },
});
