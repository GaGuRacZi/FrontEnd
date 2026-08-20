import { Href, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton, LoadingView } from '@/src/components/common';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { RecordingPetAnimation } from '@/src/features/dashboard/components/RecordingPetAnimation';
import { usePetStore } from '@/src/features/pet/PetStore';

import { getActiveWalk, startWalk } from '../services/healthSummaryApi';

export function WalkTrackingScreen() {
	const router = useRouter();
	const { selectedPet } = usePetStore();
	const isNavigating = useRef(false);
	const [seconds, setSeconds] = useState(0);
	const [startInfo, setStartInfo] = useState<{ formattedDate: string; startTimeString: string } | null>(null);
	const [loadError, setLoadError] = useState(false);

	useEffect(() => {
		if (!selectedPet) return;
		let active = true;
		void (async () => {
			try {
				const walk = await getActiveWalk(selectedPet.id) ?? await startWalk(selectedPet.id);
				if (!active) return;
				setStartInfo({ formattedDate: walk.date, startTimeString: walk.startTime });
				const startedAt = Date.parse(walk.startedAt);
				setSeconds(Number.isNaN(startedAt) ? 0 : Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
			} catch {
				if (active) setLoadError(true);
			}
		})();
		return () => {
			active = false;
		};
	}, [selectedPet]);

	useEffect(() => {
		if (!startInfo) return;
		const timer = setInterval(() => {
			setSeconds((prev) => prev + 1);
		}, 1000);
		return () => clearInterval(timer);
	}, [startInfo]);

	const formatTimer = (totalSec: number) => {
		const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
		const s = String(totalSec % 60).padStart(2, '0');
		return `${m} : ${s}`;
	};

	const handleFinishWalk = () => {
		if (isNavigating.current || !startInfo) return;
		isNavigating.current = true;

		router.replace({
			pathname: '/health-summary/walk-record',
			params: {
				automatic: 'true',
				date: startInfo.formattedDate,
				durationSeconds: String(seconds),
				startTime: startInfo.startTimeString,
			},
		} as unknown as Href);
	};

	if (!startInfo) {
		return (
			<AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
				<TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="산책 기록하기" />
				<View style={styles.loadingContent}>
					<LoadingView label={loadError ? '산책 기록을 시작하지 못했어요.' : '산책 기록을 시작하고 있어요.'} />
				</View>
			</AppScreen>
		);
	}

	const [year, month, day] = startInfo.formattedDate.split('.').map(Number);
	const dateString = `${year}년 ${month}월 ${day}일`;

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

				<RecordingPetAnimation isPaused={false} petType={selectedPet?.type ?? 'dog'} />

				<View style={styles.infoBadgeRow}>
					<View style={styles.tagBox}>
						<View style={styles.tagLabelBg}>
							<Text numberOfLines={1} style={styles.tagLabelText}>날짜</Text>
						</View>
						<Text style={styles.tagValueText}>{dateString}</Text>
					</View>
					<View style={styles.tagBox}>
						<View style={styles.tagLabelBg}>
							<Text numberOfLines={1} style={styles.tagLabelText}>시작 시간</Text>
						</View>
						<Text style={styles.tagValueText}>{startInfo.startTimeString}</Text>
					</View>
				</View>
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
		paddingHorizontal: SPACING.xl,
	},
	tagBox: {
		alignItems: 'center',
		backgroundColor: COLORS.background,
		borderColor: COLORS.gray200,
		borderRadius: RADIUS.round,
		borderWidth: 1,
		flexDirection: 'row',
		height: 34,
		flex: 1,
		minWidth: 0,
	},
	tagLabelBg: {
		alignItems: 'center',
		backgroundColor: COLORS.success,
		borderRadius: RADIUS.round,
		height: 32,
		width: 64,
		justifyContent: 'center',
		marginRight: 2,
		paddingHorizontal: 0,
	},
	tagLabelText: {
		...TYPOGRAPHY.small,
		color: COLORS.background,
		fontFamily: TYPOGRAPHY.button.fontFamily,
		fontSize: 11,
	},
	tagValueText: {
		...TYPOGRAPHY.small,
		color: COLORS.black,
		fontFamily: TYPOGRAPHY.button.fontFamily,
		flex: 1,
		textAlign: 'center',
	},
	loadingContent: { flex: 1, justifyContent: 'center' },
	bottomBar: {
		paddingTop: SPACING.md,
		paddingBottom: SPACING.md,
		backgroundColor: COLORS.background,
	},
});
