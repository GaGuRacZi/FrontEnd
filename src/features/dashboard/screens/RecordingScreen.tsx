import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type RecordingOptions,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { useAppAlert } from '@/src/components/modal';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useMedicationStore } from '@/src/features/home/MedicationStore';
import { usePetStore } from '@/src/features/pet/PetStore';

import { RecordingPetAnimation } from '../components/RecordingPetAnimation';
import { createRemoteVisit } from '../services/visitApi';
import { AiProcessingScreen } from './AiProcessingScreen';

const MAX_RECORDING_SECONDS = 10 * 60;
const AAC_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.aac',
  sampleRate: 44100,
  numberOfChannels: 2,
  bitRate: 256000,
  android: {
    extension: '.aac',
    outputFormat: 'aac_adts',
    audioEncoder: 'aac',
  },
  ios: {
    extension: '.aac',
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MAX,
  },
  web: {
    mimeType: 'audio/aac',
    bitsPerSecond: 256000,
  },
};

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function RecordingScreen() {
  const router = useRouter();
  const showAlert = useAppAlert();
  const { hasLoadError, isReady, reloadPets, selectedPet } = usePetStore();
  const { reloadMedications } = useMedicationStore();
  const recorder = useAudioRecorder(AAC_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 1000);
  const [processingVisitId, setProcessingVisitId] = useState<string | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const startingRef = useRef(false);
<<<<<<< HEAD
  const automaticCompletionRef = useRef(false);
  // 컴포넌트가 unmount됐는지 추적 — 뒤로가기 후 setState 방지
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
=======
>>>>>>> f85efe416e2c5b1127f2e79139e3939d4016e5a9

  const startRecording = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    if (isMountedRef.current) setErrorMessage(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!mountedRef.current) return;
      if (!permission.granted) {
        if (isMountedRef.current) setErrorMessage('마이크 권한을 허용하면 진료 내용을 녹음할 수 있어요.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (!mountedRef.current) return;
      await recorder.prepareToRecordAsync();
      if (!mountedRef.current) return;
      recorder.record({ forDuration: MAX_RECORDING_SECONDS });
      if (isMountedRef.current) setHasRecording(true);
    } catch {
<<<<<<< HEAD
      if (isMountedRef.current) setErrorMessage('녹음을 시작하지 못했어요. 잠시 후 다시 시도해주세요.');
=======
      if (mountedRef.current) {
        setErrorMessage('녹음을 시작하지 못했어요. 잠시 후 다시 시도해주세요.');
      }
>>>>>>> f85efe416e2c5b1127f2e79139e3939d4016e5a9
    } finally {
      startingRef.current = false;
    }
  }, [recorder]);

  const completeRecording = useCallback(async () => {
    if (!selectedPet || isUploading) return;
    if (!hasRecording) {
      if (isMountedRef.current) setErrorMessage('진료 내용을 녹음한 뒤 완료할 수 있어요.');
      return;
    }
    if (isMountedRef.current) {
      setIsUploading(true);
      setErrorMessage(null);
    }
    try {
      await recorder.stop();
      if (!mountedRef.current) return;
      if (!recorder.uri) throw new Error('recording-uri-required');

      // wavToMp3 패키지 없이 AAC 그대로 업로드 (Android도 AAC 사용)
      // 패키지 설치 후 아래 주석 해제
      // const audioUri = Platform.OS === 'android'
      //   ? await wavToMp3.convertAac(
      //       recorder.uri,
      //       recorder.uri.replace(/\.aac$/, '.mp3'),
      //       { bitrate: 256, quality: 2 },
      //     )
      //   : recorder.uri;
      const audioUri = recorder.uri;

      const visit = await createRemoteVisit(
        selectedPet.id,
        audioUri.startsWith('/') ? `file://${audioUri}` : audioUri,
      );
      if (!mountedRef.current) return;
      reloadMedications();
      if (isMountedRef.current) setProcessingVisitId(visit.id);
    } catch {
<<<<<<< HEAD
      if (isMountedRef.current) setErrorMessage('진료 기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      if (isMountedRef.current) setIsUploading(false);
=======
      if (mountedRef.current) {
        setHasRecording(false);
        setErrorMessage('진료 기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      if (mountedRef.current) setIsUploading(false);
>>>>>>> f85efe416e2c5b1127f2e79139e3939d4016e5a9
    }
  }, [
    hasRecording,
    isUploading,
    recorder,
    reloadMedications,
    selectedPet,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
<<<<<<< HEAD
      // expo-audio가 unmount 시 recorder를 내부적으로 release하므로
      // try-catch로 감싸 "already released" 크래시 방지
      try {
        if (recorder.isRecording) void recorder.stop().catch(() => undefined);
      } catch {
        // 이미 해제된 경우 무시
      }
=======
      mountedRef.current = false;
>>>>>>> f85efe416e2c5b1127f2e79139e3939d4016e5a9
    };
  }, []);

  if (!isReady) {
    return <ScreenLayout headerVariant="auth" title="진료 기록"><LoadingView label="반려동물 정보를 불러오고 있어요." /></ScreenLayout>;
  }

  if (!selectedPet) {
    return (
      <ScreenLayout headerVariant="auth" title="진료 기록">
        <EmptyState
          actionLabel={hasLoadError ? '다시 시도' : '반려동물 등록'}
          description={hasLoadError ? '네트워크 상태를 확인한 뒤 다시 불러와주세요.' : '진료 기록을 시작하려면 반려동물을 먼저 등록해주세요.'}
          onActionPress={hasLoadError ? reloadPets : () => router.push('/pet/add' as Href)}
          title={hasLoadError ? '반려동물 정보를 불러오지 못했어요' : '등록된 반려동물이 없어요'}
        />
      </ScreenLayout>
    );
  }

  if (processingVisitId) {
    return (
      <AiProcessingScreen
        onNavigateHome={() => router.replace('/dashboard' as Href)}
        onVisitSettled={reloadMedications}
        visitId={processingVisitId}
      />
    );
  }

  const elapsedSeconds = Math.min(
    MAX_RECORDING_SECONDS,
    Math.floor(recorderState.durationMillis / 1000),
  );
  const isPaused = hasRecording && !recorderState.isRecording;
  const recordingControlLabel = !hasRecording
    ? '녹음 시작'
    : isPaused
      ? '녹음 재개'
      : '녹음 일시정지';
  const toggleRecording = () => {
    if (isUploading) return;
    try {
      if (recorderState.isRecording) {
        recorder.pause();
        return;
      }
      if (hasRecording) {
        recorder.record({ forDuration: Math.max(1, MAX_RECORDING_SECONDS - elapsedSeconds) });
        return;
      }
      showAlert(
        '음성을 인식하시겠습니까?',
        '확인을 누르면 진료 내용 녹음을 시작합니다.',
        [
          { text: '아니오', style: 'cancel' },
          { text: '예', onPress: () => void startRecording() },
        ],
      );
    } catch {
      setHasRecording(false);
      setErrorMessage('녹음을 다시 시작하지 못했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <ScreenLayout headerVariant="auth" title="진료 기록">
      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{selectedPet.name} · 최대 10분 녹음</Text>
        </View>

        <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>

        <RecordingPetAnimation isAnimating={recorderState.isRecording} petType={selectedPet.type} />

        <Text style={styles.description}>
          {!hasRecording
            ? '재생 버튼을 눌러 진료 내용 녹음을 시작해주세요.'
            : isPaused
              ? `녹음이 일시정지되었어요.${'\n'}계속 녹음하거나 진료 완료 버튼을 눌러주세요.`
              : `대화를 듣고 있어요.${'\n'}진료를 잠시 멈추려면 하단 버튼을 눌러주세요.${'\n'}진료가 끝나면 진료 완료 버튼을 눌러주세요.`}
        </Text>

        <Pressable
          accessibilityLabel={recordingControlLabel}
          accessibilityRole="button"
          disabled={isUploading}
          onPress={toggleRecording}
          style={({ pressed }) => [styles.pauseButton, isUploading && styles.disabled, pressed && styles.pressed]}
        >
          <AppIcon color={COLORS.background} name={recorderState.isRecording ? 'pause' : 'play'} size={28} />
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
