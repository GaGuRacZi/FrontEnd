import { Image, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/src/components/modal';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

type MedicationDetailModalProps = {
	description?: string;
	dosageMetaLabel: string; 
	ingredientLabel?: string; 
	name: string;
	onClose: () => void;
	visible: boolean;
	warningNote?: string; 
};

export function MedicationDetailModal({
	description,
	dosageMetaLabel,
	ingredientLabel,
	name,
	onClose,
	visible,
	warningNote,
}: MedicationDetailModalProps) {
	const warningLines = warningNote?.split('\n').filter(Boolean) ?? [];

	return (
		<AppModal
			onClose={onClose}
			title={ingredientLabel ? `${name} (${ingredientLabel})` : name}
			variant="bottomSheet"
			visible={visible}
		>
			<View style={styles.metaRow}>
				<Image
					resizeMode="contain"
					source={require('@/assets/images/modal/MedicationBadge.png')}
					style={styles.metaIcon}
				/>
				<Text style={styles.metaText}>{dosageMetaLabel}</Text>
			</View>

			<View style={styles.divider} />

			{description ? (
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>약 설명</Text>
					<Text style={styles.descriptionText}>{description}</Text>
				</View>
			) : null}

			{warningLines.length > 0 ? (
				<View style={styles.warningBox}>
					<Text style={styles.warningTitle}>주의할 점</Text>
					{warningLines.map((line) => (
						<Text key={line} style={styles.warningLine}>
							· {line}
						</Text>
					))}
				</View>
			) : null}
		</AppModal>
	);
}

const styles = StyleSheet.create({
	metaRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.sm },
	metaIcon: { height: 14, width: 14 },
	metaText: { ...TYPOGRAPHY.small, color: COLORS.gray600 },
	divider: { backgroundColor: COLORS.gray200, height: 1, marginVertical: SPACING.lg },
	section: { gap: SPACING.sm, marginBottom: SPACING.lg },
	sectionTitle: { ...TYPOGRAPHY.body1, color: COLORS.black },
	descriptionText: { ...TYPOGRAPHY.body2, color: COLORS.gray800 },
	warningBox: {
		backgroundColor: COLORS.errorBackground,
		borderRadius: RADIUS.md,
		gap: SPACING.xs,
		padding: SPACING.lg,
	},
	warningTitle: { ...TYPOGRAPHY.body2, color: COLORS.error, fontFamily: TYPOGRAPHY.button.fontFamily },
	warningLine: { ...TYPOGRAPHY.small, color: COLORS.error },
});