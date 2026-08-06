import { Image, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common';
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
					<Image
						resizeMode="contain"
						source={require('@/assets/images/dashboard/AISummary.png')}
						style={styles.iconImage}
					/>
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
					leftIcon={
						<Image
							resizeMode="contain"
							source={require('@/assets/images/dashboard/AISummary.png')}
							style={styles.iconImageWhite}
						/>
					}
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
	iconImage: { height: 16, width: 16 },
	iconImageWhite: { height: 16, width: 16, tintColor: COLORS.background },
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