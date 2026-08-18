import { Image, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

type AiSummaryCardProps = {
	onGenerate: () => void;
	summary?: string;
};

export const PLACEHOLDER_SUMMARY =
	'아리(말티즈, 11세 7개월)는 이번 진료에서 퇴행성 관절염으로 진단되었습니다.\n\n' +
	'주요 소견으로는 앞다리 파행, 관절 촉진 시 통증 반응, X-ray상 관절 간격 협소가 확인되었습니다. 11세 고령견에서 자주 나타나는 상태로 완치보다는 지속적인 통증 관리가 핵심입니다. \n\n' +
	'처방된 카미녹스(소염진통제)는 염증과 통증을 줄이고, 가리유니(글루코사민)는 연골 보호를 돕습니다. 두 약 모두 식후 복용이 중요합니다. \n\n' +
	'생활 관리로는 미끄러운 바닥을 피하고, 짧은 산책과 수중 재활을 병행하는 것이 효과적입니다. 4주 후 재방문 시 약물 반응을 확인할 예정이며, 증상 악화나 식욕 저하 시 즉시 내원하는 것을 권장합니다.';

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

			<View style={styles.divider} />
			<View style={styles.summaryBox}>
				<Text style={[styles.summaryText, !summary && styles.summaryTextBlurred]}>
					{summary ?? PLACEHOLDER_SUMMARY}
				</Text>
			</View>

			{!summary ? (
				<>
					<Text style={styles.hintText}>버튼을 눌러 AI 요약을 확인하세요</Text>
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
				</>
			) : null}
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
	summaryBox: {
		backgroundColor: COLORS.summarycontainer,
		borderColor: COLORS.summarycontainerborder,
		borderRadius: RADIUS.md,
		borderWidth: 1,
		padding: SPACING.xl,
	},
	summaryText: { ...TYPOGRAPHY.body2, color: COLORS.gray800 },
	summaryTextBlurred: { opacity: 0.45 },
	hintText: { ...TYPOGRAPHY.small, color: COLORS.gray500, textAlign: 'center' },
});
