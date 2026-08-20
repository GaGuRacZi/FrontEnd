import { Href, useRouter } from 'expo-router';
import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppIcon, AppButton } from '@/src/components/common';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { RecordingPetAnimation } from '@/src/features/dashboard/components/RecordingPetAnimation';
import { usePetStore } from '@/src/features/pet/PetStore';

export function WalkTrackingScreen() {
	const router = useRouter();
	const { selectedPet } = usePetStore();
	const isNavigating = useRef(false);
	const [seconds, setSeconds] = useState(0);
	const [isPaused, setIsPaused] = useState(false);

	const [startInfo] = useState(() => {
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth() + 1;
		const day = now.getDate();
		return {
			dateString: `${year}년 ${month}월 ${day}일`,
			formattedDate: `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`,
			startTimeString: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
		};
	});
	const { dateString, formattedDate, startTimeString } = startInfo;

	useEffect(() => {
		if (isPaused) return;
		const timer = setInterval(() => {
			setSeconds((prev) => prev + 1);
		}, 1000);
		return () => clearInterval(timer);
	}, [isPaused]);

	const formatTimer = (totalSec: number) => {
		const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
		const s = String(totalSec % 60).padStart(2, '0');
		return `${m} : ${s}`;
	};

	const handleFinishWalk = () => {
		if (isNavigating.current) return;
		isNavigating.current = true;
		setIsPaused(true);

		const durationText = seconds < 60 ? '1분 미만' : `${Math.floor(seconds / 60)}분`;

		router.replace({
			pathname: '/health-summary/walk-record',
			params: {
				date: formattedDate,
				startTime: startTimeString,
				duration: durationText,
			},
		} as Href);
	};

	return (
		<AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
			<TopHeader
				leftAccessibilityLabel="뒤로가기"
				leftIcon="chevron-back"
				onLeftPress={() => router.back()}
				title="산책 기록하기"
			/>

			<View style={styles.content}>
				<Text style={styles.timerText}>{formatTimer(seconds)}</Text>

				<RecordingPetAnimation isPaused={isPaused} petType={selectedPet?.type ?? 'dog'} />

				<View style={styles.infoBadgeRow}>
					<View style={styles.tagBox}>
						<View style={styles.tagLabelBg}>
							<Text style={styles.tagLabelText}>날짜</Text>
						</View>
						<Text style={styles.tagValueText}>{dateString}</Text>
					</View>
					<View style={styles.tagBox}>
						<View style={styles.tagLabelBg}>
							<Text style={styles.tagLabelText}>시작 시간</Text>
						</View>
						<Text style={styles.tagValueText}>{startTimeString}</Text>
					</View>
				</View>

				<TouchableOpacity
					activeOpacity={0.8}
					onPress={() => setIsPaused((prev) => !prev)}
					style={styles.pauseCircleButton}
				>
					<AppIcon
						color={COLORS.background}
						name={isPaused ? 'play' : 'pause'}
						size={36}
					/>
				</TouchableOpacity>
			</View>

			<View style={styles.bottomBar}>
				<AppButton
					onPress={handleFinishWalk}
					style={{ backgroundColor: COLORS.success }}
					title="산책 종료"
				/>
			</View>
		</AppScreen>
	);
}

const styles = StyleSheet.create({
	content: {
		alignItems: 'center',
		flex: 1,
		gap: SPACING.xxxl,
		justifyContent: 'center',
	},
	timerText: {
		...TYPOGRAPHY.title1,
		color: COLORS.black,
		fontFamily: TYPOGRAPHY.button.fontFamily,
		fontSize: 42,
		lineHeight: 52,
	},
	infoBadgeRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: SPACING.md,
	},
	tagBox: {
		alignItems: 'center',
		backgroundColor: COLORS.background,
		borderColor: COLORS.gray200,
		borderRadius: RADIUS.round,
		borderWidth: 1,
		flexDirection: 'row',
		height: 34,
        width: 180,
	},
	tagLabelBg: {
		alignItems: 'center',
		backgroundColor: COLORS.success,
		borderRadius: RADIUS.round,
		height: 32,
        width: 80,
		justifyContent: 'center',
		marginRight: 2,
		paddingHorizontal: SPACING.xxl,
	},
	tagLabelText: {
		...TYPOGRAPHY.small,
		color: COLORS.background,
		fontFamily: TYPOGRAPHY.button.fontFamily,
		fontSize: 12,
	},
	tagValueText: {
		...TYPOGRAPHY.small,
		color: COLORS.black,
		fontFamily: TYPOGRAPHY.button.fontFamily,
		flex: 1,
		textAlign: 'center',
	},
	pauseCircleButton: {
		alignItems: 'center',
		backgroundColor: COLORS.success,
		borderRadius: 40,
		height: 80,
		justifyContent: 'center',
		width: 80,
	},
	bottomBar: {
		paddingTop: SPACING.md,
		paddingBottom: SPACING.md,
		backgroundColor: COLORS.background,
	},
});