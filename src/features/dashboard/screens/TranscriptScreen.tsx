import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY, LAYOUT } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';

import { TranscriptMessageBubble } from '../components/TranscriptMessageBubble';
import { MOCK_DIAGNOSIS_DETAIL } from '../mock';

export function TranscriptScreen() {
	const { diagnosisId } = useLocalSearchParams<{ diagnosisId: string }>();
	const { selectedPet } = usePetStore();
	const detail = diagnosisId ? MOCK_DIAGNOSIS_DETAIL[diagnosisId] : undefined;
	const [isPlaying, setIsPlaying] = useState(false);

	if (!selectedPet) return null;

	if (!detail || !detail.transcript) {
		return (
			<ScreenLayout headerVariant="auth" title="진료 전문 보기">
				<View style={styles.emptyState}>
					<Text style={styles.emptyText}>전사 기록을 찾을 수 없어요.</Text>
				</View>
			</ScreenLayout>
		);
	}

	return (
			<ScreenLayout
				centerContent={
					<View style={styles.headerCenter}>
						<Text numberOfLines={1} style={styles.headerTitle}>
							진료 전문 보기
						</Text>
						<Text numberOfLines={1} style={styles.headerSubtitle}>
							{detail.hospitalName} · {detail.date}
						</Text>
					</View>
				}
				headerVariant="auth"
			>
				<View style={styles.screenBg}>
					<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
						{detail.transcriptRecordedAt ? (
							<View style={styles.dateDividerRow}>
								<View style={styles.dateDividerLine} />
								<Text style={styles.dateDividerText}>{detail.transcriptRecordedAt}</Text>
								<View style={styles.dateDividerLine} />
							</View>
						) : null}

						{detail.transcript.map((message, index) => {
							const isFirstInGroup =
								index === 0 || detail.transcript![index - 1].speaker !== message.speaker;
							return (
								<TranscriptMessageBubble
									key={message.id}
									message={message}
									pet={selectedPet}
									showAvatar={isFirstInGroup}
									vetAvatarSource={require('@/assets/images/dashboard/VetAvatar.png')}
								/>
							);
						})}
					</ScrollView>

					<View style={styles.audioBar}>
						<Pressable
							accessibilityLabel={isPlaying ? '일시정지' : '재생'}
							accessibilityRole="button"
							onPress={() => setIsPlaying((current) => !current)}
							style={styles.playButton}
						>
							<AppIcon color={COLORS.background} name={isPlaying ? 'pause' : 'play'} size={18} />
						</Pressable>
						<View style={styles.progressTrack}>
							<View style={styles.progressTrackLine} />
							<View style={styles.progressThumb} />
						</View>
						<Text style={styles.timeText}>00:00 / {detail.transcriptDuration ?? '00:00'}</Text>
					</View>
				</View>
			</ScreenLayout>
		);
	}
const styles = StyleSheet.create({
	emptyState: { alignItems: 'center', flex: 1, justifyContent: 'center' },
	emptyText: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
	headerCenter: { alignItems: 'center' },
	headerTitle: { ...TYPOGRAPHY.button, color: COLORS.black, textAlign: 'center' },
	headerSubtitle: { ...TYPOGRAPHY.small, color: COLORS.gray500, textAlign: 'center', marginTop: -2 },
	content: { gap: SPACING.xxl, paddingBottom: SPACING.xxl },
	dateDividerRow: {
		alignItems: 'center',
		flexDirection: 'row',
		gap: SPACING.md,
		marginBottom: SPACING.md,
		marginTop: SPACING.lg,
	},
	dateDividerLine: { backgroundColor: COLORS.gray300, flex: 1, height: 1 },
	dateDividerText: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	audioBar: {
		alignItems: 'center',
		backgroundColor: COLORS.background,
		borderTopColor: COLORS.gray200,
		borderTopWidth: 1,
		flexDirection: 'row',
		gap: SPACING.md,
		marginHorizontal: -LAYOUT.screenPaddingHorizontal,
		paddingHorizontal: LAYOUT.screenPaddingHorizontal,
		paddingTop: SPACING.xxl,
	},
	playButton: {
		alignItems: 'center',
		backgroundColor: COLORS.primary,
		borderRadius: RADIUS.round,
		height: 36,
		justifyContent: 'center',
		width: 36,
	},
	progressTrack: {
		alignItems: 'center',
		flex: 1,
		height: 20,
		justifyContent: 'center',
	},
	progressTrackLine: {
		backgroundColor: COLORS.gray300,
		borderRadius: RADIUS.round,
		height: 3,
		width: '100%',
	},
	progressThumb: {
		backgroundColor: COLORS.primary,
		borderRadius: RADIUS.round,
		height: 10,
		left: 0,
		position: 'absolute',
		width: 10,
	},
	timeText: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	screenBg: { backgroundColor: COLORS.gray100, flex: 1, marginHorizontal: -LAYOUT.screenPaddingHorizontal, paddingHorizontal: LAYOUT.screenPaddingHorizontal, },
});
