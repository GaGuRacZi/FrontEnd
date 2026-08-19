import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

type AiProcessingScreenProps = {
	onNavigateHome: () => void;
};

export function AiProcessingScreen({ onNavigateHome }: AiProcessingScreenProps) {
	return (
		<View style={styles.container}>
			<View style={styles.centerWrap}>
				<View style={styles.center}>
					<ActivityIndicator color={COLORS.primary} size="large" />
					<Text style={styles.title}>AI가 진료 내용을 요약하고 있어요</Text>
					<Text style={styles.description}>
						요약하는 데 시간이 필요해요{'\n'}
						홈으로 이동할까요?{'\n'}
						완료되면 알림을 보내 드릴게요
					</Text>
				</View>
			</View>

			<Pressable
				accessibilityLabel="홈으로 이동"
				accessibilityRole="button"
				onPress={onNavigateHome}
				style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]}
			>
				<Text style={styles.homeButtonText}>홈으로</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		backgroundColor: COLORS.background,
		flex: 1,
		paddingHorizontal: SPACING.xxxl,
		paddingTop: SPACING.xxxl,
	},
	centerWrap: { alignItems: 'center', flex: 1, justifyContent: 'center' },
	center: { alignItems: 'center', gap: SPACING.xxl },
	title: { ...TYPOGRAPHY.title3, color: COLORS.black, textAlign: 'center' },
	description: { ...TYPOGRAPHY.body2, color: COLORS.gray600, textAlign: 'center' },
	homeButton: {
		alignItems: 'center',
		backgroundColor: COLORS.primary,
		borderRadius: RADIUS.button,
		marginBottom: SPACING.xxl,
		paddingVertical: SPACING.xl,
	},
	pressed: { opacity: 0.85 },
	homeButtonText: { ...TYPOGRAPHY.button, color: COLORS.background },
});
