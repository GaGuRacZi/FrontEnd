import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';

import { RecordingPetAnimation } from '../components/RecordingPetAnimation';
import { AiProcessingScreen } from './AiProcessingScreen';

// TODO: 플랜별 최대 녹음 시간 — 지금은 아기 젤리(10분) 고정, 구독 스토어 연동 후 교체
const MAX_RECORDING_SECONDS = 10 * 60;

function formatTime(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
	const seconds = (totalSeconds % 60).toString().padStart(2, '0');
	return `${minutes}:${seconds}`;
}

export function RecordingScreen() {
	const router = useRouter();
	const [phase, setPhase] = useState<'processing' | 'recording'>('recording');
	const [isPaused, setIsPaused] = useState(false);
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const { selectedPet } = usePetStore();

	useEffect(() => {
		if (phase !== 'recording' || isPaused) return undefined;

		intervalRef.current = setInterval(() => {
			setElapsedSeconds((current) => {
				if (current + 1 >= MAX_RECORDING_SECONDS) {
					setPhase('processing');
					return current;
				}
				return current + 1;
			});
		}, 1000);

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [phase, isPaused]);

	if (!selectedPet) return null;

	if (phase === 'processing') {
		return (
			<AiProcessingScreen onNavigateHome={() => router.replace('/dashboard' as Href)} />
		);
	}

	return (
		<ScreenLayout headerVariant="auth" title="진료 기록">
			<View style={styles.content}>
				<View style={styles.badge}>
					<Text style={styles.badgeText}>아기 젤리 · 최대 10분 녹음</Text>
				</View>

				<Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>

				<RecordingPetAnimation isPaused={isPaused} petType={selectedPet.type} />

				<Text style={styles.description}>
					대화를 자동으로 듣고 있어요{'\n'}
					진료를 잠시 멈추고 싶다면 하단 버튼을 눌러주세요{'\n'}
					진료가 끝나면 아래 완료 버튼을 눌러주세요
				</Text>

				<Pressable
					accessibilityLabel={isPaused ? '녹음 재개' : '녹음 일시정지'}
					accessibilityRole="button"
					onPress={() => setIsPaused((current) => !current)}
					style={({ pressed }) => [styles.pauseButton, pressed && styles.pressed]}
				>
					<AppIcon
						color={COLORS.background}
						name={isPaused ? 'play' : 'pause'}
						size={28}
					/>
				</Pressable>
			</View>

			<Pressable
				accessibilityLabel="진료 완료"
				accessibilityRole="button"
				onPress={() => setPhase('processing')}
				style={({ pressed }) => [styles.completeButton, pressed && styles.pressed]}
			>
				<Text style={styles.completeButtonText}>진료 완료</Text>
			</Pressable>
		</ScreenLayout>
	);
}

const styles = StyleSheet.create({
	content: { alignItems: 'center', flex: 1, gap: SPACING.xxxl, justifyContent: 'center' },
	badge: {
		backgroundColor: COLORS.yellow,
		borderRadius: RADIUS.round,
		paddingHorizontal: SPACING.xl,
		paddingVertical: SPACING.sm,
	},
	badgeText: { ...TYPOGRAPHY.small, color: COLORS.yellowDark },
	timer: { ...TYPOGRAPHY.display, color: COLORS.black },
	description: { ...TYPOGRAPHY.body2, color: COLORS.gray600, textAlign: 'center' },
	pauseButton: {
		alignItems: 'center',
		backgroundColor: COLORS.primary,
		borderRadius: RADIUS.round,
		height: 92,
		justifyContent: 'center',
		width: 92,
	},
	pressed: { opacity: 0.85 },
	completeButton: {
		alignItems: 'center',
		backgroundColor: COLORS.primary,
		borderRadius: RADIUS.button,
		marginBottom: SPACING.xxl,
		paddingVertical: SPACING.xl,
	},
	completeButtonText: { ...TYPOGRAPHY.button, color: COLORS.background },
});