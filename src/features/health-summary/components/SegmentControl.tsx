import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS, RADIUS, TYPOGRAPHY } from '@/src/constants';
import { HealthTabType } from '../types';

interface SegmentControlProps {
	activeTab: HealthTabType;
	onChangeTab: (tab: HealthTabType) => void;
}

const TAB_OPTIONS: { label: string; value: HealthTabType }[] = [
	{ label: '체중', value: 'weight' },
	{ label: '산책', value: 'walk' },
	{ label: '의료비', value: 'medical' },
];

const getActiveColor = (tab: HealthTabType) => {
	if (tab === 'weight') return COLORS.primary;
	if (tab === 'walk') return COLORS.success;
	return COLORS.gold;
};

export function SegmentControl({ activeTab, onChangeTab }: SegmentControlProps) {
	return (
		<View style={styles.container}>
			{TAB_OPTIONS.map((opt) => {
				const isActive = activeTab === opt.value;
				const activeColor = getActiveColor(opt.value);

				return (
					<TouchableOpacity
						activeOpacity={0.8}
						key={opt.value}
						onPress={() => onChangeTab(opt.value)}
						style={[
							styles.tab,
							isActive && { backgroundColor: activeColor },
						]}
					>
						<Text
							style={[
								styles.label,
								isActive ? styles.labelActive : styles.labelInactive,
							]}
						>
							{opt.label}
						</Text>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		alignItems: 'center',
		backgroundColor: COLORS.background,
		borderColor: COLORS.gray200,
		borderRadius: RADIUS.round,
		borderWidth: 1,
		flexDirection: 'row',
		height: 48,
		padding: 4,
	},
	tab: {
		alignItems: 'center',
		borderRadius: RADIUS.round,
		flex: 1,
		height: '100%',
		justifyContent: 'center',
	},
	label: {
		...TYPOGRAPHY.body1,
		fontFamily: TYPOGRAPHY.button.fontFamily,
	},
	labelActive: {
		color: COLORS.background,
	},
	labelInactive: {
		color: COLORS.gray600,
	},
});