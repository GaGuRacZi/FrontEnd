import { StyleSheet, Text, View } from 'react-native';

import { AppButton, AppIcon } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

type AiSummaryCardProps = {
	onGenerate: () => void;
	summary?: string;
};

export function AiSummaryCard({ onGenerate, summary }: AiSummaryCardProps) {
	return (
		<View style={styles.wrap}>
			<View style={styles.headerRow}>
				<View style={styles.iconBadge}>
					<AppIcon color={COLORS.primary} name="sparkles" size={16} />
				</View>
				<View style={styles.headerTextGroup}>
					<Text style={styles.headerTitle}>AI 진료 요약</Text>
					<Text style={styles.headerSubtitle}>AI가 진료 내용을 요약해드려요</Text>
				</View>
			</View>

			{summary ? (
				<>
					<View style={styles.divider} />
					<Text style={styles.summaryText}>{summary}</Text>
				</>
			) : (
				<AppButton
					leftIcon={<AppIcon color={COLORS.background} name="sparkles" size={16} />}
					onPress={onGenerate}
					title="AI 요약 생성하기"
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: SPACING.lg },
	headerRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
	iconBadge: {
		alignItems: 'center',
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.round,
		height: 32,
		justifyContent: 'center',
		width: 32,
	},
	headerTextGroup: { gap: 2 },
	headerTitle: {
		...TYPOGRAPHY.body1,
		color: COLORS.black,
		fontFamily: TYPOGRAPHY.button.fontFamily,
	},
	headerSubtitle: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	divider: { backgroundColor: COLORS.gray200, height: 1 },
	summaryText: { ...TYPOGRAPHY.body2, color: COLORS.gray800 },
});