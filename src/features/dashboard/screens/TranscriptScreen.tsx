import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, LAYOUT, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { getRemoteTranscript, getRemoteVisitDetail, type RemoteTranscript } from '@/src/features/dashboard/services/visitApi';
import { usePetStore } from '@/src/features/pet/PetStore';

import { TranscriptMessageBubble } from '../components/TranscriptMessageBubble';

function formatVisitDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatDuration(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

export function TranscriptScreen() {
  const { diagnosisId } = useLocalSearchParams<{ diagnosisId: string }>();
  const { pets } = usePetStore();
  const [transcript, setTranscript] = useState<RemoteTranscript | null>(null);
  const [visitPetId, setVisitPetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer(transcript?.audioUrl ?? null, { updateInterval: 250 });
  const playbackStatus = useAudioPlayerStatus(player);

  const loadTranscript = useCallback(async () => {
    if (!diagnosisId) throw new Error('visit-id-required');
    const [nextTranscript, visit] = await Promise.allSettled([
      getRemoteTranscript(diagnosisId),
      getRemoteVisitDetail(diagnosisId),
    ]);
    if (nextTranscript.status === 'rejected') throw nextTranscript.reason;
    return {
      transcript: nextTranscript.value,
      visitPetId: visit.status === 'fulfilled' ? visit.value.petId : null,
    };
  }, [diagnosisId]);

  const handleRetry = () => {
    if (!diagnosisId) return;
    setIsLoading(true);
    setError(null);
    void loadTranscript()
      .then((result) => {
        setTranscript(result.transcript);
        setVisitPetId(result.visitPetId);
      })
      .catch(() => setError('전사 기록을 불러오지 못했어요.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    if (!diagnosisId) {
      setIsLoading(false);
      setError('진료 기록을 찾을 수 없어요.');
      return () => {
        active = false;
      };
    }
    void loadTranscript()
      .then((result) => {
        if (active) {
          setTranscript(result.transcript);
          setVisitPetId(result.visitPetId);
        }
      })
      .catch(() => {
        if (active) setError('전사 기록을 불러오지 못했어요.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [diagnosisId, loadTranscript]);

  const handlePlaybackPress = useCallback(async () => {
    if (!transcript?.audioUrl) return;
    setPlaybackError(null);
    try {
      if (playbackStatus.playing) {
        player.pause();
        return;
      }
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
      const duration = playbackStatus.duration || transcript.durationSec;
      if (playbackStatus.didJustFinish || (duration > 0 && playbackStatus.currentTime >= duration - 0.25)) {
        await player.seekTo(0);
      }
      player.play();
    } catch {
      setPlaybackError('녹음 파일을 재생하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  }, [playbackStatus, player, transcript]);

  if (isLoading) {
    return (
      <ScreenLayout headerVariant="auth" title="진료 전문 보기">
        <LoadingView label="전사 기록을 불러오고 있어요." />
      </ScreenLayout>
    );
  }

  if (!transcript) {
    return (
      <ScreenLayout headerVariant="auth" title="진료 전문 보기">
        <EmptyState
          actionLabel="다시 시도"
          description={error ?? '전사 기록을 찾을 수 없어요.'}
          onActionPress={handleRetry}
          title="전사 기록을 불러오지 못했어요"
        />
      </ScreenLayout>
    );
  }

  const visitPet = pets.find((pet) => pet.id === visitPetId) ?? null;
  const playbackDuration = playbackStatus.duration > 0 ? playbackStatus.duration : transcript.durationSec;
  const playbackTime = Math.min(Math.max(0, playbackStatus.currentTime), playbackDuration || 0);
  const playbackProgress = playbackDuration > 0 ? Math.min(1, playbackTime / playbackDuration) : 0;

  return (
    <ScreenLayout
      centerContent={
        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={styles.headerTitle}>진료 전문 보기</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>
            {transcript.hospitalName ?? '병원 정보 없음'} · {formatVisitDate(transcript.visitedAt)}
          </Text>
        </View>
      }
      headerVariant="auth"
    >
      <View style={styles.screenBg}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          <View style={styles.dateDividerRow}>
            <View style={styles.dateDividerLine} />
            <Text style={styles.dateDividerText}>{formatVisitDate(transcript.visitedAt)}</Text>
            <View style={styles.dateDividerLine} />
          </View>
          {transcript.turns.map((turn, index) => {
            const isFirstInGroup = index === 0 || transcript.turns[index - 1].speaker !== turn.speaker;
            return (
              <TranscriptMessageBubble
                key={turn.id}
                message={{ id: turn.id, speaker: turn.speaker === 'VET' ? 'vet' : 'owner', text: turn.text }}
                pet={visitPet}
                showAvatar={isFirstInGroup}
                vetAvatarSource={require('@/assets/images/dashboard/VetAvatar.png')}
              />
            );
          })}
        </ScrollView>
        <View style={[styles.audioBar, { paddingBottom: Math.max(insets.bottom, SPACING.xxxl) }]}>
          <View style={styles.audioControls}>
            <Pressable
              accessibilityLabel={playbackStatus.playing ? '녹음 일시정지' : '녹음 재생'}
              accessibilityRole="button"
              disabled={!transcript.audioUrl}
              onPress={() => void handlePlaybackPress()}
              style={({ pressed }) => [
                styles.playButton,
                !transcript.audioUrl && styles.playButtonDisabled,
                pressed && transcript.audioUrl && styles.pressed,
              ]}
            >
              <AppIcon
                color={COLORS.background}
                name={playbackStatus.playing ? 'pause' : 'play'}
                size={20}
              />
            </Pressable>
            <View accessibilityRole="progressbar" style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${playbackProgress * 100}%` }]} />
            </View>
            <Text style={styles.timeText}>
              {transcript.audioUrl
                ? `${formatDuration(playbackTime)} / ${formatDuration(playbackDuration)}`
                : '녹음 파일 없음'}
            </Text>
          </View>
          {playbackError ? <Text accessibilityLiveRegion="polite" style={styles.playbackError}>{playbackError}</Text> : null}
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  headerCenter: { alignItems: 'center' },
  headerTitle: { ...TYPOGRAPHY.button, color: COLORS.black, textAlign: 'center' },
  headerSubtitle: { ...TYPOGRAPHY.small, color: COLORS.gray500, marginTop: -2, textAlign: 'center' },
  content: { flexGrow: 1, gap: SPACING.xxl, paddingBottom: SPACING.xxxl },
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
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.gray200,
    borderTopWidth: 1,
    marginHorizontal: -LAYOUT.screenPaddingHorizontal,
    paddingHorizontal: LAYOUT.screenPaddingHorizontal,
    paddingTop: SPACING.xxl,
  },
  audioControls: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
  playButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  playButtonDisabled: { backgroundColor: COLORS.disabledPrimary },
  pressed: { opacity: 0.78 },
  progressTrack: {
    backgroundColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  progressFill: { backgroundColor: COLORS.primary, height: '100%' },
  timeText: { ...TYPOGRAPHY.caption, color: COLORS.gray600, minWidth: 82, textAlign: 'right' },
  playbackError: { ...TYPOGRAPHY.caption, color: COLORS.error, marginTop: SPACING.md, textAlign: 'center' },
  scrollView: { flex: 1 },
  screenBg: { backgroundColor: COLORS.gray100, flex: 1, marginHorizontal: -LAYOUT.screenPaddingHorizontal, paddingHorizontal: LAYOUT.screenPaddingHorizontal },
});
