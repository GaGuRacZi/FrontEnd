import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { DiagnosisListItem } from '../types';

type DiagnosisListCardProps = {
	diagnosis: DiagnosisListItem;
	onPress: () => void;
	petName: string;
};

const STATUS_LABEL: Record<DiagnosisListItem['status'], string> = {
	completed: '완료',
	failed: '처리 실패',
	summarizing: '요약 생성 중',
};

export function DiagnosisListCard({ diagnosis, onPress, petName }: DiagnosisListCardProps) {
	const isCompleted = diagnosis.status === 'completed';
	const isFailed = diagnosis.status === 'failed';

	return (
		<Pressable
			accessibilityLabel={
				isCompleted
					? `${petName} ${diagnosis.diagnosisTitle} 진료 요약 보기`
					: `${petName} ${diagnosis.diagnosisTitle} 진료 요약 상태 확인`
			}
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => [styles.card, pressed && styles.pressed]}
		>
			<View style={styles.topRow}>
				<Text style={styles.date}>{diagnosis.date}</Text>
				<View
					style={[
						styles.badge,
						isCompleted ? styles.badgeCompleted : styles.badgeSummarizing,
						isFailed && styles.badgeFailed,
					]}
				>
					<Text
						style={[
							styles.badgeText,
						isCompleted ? styles.badgeTextCompleted : styles.badgeTextSummarizing,
						isFailed && styles.badgeTextFailed,
						]}
					>
						{STATUS_LABEL[diagnosis.status]}
					</Text>
				</View>
			</View>

			<Text style={styles.title}>
				{petName} · {diagnosis.diagnosisTitle}
			</Text>

			{diagnosis.summaryNote ? (
				<Text style={styles.summaryNote}>{diagnosis.summaryNote}</Text>
			) : null}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: COLORS.background,
		borderColor: COLORS.gray200,
		borderRadius: RADIUS.lg,
		borderWidth: 1,
		gap: SPACING.xs,
		padding: SPACING.xxl,
	},
	pressed: { opacity: 0.85 },
	topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	date: { ...TYPOGRAPHY.button, color: COLORS.gray500 },
	badge: {
		borderRadius: RADIUS.round,
		paddingHorizontal: SPACING.lg,
		paddingVertical: SPACING.xs,
	},
	badgeCompleted: { backgroundColor: COLORS.yellow },
	badgeSummarizing: { backgroundColor: COLORS.primary },
	badgeFailed: { backgroundColor: COLORS.alertBackground },
	badgeText: { ...TYPOGRAPHY.badge },
	badgeTextCompleted: { color: COLORS.black },
	badgeTextSummarizing: { color: COLORS.black },
	badgeTextFailed: { color: COLORS.alert },
	title: {
		...TYPOGRAPHY.segment,
		color: COLORS.black,
	},
	summaryNote: { ...TYPOGRAPHY.badge, color: COLORS.gray600 },
});
