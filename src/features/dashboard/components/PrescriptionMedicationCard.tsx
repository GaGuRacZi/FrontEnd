import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

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
				<View style={styles.metaChip}>
					<View style={styles.metaDot} />
					<Text style={styles.metaChipText}>{medication.doseLabel}</Text>
				</View>
				<View style={styles.metaChip}>
					<View style={styles.metaDot} />
					<Text style={styles.metaChipText}>{medication.mealTimingLabel}</Text>
				</View>			
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

			{medication.warningNote ? (
				<View style={styles.warningBanner}>
					<AppIcon color={COLORS.alert} name="alert-circle-outline" size={16} />
					<Text style={styles.warningText}>{medication.warningNote}</Text>
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: COLORS.background,
		borderColor: COLORS.gray200,
		borderRadius: RADIUS.lg,
		borderWidth: 1,
		gap: SPACING.md,
		padding: SPACING.xxl,
	},
	headerRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
	indexBadge: {
		alignItems: 'center',
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.sm,
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
		paddingHorizontal: SPACING.lg,
		paddingVertical: SPACING.xs,
	},
	frequencyPillText: { ...TYPOGRAPHY.checkboxLabel, color: COLORS.primary },
	divider: { backgroundColor: COLORS.gray200, height: 1 },
	metaRow: { flexDirection: 'row', gap: SPACING.xl },
	metaChip: {
		alignItems: 'center',
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.sm,
		flexDirection: 'row',
		gap: SPACING.xs,
		paddingHorizontal: SPACING.md,
		paddingVertical: SPACING.xs,
	},
	metaDot: { backgroundColor: COLORS.primary, borderRadius: 3, height: 6, width: 6 },
	metaChipText: { ...TYPOGRAPHY.small, color: COLORS.black },
	timingRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.xs },
	timingChip: {
		backgroundColor: COLORS.gray100,
		borderRadius: RADIUS.sm,
		paddingHorizontal: SPACING.md,
		paddingVertical: SPACING.xs,
	},
	timingChipActive: { backgroundColor: COLORS.primary },
	timingChipText: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	timingChipTextActive: { color: COLORS.background },
	warningBanner: {
		alignItems: 'center',
		backgroundColor: COLORS.alertBackground,
		borderRadius: RADIUS.md,
		flexDirection: 'row',
		gap: SPACING.sm,
		padding: SPACING.lg,
	},
	warningText: { ...TYPOGRAPHY.small, color: COLORS.alert },
});