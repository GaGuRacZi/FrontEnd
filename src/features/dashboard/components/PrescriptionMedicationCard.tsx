import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { BulletItem } from './DiagnosisSectionCard';
import type { DiagnosisMedication, DiagnosisMedicationTiming } from '../types';

type PrescriptionMedicationCardProps = {
	index: number;
	medication: DiagnosisMedication;
};

const TIMING_LABEL: Record<DiagnosisMedicationTiming, string> = {
	morning: '아침',
	lunch: '점심',
	dinner: '저녁',
	bedtime: '취침전',
};
const TIMING_ORDER: DiagnosisMedicationTiming[] = ['morning', 'lunch', 'dinner', 'bedtime'];

export function PrescriptionMedicationCard({ index, medication }: PrescriptionMedicationCardProps) {
	return (
		<View style={styles.card}>
			<View style={styles.headerRow}>
				<View style={styles.indexBadge}>
					<Text style={styles.indexBadgeText}>{index + 1}</Text>
				</View>
				<View style={styles.nameGroup}>
					<Text style={styles.name}>{medication.name}</Text>
					<Text style={styles.dosage}>{medication.dosageLabel}</Text>
				</View>
				<View style={styles.frequencyPill}>
					<Text style={styles.frequencyPillText}>{medication.frequencyLabel}</Text>
				</View>
			</View>

			<View style={styles.divider} />

			<View style={styles.metaRow}>
				<BulletItem text={medication.doseLabel} />
				<BulletItem text={medication.mealTimingLabel} />
			</View>

			<View style={styles.timingRow}>
				<AppIcon color={COLORS.gray500} name="time-outline" size={16} />
				{TIMING_ORDER.map((timing) => {
					const active = medication.timings.includes(timing);
					return (
						<View
							key={timing}
							style={[styles.timingChip, active && styles.timingChipActive]}
						>
							<Text
								style={[
									styles.timingChipText,
									active && styles.timingChipTextActive,
								]}
							>
								{TIMING_LABEL[timing]}
							</Text>
						</View>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	card: { gap: SPACING.md },
	headerRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
	indexBadge: {
		alignItems: 'center',
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.round,
		height: 24,
		justifyContent: 'center',
		width: 24,
	},
	indexBadgeText: {
		...TYPOGRAPHY.small,
		color: COLORS.primary,
		fontFamily: TYPOGRAPHY.button.fontFamily,
	},
	nameGroup: { flex: 1, gap: 2 },
	name: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	dosage: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	frequencyPill: {
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.round,
		paddingHorizontal: SPACING.md,
		paddingVertical: SPACING.xxs,
	},
	frequencyPillText: { ...TYPOGRAPHY.small, color: COLORS.primary },
	divider: { backgroundColor: COLORS.gray200, height: 1 },
	metaRow: { flexDirection: 'row', gap: SPACING.xl },
	timingRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.xs },
	timingChip: {
		backgroundColor: COLORS.gray100,
		borderRadius: RADIUS.round,
		paddingHorizontal: SPACING.md,
		paddingVertical: SPACING.xxs,
	},
	timingChipActive: { backgroundColor: COLORS.primary },
	timingChipText: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	timingChipTextActive: { color: COLORS.background },
});