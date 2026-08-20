import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingView } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, SPACING, TYPOGRAPHY, LAYOUT } from '@/src/constants';
import { getRemoteTranscript, type RemoteTranscript } from '@/src/features/dashboard/services/visitApi';
import { usePetStore } from '@/src/features/pet/PetStore';

import { TranscriptMessageBubble } from '../components/TranscriptMessageBubble';

function formatVisitDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function TranscriptScreen() {
  const { diagnosisId } = useLocalSearchParams<{ diagnosisId: string }>();
  const { selectedPet } = usePetStore();
  const [transcript, setTranscript] = useState<RemoteTranscript | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = () => {
    if (!diagnosisId) return;
    setIsLoading(true);
    setError(null);
    void getRemoteTranscript(diagnosisId)
      .then(setTranscript)
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
    void getRemoteTranscript(diagnosisId)
      .then((value) => {
        if (active) setTranscript(value);
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
  }, [diagnosisId]);

  if (!selectedPet) return null;

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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
                pet={selectedPet}
                showAvatar={isFirstInGroup}
                vetAvatarSource={require('@/assets/images/dashboard/VetAvatar.png')}
              />
            );
          })}
        </ScrollView>
        <Text style={styles.duration}>{`녹음 길이 ${formatDuration(transcript.durationSec)}`}</Text>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  headerCenter: { alignItems: 'center' },
  headerTitle: { ...TYPOGRAPHY.button, color: COLORS.black, textAlign: 'center' },
  headerSubtitle: { ...TYPOGRAPHY.small, color: COLORS.gray500, marginTop: -2, textAlign: 'center' },
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
  duration: { ...TYPOGRAPHY.small, color: COLORS.gray500, paddingTop: SPACING.lg, textAlign: 'center' },
  screenBg: { backgroundColor: COLORS.gray100, flex: 1, marginHorizontal: -LAYOUT.screenPaddingHorizontal, paddingHorizontal: LAYOUT.screenPaddingHorizontal },
});
