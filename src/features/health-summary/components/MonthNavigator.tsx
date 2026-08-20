import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

interface MonthNavigatorProps {
	year: number;
	month: number;
	onPrevMonth: () => void;
	onNextMonth: () => void;
	onAddPress?: () => void;
	showAddButton?: boolean;
}

export function MonthNavigator({
	year,
	month,
	onPrevMonth,
	onNextMonth,
	onAddPress,
	showAddButton = false,
}: MonthNavigatorProps) {
	return (
		<View style={styles.container}>
			<Text style={styles.monthText}>{`${year}년 ${month}월`}</Text>
			<View style={styles.actionsRow}>
				{showAddButton ? (
					<TouchableOpacity
						activeOpacity={0.7}
						onPress={onAddPress}
						style={styles.addCircleButton}
					>
						<AppIcon color={COLORS.background} name="add" size={20} />
					</TouchableOpacity>
				) : null}
				<TouchableOpacity activeOpacity={0.7} onPress={onPrevMonth} style={styles.circleButton}>
					<AppIcon color={COLORS.gray600} name="chevron-back" size={18} />
				</TouchableOpacity>
				<TouchableOpacity activeOpacity={0.7} onPress={onNextMonth} style={styles.circleButton}>
					<AppIcon color={COLORS.gray600} name="chevron-forward" size={18} />
				</TouchableOpacity>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: SPACING.md,
	},
	monthText: {
		...TYPOGRAPHY.title2,
		color: COLORS.black,
	},
	actionsRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: SPACING.sm,
	},
	circleButton: {
		alignItems: 'center',
		borderColor: COLORS.gray200,
		borderRadius: RADIUS.round,
		borderWidth: 1,
		height: 32,
		justifyContent: 'center',
		width: 32,
	},
	addCircleButton: {
		alignItems: 'center',
		backgroundColor: COLORS.success,
		borderRadius: RADIUS.round,
		height: 32,
		justifyContent: 'center',
		width: 32,
	},
});