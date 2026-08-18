import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { AppModal } from './AppModal';
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
		<AppModal onClose={onClose} variant="bottomSheet" visible={visible}>
			<View style={styles.header}>
				<Text style={styles.title}>
					{ingredientLabel ? `${name} (${ingredientLabel})` : name}
				</Text>
				<Pressable
					accessibilityLabel="닫기"
					accessibilityRole="button"
					onPress={onClose}
					style={styles.closeButton}
				>
					<AppIcon color={COLORS.gray600} name="close" size={20} />
				</Pressable>
			</View>

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
				<View style={styles.warningSection}>
					<Text style={styles.warningTitle}>주의할 점</Text>
					<View style={styles.warningBox}>
						{warningLines.map((line, index) => (
							<Text key={`${line}-${index}`} style={styles.warningLine}>
								· {line}
							</Text>
						))}
					</View>
				</View>
			) : null}
		</AppModal>
	);
}

const styles = StyleSheet.create({
	header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	title: { ...TYPOGRAPHY.title3, color: COLORS.black, flex: 1 },
	closeButton: {
		alignItems: 'center',
		backgroundColor: COLORS.gray100,
		borderRadius: RADIUS.round,
		height: 32,
		justifyContent: 'center',
		width: 32,
	},
	metaRow: {
		alignItems: 'center',
		alignSelf: 'flex-start',
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.round,
		flexDirection: 'row',
		gap: SPACING.xs,
		marginTop: -4,
		paddingHorizontal: SPACING.lg,
		paddingVertical: SPACING.xs,
	},
	metaIcon: { height: 14, tintColor: COLORS.primary, width: 14 },
	metaText: { ...TYPOGRAPHY.small, color: COLORS.primary },
	divider: { backgroundColor: COLORS.gray200, height: 1, marginVertical: SPACING.lg },
	section: { gap: SPACING.sm, marginBottom: SPACING.lg },
	sectionTitle: { ...TYPOGRAPHY.segmentActive, color: COLORS.black },
	descriptionText: { ...TYPOGRAPHY.body2, color: COLORS.gray800 },
	warningSection: { gap: SPACING.sm },
	warningTitle: { ...TYPOGRAPHY.segmentActive, color: COLORS.black },
	warningBox: {
		backgroundColor: COLORS.errorBackground,
		borderRadius: RADIUS.lg,
		gap: SPACING.xs,
		padding: SPACING.lg,
	},
	warningLine: { ...TYPOGRAPHY.body2, color: COLORS.error },
});
