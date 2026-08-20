import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { getRemoteVisitDetail, type RemoteVisitStatus } from '@/src/features/dashboard/services/visitApi';

type AiProcessingScreenProps = {
	onNavigateHome: () => void;
	onVisitSettled: () => void;
	visitId: string;
};

const POLL_INTERVAL_MS = 5000;

export function AiProcessingScreen({ onNavigateHome, onVisitSettled, visitId }: AiProcessingScreenProps) {
	const insets = useSafeAreaInsets();
	const [status, setStatus] = useState<RemoteVisitStatus>('PROCESSING');

	useEffect(() => {
		let active = true;
		let timeout: ReturnType<typeof setTimeout> | null = null;

		const poll = () => {
			void getRemoteVisitDetail(visitId)
				.then((visit) => {
					if (!active) return;
					setStatus(visit.status);
					if (visit.status !== 'PROCESSING') {
						onVisitSettled();
						return;
					}
					timeout = setTimeout(poll, POLL_INTERVAL_MS);
				})
				.catch(() => {
					if (active) timeout = setTimeout(poll, POLL_INTERVAL_MS);
				});
		};

		poll();

		return () => {
			active = false;
			if (timeout) clearTimeout(timeout);
		};
	}, [onVisitSettled, visitId]);

	const isFailed = status === 'FAILED';
	const isReady = status === 'READY';
	const title = isFailed
		? '진료 요약을 완료하지 못했어요'
		: isReady
			? '진료 요약이 준비됐어요'
			: 'AI가 진료 내용을 요약하고 있어요';
	const description = isFailed
		? '잠시 후 진료 요약에서 다시 확인해주세요'
		: isReady
			? '홈으로 이동해 진료 요약을 확인해주세요'
			: '요약하는 데 시간이 필요해요\n홈으로 이동할까요?\n완료되면 알림을 보내 드릴게요';

	return (
		<View style={[styles.container, { paddingBottom: insets.bottom + SPACING.xxxl }]}>
			<View style={styles.centerWrap}>
				<View style={styles.center}>
					{!isReady && !isFailed ? <ActivityIndicator color={COLORS.primary} size="large" /> : null}
					<Text style={styles.title}>{title}</Text>
					<Text style={styles.description}>{description}</Text>
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
		paddingVertical: SPACING.xl,
	},
	pressed: { opacity: 0.85 },
	homeButtonText: { ...TYPOGRAPHY.button, color: COLORS.background },
});
