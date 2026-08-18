import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import type { AppIconName } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { PetAvatar } from '@/src/features/pet/components/PetAvatar';
import type { PetEntity } from '@/src/features/pet/types';

type DiagnosisHeroCardProps = {
	actionIcon?: AppIconName;
	actionLabel: string;
	onPressAction: () => void;
	pet: PetEntity;
	subtitle: string;
	title: string;
	topLabel?: string;
};

export function DiagnosisHeroCard({
	actionIcon = 'mic-outline',
	actionLabel,
	onPressAction,
	pet,
	subtitle,
	title,
	topLabel,
}: DiagnosisHeroCardProps) {
	return (
		<View style={styles.card}>
			<View pointerEvents="none" style={[styles.decoCircle, styles.decoCircleLarge]} />
			<View pointerEvents="none" style={[styles.decoCircle, styles.decoCircleSmall]} />


			<View style={styles.profileRow}>
				<PetAvatar pet={pet} size={68} />
				<View>
					{topLabel ? <Text style={styles.topLabel}>{topLabel}</Text> : null}
					<Text style={styles.title}>{title}</Text>
					<Text style={styles.subtitle}>{subtitle}</Text>
				</View>
			</View>

			<Pressable
				accessibilityLabel={actionLabel}
				accessibilityRole="button"
				onPress={onPressAction}
				style={({ pressed }) => [styles.recordButton, pressed && styles.pressed]}
			>
				<AppIcon color={COLORS.background} name={actionIcon} size={18} />
				<Text style={styles.recordButtonText}>{actionLabel}</Text>
			</Pressable>
		</View>
	);
}

export function calculatePetAgeLabel(birthDateRaw: string): string {
	const normalized = birthDateRaw.replace(/\./g, '-').replace(/-$/, '');
	const birthDate = new Date(normalized);

	if (Number.isNaN(birthDate.getTime())) return '';

	const now = new Date();
	let years = now.getFullYear() - birthDate.getFullYear();
	let months = now.getMonth() - birthDate.getMonth();

	if (now.getDate() < birthDate.getDate()) months -= 1;
	if (months < 0) {
		years -= 1;
		months += 12;
	}

	if (years <= 0) return `${months}개월`;
	return months > 0 ? `${years}살 ${months}개월` : `${years}살`;
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: COLORS.primary,
		borderRadius: RADIUS.lg,
		gap: SPACING.xxl,
		overflow: 'hidden',
		padding: SPACING.xxl,
	},
	topLabel: { ...TYPOGRAPHY.caption, color: COLORS.white70, paddingBottom: 3 },
	decoCircle: {
		backgroundColor: COLORS.white10,
		borderRadius: RADIUS.round,
		position: 'absolute',
	},
	decoCircleLarge: { height: 120, width: 120, right: 4, top: -30 },
	decoCircleSmall: { width: 90, height: 90, right: 40, bottom: -44 },
	profileRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.xl },
	title: { ...TYPOGRAPHY.title2, color: COLORS.background },
	subtitle: { ...TYPOGRAPHY.caption, color: COLORS.white70 },
	recordButton: {
		alignItems: 'center',
		alignSelf: 'flex-start',
		backgroundColor: COLORS.white20,
		borderColor: COLORS.white30,
		borderRadius: RADIUS.round,
		borderWidth: 1.5,
		flexDirection: 'row',
		gap: SPACING.sm,
		paddingHorizontal: SPACING.xxl,
		paddingVertical: SPACING.md,
		zIndex: 1,
	},
	pressed: { opacity: 0.85 },
	recordButtonText: { ...TYPOGRAPHY.checkboxLabel, color: COLORS.background },
});