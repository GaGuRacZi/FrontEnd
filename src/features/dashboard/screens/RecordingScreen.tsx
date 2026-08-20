import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useMedicationStore } from '@/src/features/home/MedicationStore';
import { usePetStore } from '@/src/features/pet/PetStore';

import { RecordingPetAnimation } from '../components/RecordingPetAnimation';
import { createRemoteVisit } from '../services/visitApi';
import { AiProcessingScreen } from './AiProcessingScreen';

const MAX_RECORDING_SECONDS = 10 * 60;

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function RecordingScreen() {
  const router = useRouter();
  const { selectedPet } = usePetStore();
  const { reloadMedications } = useMedicationStore();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 1000);
  const [phase, setPhase] = useState<'processing' | 'recording'>('recording');
  const [hasRecording, setHasRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startingRef = useRef(false);
  const automaticCompletionRef = useRef(false);

  const startRecording = useCallback(async () => {
    if (startingRef.current || recorder.isRecording) return;
    startingRef.current = true;
    setErrorMessage(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('마이크 권한을 허용하면 진료 내용을 녹음할 수 있어요.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: MAX_RECORDING_SECONDS });
      setHasRecording(true);
    } catch {
      setErrorMessage('녹음을 시작하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      startingRef.current = false;
    }
  }, [recorder]);

  const completeRecording = useCallback(async () => {
    if (!selectedPet || isUploading) return;
    if (!hasRecording) {
      setErrorMessage('진료 내용을 녹음한 뒤 완료할 수 있어요.');
      return;
    }
    setIsUploading(true);
    setErrorMessage(null);
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error('recording-uri-required');
      await createRemoteVisit(selectedPet.id, recorder.uri);
      reloadMedications();
      setPhase('processing');
    } catch {
      setErrorMessage('진료 기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsUploading(false);
    }
  }, [hasRecording, isUploading, recorder, reloadMedications, selectedPet]);

  useEffect(() => {
    void startRecording();
    return () => {
      if (recorder.isRecording) void recorder.stop().catch(() => undefined);
    };
  }, [recorder, startRecording]);

  useEffect(() => {
    if (
      recorderState.durationMillis >= MAX_RECORDING_SECONDS * 1000 &&
      !automaticCompletionRef.current
    ) {
      automaticCompletionRef.current = true;
      void completeRecording();
    }
  }, [completeRecording, recorderState.durationMillis]);

  if (!selectedPet) return null;

  if (phase === 'processing') {
    return <AiProcessingScreen onNavigateHome={() => router.replace('/dashboard' as Href)} />;
  }

  const elapsedSeconds = Math.min(
    MAX_RECORDING_SECONDS,
    Math.floor(recorderState.durationMillis / 1000),
  );
  const isPaused = hasRecording && !recorderState.isRecording;
  const toggleRecording = () => {
    if (isUploading) return;
    if (recorderState.isRecording) {
      recorder.pause();
      return;
    }
    if (hasRecording) {
      recorder.record({ forDuration: Math.max(1, MAX_RECORDING_SECONDS - elapsedSeconds) });
      return;
    }
    void startRecording();
  };

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
          disabled={isUploading}
          onPress={toggleRecording}
          style={({ pressed }) => [styles.pauseButton, isUploading && styles.disabled, pressed && styles.pressed]}
        >
          <AppIcon color={COLORS.background} name={isPaused ? 'play' : 'pause'} size={28} />
        </Pressable>
        {errorMessage ? <Text accessibilityLiveRegion="polite" style={styles.error}>{errorMessage}</Text> : null}
      </View>

      <Pressable
        accessibilityLabel="진료 완료"
        accessibilityRole="button"
        disabled={isUploading}
        onPress={() => void completeRecording()}
        style={({ pressed }) => [styles.completeButton, isUploading && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={styles.completeButtonText}>{isUploading ? '저장 중...' : '진료 완료'}</Text>
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
  error: { ...TYPOGRAPHY.caption, color: COLORS.error, textAlign: 'center' },
  disabled: { opacity: 0.55 },
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
