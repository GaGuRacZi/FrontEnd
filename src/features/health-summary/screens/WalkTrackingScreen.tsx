import * as Location from 'expo-location';
import { Href, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppButton, AppIcon } from '@/src/components/common';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { RecordingPetAnimation } from '@/src/features/dashboard/components/RecordingPetAnimation';
import { usePetStore } from '@/src/features/pet/PetStore';
import { calcDistanceKm, type RoutePoint } from '../services/walkService';
import { startWalk } from '../services/healthSummaryApi';

export function WalkTrackingScreen() {
  const router = useRouter();
  const { selectedPet } = usePetStore();

  const isNavigating = useRef(false);
  const isPausedRef = useRef(false);
  const routePointsRef = useRef<RoutePoint[]>([]);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const [startInfo] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth() + 1;
    const d = now.getDate();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return {
      dateLabel: `${y}년 ${mo}월 ${d}일`,
      formattedDate: `${y}.${String(mo).padStart(2, '0')}.${String(d).padStart(2, '0')}`,
      startTimeStr: `${hh}:${mm}`,
    };
  });

  // ── 타이머 ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isPaused]);

  // isPaused를 ref에 동기화
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // ── 위치 구독 정리 헬퍼 ─────────────────────────────────────────────────────
  const stopLocationTracking = useCallback(() => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
  }, []);

  // ── 산책 시작 초기화 ─────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function init() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;

      if (status === 'granted') {
        try {
          // watchPositionAsync: OS 레벨 연속 위치 수신 (setInterval보다 안정적)
          const subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5_000,      // 최소 5초 간격
              distanceInterval: 5,      // 최소 5m 이동 시 업데이트
            },
            (loc) => {
              if (!isPausedRef.current) {
                routePointsRef.current.push({
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude,
                });
              }
            },
          );
          if (mounted) {
            locationSubscriptionRef.current = subscription;
          } else {
            subscription.remove();
          }
        } catch {
          // 위치 수집 실패 — 거리는 수동 입력 가능
        }
      } else {
        Alert.alert(
          '위치 권한 필요',
          'GPS 산책 기록을 위해 설정에서 위치 권한을 허용해주세요.\n거리는 수동으로 입력할 수 있어요.',
        );
      }

      // 자동기록 시작 API — 실패해도 로컬 타이머는 계속 진행
      if (selectedPet) {
        try {
          await startWalk(selectedPet.id);
        } catch {
          // 네트워크 오류 등 — 타이머만 로컬 진행
        }
      }
    }

    void init();

    return () => {
      mounted = false;
      stopLocationTracking();
    };
  }, [selectedPet, stopLocationTracking]);

  // ── 산책 종료 ────────────────────────────────────────────────────────────────
  const handleFinishWalk = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    setIsPaused(true);
    stopLocationTracking();

    const walkingAmount = calcDistanceKm(routePointsRef.current);
    const durationText =
      seconds < 60 ? '1분 미만' : `${Math.floor(seconds / 60)}분`;

    router.replace({
      pathname: '/health-summary/walk-record',
      params: {
        date: startInfo.formattedDate,
        startTime: startInfo.startTimeStr,
        duration: durationText,
        walkingAmount: String(walkingAmount),
        isAutoTracking: 'true',
      },
    } as unknown as Href);
  };

  const formatTimer = (totalSec: number) => {
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m} : ${s}`;
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
            <Text style={styles.tagValueText}>{startInfo.dateLabel}</Text>
          </View>
          <View style={styles.tagBox}>
            <View style={styles.tagLabelBg}>
              <Text style={styles.tagLabelText}>시작 시간</Text>
            </View>
            <Text style={styles.tagValueText}>{startInfo.startTimeStr}</Text>
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
    justifyContent: 'center',
    marginRight: 2,
    paddingHorizontal: SPACING.xxl,
    width: 80,
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
    backgroundColor: COLORS.background,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.md,
  },
});
