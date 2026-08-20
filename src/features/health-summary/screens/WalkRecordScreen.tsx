import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppButton, AppIcon, DatePickerSheet, TimePickerSheet } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { AppModal } from '@/src/components/modal';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';

import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { type WalkType, type WeatherType, createWalk, deleteWalk, finishWalk, getWalk, updateWalk } from '../services/walkService';

// ─── 날씨 옵션 — API 스펙 기준 ────────────────────────────────────────────────
const WEATHER_OPTIONS: WeatherType[] = ['맑음', '흐림', '비', '눈', '바람'];

function parseTemperature(value: string) {
  const normalized = value.replace(',', '.').replace(/[^0-9.-]/g, '');
  const decimalIndex = normalized.indexOf('.');
  const withoutExtraDecimals =
    decimalIndex === -1
      ? normalized
      : `${normalized.slice(0, decimalIndex + 1)}${normalized
          .slice(decimalIndex + 1)
          .replace(/\./g, '')}`;
  return withoutExtraDecimals.slice(0, 5);
}

function isTemperature(value: string) {
  const temperature = Number(value);
  return value.trim() !== '' && Number.isFinite(temperature) && temperature >= -50 && temperature <= 60;
}

function parseDistance(value: string) {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
  const decimalIndex = normalized.indexOf('.');
  const cleaned =
    decimalIndex === -1
      ? normalized
      : `${normalized.slice(0, decimalIndex + 1)}${normalized
          .slice(decimalIndex + 1)
          .replace(/\./g, '')}`;
  // 소수점 1자리까지
  const parts = cleaned.split('.');
  return parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 1)}` : cleaned;
}

export function WalkRecordScreen() {
  const router = useRouter();
  const isSaving = useRef(false);
  const { selectedPet } = usePetStore();

  const params = useLocalSearchParams<{
    date?: string;
    duration?: string;
    isAutoTracking?: string;
    walkId?: string;
    walkingAmount?: string;
    startTime?: string;
  }>();

  // ── 모드 판별 ────────────────────────────────────────────────────────────────
  const isAutoTracking = params.isAutoTracking === 'true';
  const existingWalkId = params.walkId ? Number(params.walkId) : null;
  const isViewMode = existingWalkId != null && !isAutoTracking;

  const [isEditing, setIsEditing] = useState(!isViewMode);

  // ── 기존 기록 로드 (뷰 모드) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isViewMode || !existingWalkId) return;
    let cancelled = false;

    getWalk(existingWalkId)
      .then((record) => {
        if (cancelled) return;

        setDistanceKm(record.walkingAmount);
        if (record.weatherType) setWeatherText(record.weatherType);
        setIntensity(record.walkType);
        if (record.temp != null) setTemperatureText(String(record.temp));
        setUrination(record.isUrine ?? false);
        setDefecation(record.isStool ?? false);

        // startTime으로 날짜·시작시간 파싱 (서버 UTC → 로컬 KST로 표시)
        const start = new Date(record.startTime + 'Z');
        if (!isNaN(start.getTime())) {
          setRecordedAt(start);
          setStartHour(start.getHours());
          setStartMinute(start.getMinutes());
        }

        // endTime으로 종료시간 파싱 (서버 UTC → 로컬 KST로 표시)
        if (record.endTime) {
          const end = new Date(record.endTime + 'Z');
          if (!isNaN(end.getTime())) {
            setEndHour(end.getHours());
            setEndMinute(end.getMinutes());
          }
        }
      })
      .catch(() => {
        // 로드 실패 — 빈 상태 유지
      });

    return () => {
      cancelled = true;
    };
  }, [existingWalkId, isViewMode]);

  // ── 거리 ────────────────────────────────────────────────────────────────────
  const [distanceKm, setDistanceKm] = useState<number>(() => {
    if (params.walkingAmount) return Number(params.walkingAmount);
    return 0;
  });
  const [distanceModalVisible, setDistanceModalVisible] = useState(false);
  const [distanceDraft, setDistanceDraft] = useState('');

  // ── 날씨 ────────────────────────────────────────────────────────────────────
  const [weatherText, setWeatherText] = useState<WeatherType | null>(null);
  const [temperatureText, setTemperatureText] = useState('');
  const [weatherModalVisible, setWeatherModalVisible] = useState(false);
  const [weatherDraft, setWeatherDraft] = useState<WeatherType | null>(null);
  const [temperatureDraft, setTemperatureDraft] = useState('');

  // ── 강도 ────────────────────────────────────────────────────────────────────
  const [intensity, setIntensity] = useState<WalkType>('보통');

  // ── 배변 ────────────────────────────────────────────────────────────────────
  const [urination, setUrination] = useState(true);
  const [defecation, setDefecation] = useState(true);
  const [specialNote, setSpecialNote] = useState(false);

  // ── 날짜 / 시간 (수동 기록용) ─────────────────────────────────────────────────
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const formatDate = (date: Date) =>
    `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

  const parseParamDate = (dateStr?: string): Date => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('.').map(Number);
    const parsed = new Date(y, (m || 1) - 1, d || 1);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const [recordedAt, setRecordedAt] = useState<Date>(() => parseParamDate(params.date));
  const displayDate = formatDate(recordedAt);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const parseTimeStr = (timeStr?: string, fallbackH = 18, fallbackM = 0) => {
    if (!timeStr) return { hour: fallbackH, minute: fallbackM };
    const [h, m] = timeStr.split(':').map(Number);
    return { hour: isNaN(h) ? fallbackH : h, minute: isNaN(m) ? fallbackM : m };
  };

  const parseDurationMinutes = (durationStr: string) => {
    if (durationStr.includes('미만')) return 1;
    const numericOnly = durationStr.replace(/[^0-9]/g, '');
    return numericOnly ? Number(numericOnly) : 45;
  };

  const initialDuration = parseDurationMinutes(params.duration || '45');
  const initialStart = parseTimeStr(params.startTime);
  const initialEndTotal = initialStart.hour * 60 + initialStart.minute + initialDuration;

  const [startHour, setStartHour] = useState(initialStart.hour);
  const [startMinute, setStartMinute] = useState(initialStart.minute);
  const [endHour, setEndHour] = useState(Math.floor(initialEndTotal / 60) % 24);
  const [endMinute, setEndMinute] = useState(initialEndTotal % 60);
  const [timePickerTarget, setTimePickerTarget] = useState<'start' | 'end'>('start');
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  const startTimeStr = `${pad2(startHour)}:${pad2(startMinute)}`;
  const endTimeStr = `${pad2(endHour)}:${pad2(endMinute)}`;
  const startTotalMin = startHour * 60 + startMinute;
  const endTotalMin = endHour * 60 + endMinute;
  const totalMinutes =
    endTotalMin > startTotalMin
      ? endTotalMin - startTotalMin
      : endTotalMin < startTotalMin
      ? 24 * 60 - startTotalMin + endTotalMin
      : 0;
  const displayTotalTime =
    totalMinutes === 0
      ? '-'
      : totalMinutes < 60
      ? `${totalMinutes}분`
      : `${Math.floor(totalMinutes / 60)}시간${totalMinutes % 60 > 0 ? ` ${totalMinutes % 60}분` : ''}`;

  // ── 강도 옵션 ────────────────────────────────────────────────────────────────
  const intensityOptions: { key: WalkType; label: string }[] = [
    { key: '느긋', label: '느긋' },
    { key: '보통', label: '보통' },
    { key: '활발', label: '활발' },
  ];

  // ── 날씨 라벨 ────────────────────────────────────────────────────────────────
  const weatherLabel =
    weatherText && isTemperature(temperatureText)
      ? `${weatherText} · ${temperatureText}°C`
      : '날씨를 등록해주세요';

  // ── 저장 ────────────────────────────────────────────────────────────────────
  const handleSaveRecord = async () => {
    if (isSaving.current) return;
    if (!selectedPet) {
      Alert.alert('반려동물 선택 필요', '산책을 기록할 반려동물을 먼저 선택해주세요.');
      return;
    }
    if (!weatherText || !isTemperature(temperatureText)) {
      Alert.alert('날씨를 확인해주세요', '날씨와 기온을 입력해주세요.');
      return;
    }
    if (!isAutoTracking && totalMinutes === 0) {
      Alert.alert('입력 오류', '시작 시간과 종료 시간이 같아요. 올바른 시간을 입력해주세요.');
      return;
    }

    isSaving.current = true;

    try {
      if (isAutoTracking) {
        // 자동기록 종료 API — 실패 시 createWalk로 폴백
        let finishSuccess = false;
        try {
          await finishWalk({
            petId: Number(selectedPet.id),
            walkingAmount: distanceKm,
            weatherType: weatherText,
            temp: Number(temperatureText),
            walkType: intensity,
            isUrine: urination,
            isStool: defecation,
          });
          finishSuccess = true;
        } catch {
          // finishWalk 실패(진행 중인 산책 없음, 시간 오류 등) — createWalk 폴백
        }

        if (!finishSuccess) {
          // UTC 기준으로 시간 포맷 — 서버가 naive datetime을 UTC로 파싱하므로
          const fmtUtc = (d: Date) =>
            `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
          const endDt = new Date(Date.now() - 15 * 60_000);
          const startDt = new Date(endDt.getTime() - Math.max(totalMinutes, 1) * 60_000);
          // walkDate는 사용자 로컬(KST) 기준 날짜, startTime/endTime은 UTC로 전송
          const fallbackDateStr = `${startDt.getFullYear()}-${pad2(startDt.getMonth() + 1)}-${pad2(startDt.getDate())}`;
          await createWalk({
            petId: Number(selectedPet.id),
            walkDate: fallbackDateStr,
            walkingAmount: distanceKm,
            weatherType: weatherText,
            temp: Number(temperatureText),
            walkType: intensity,
            startTime: fmtUtc(startDt),
            endTime: fmtUtc(endDt),
            isUrine: urination,
            isStool: defecation,
          });
        }
      } else if (isViewMode && existingWalkId != null) {
        // 기존 기록 수정 API
        await updateWalk(existingWalkId, {
          walkingAmount: distanceKm,
          weatherType: weatherText,
          temp: Number(temperatureText),
          walkType: intensity,
          isUrine: urination,
          isStool: defecation,
        });
      } else {
        // 수동 기록 저장 API
        const dateStr = `${recordedAt.getFullYear()}-${pad2(recordedAt.getMonth() + 1)}-${pad2(recordedAt.getDate())}`;
        await createWalk({
          petId: Number(selectedPet.id),
          walkDate: dateStr,
          walkingAmount: distanceKm,
          weatherType: weatherText,
          temp: Number(temperatureText),
          walkType: intensity,
          startTime: `${dateStr}T${startTimeStr}:00`,
          endTime: `${dateStr}T${endTimeStr}:00`,
          isUrine: urination,
          isStool: defecation,
        });
      }

      router.replace({
        pathname: '/health-summary',
        params: { tab: 'walk' },
      } as Href);
    } catch (err) {
      const apiMessage = err instanceof Error ? err.message : '다시 시도해주세요.';
      Alert.alert('저장 실패', apiMessage);
      isSaving.current = false;
    }
  };

  // ── 삭제 ────────────────────────────────────────────────────────────────────
  const handleDeleteRecord = () => {
    if (!existingWalkId) return;
    Alert.alert('산책 기록을 삭제할까요?', '삭제한 기록은 되돌릴 수 없어요.', [
      { style: 'cancel', text: '취소' },
      {
        style: 'destructive',
        text: '삭제',
        onPress: async () => {
          try {
            await deleteWalk(existingWalkId);
            router.replace({ pathname: '/health-summary', params: { tab: 'walk' } } as Href);
          } catch {
            Alert.alert('삭제 실패', '다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  // ── 렌더 ────────────────────────────────────────────────────────────────────
  return (
    <>
      <AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
        <TopHeader
          leftAccessibilityLabel="뒤로가기"
          leftIcon="chevron-back"
          onLeftPress={() => router.back()}
          title="산책 기록하기"
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {/* 날짜 / 날씨 */}
          <View style={styles.rowTwoCards}>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!isEditing || isAutoTracking}
              onPress={() => setDatePickerVisible(true)}
              style={styles.metaCard}
            >
              <Image
                resizeMode="contain"
                source={HEALTH_SUMMARY_IMAGES.icons.calendar}
                style={styles.metaIcon}
              />
              <View style={styles.metaTextGroup}>
                <Text style={styles.metaLabel}>산책 날짜</Text>
                <Text style={styles.metaValue}>{displayDate}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!isEditing}
              onPress={() => {
                if (!isEditing) return;
                setWeatherDraft(weatherText);
                setTemperatureDraft(temperatureText);
                setWeatherModalVisible(true);
              }}
              style={styles.metaCard}
            >
              <View style={styles.metaTextGroup}>
                <Text style={styles.metaLabel}>날씨</Text>
                <Text
                  style={[
                    styles.metaValue,
                    (!weatherText || !isTemperature(temperatureText)) && styles.placeholderText,
                  ]}
                >
                  {weatherLabel}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 산책 시간 */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>산책 시간</Text>
            <View style={styles.timeGrid}>
              {isAutoTracking ? (
                <View style={styles.timeCol}>
                  <Text style={styles.timeLabel}>시작</Text>
                  <Text style={styles.timeValue}>{startTimeStr}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!isEditing}
                  onPress={() => {
                    setTimePickerTarget('start');
                    setTimePickerVisible(true);
                  }}
                  style={styles.timeCol}
                >
                  <Text style={styles.timeLabel}>시작</Text>
                  <Text style={styles.timeValue}>{startTimeStr}</Text>
                </TouchableOpacity>
              )}
              {isAutoTracking ? (
                <View style={styles.timeCol}>
                  <Text style={styles.timeLabel}>종료</Text>
                  <Text style={styles.timeValue}>{endTimeStr}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!isEditing}
                  onPress={() => {
                    setTimePickerTarget('end');
                    setTimePickerVisible(true);
                  }}
                  style={styles.timeCol}
                >
                  <Text style={styles.timeLabel}>종료</Text>
                  <Text style={styles.timeValue}>{endTimeStr}</Text>
                </TouchableOpacity>
              )}
              <View style={styles.timeCol}>
                <Text style={styles.timeLabel}>총 시간</Text>
                <Text style={styles.timeValue}>{displayTotalTime}</Text>
              </View>
            </View>
          </View>

          {/* ── 산책 거리 카드 — 우측 아이콘 제거, 일렬 정렬 ─────────────────── */}
          <TouchableOpacity
            activeOpacity={isEditing ? 0.8 : 1}
            disabled={!isEditing}
            onPress={() => {
              if (isEditing) {
                setDistanceDraft(distanceKm > 0 ? String(distanceKm) : '');
                setDistanceModalVisible(true);
              }
            }}
            style={styles.distanceCard}
          >
            <View style={styles.distanceBadge}>
              <Image
                resizeMode="contain"
                source={HEALTH_SUMMARY_IMAGES.icons.pin}
                style={styles.distanceBadgeIcon}
              />
            </View>
            <Text style={styles.distanceLabel}>산책 거리</Text>
            <Text
              style={[
                styles.distanceValue,
                distanceKm === 0 && styles.distancePlaceholder,
              ]}
            >
              {distanceKm > 0 ? `${distanceKm}km` : '거리 입력'}
            </Text>
            {isEditing && (
              <AppIcon color={COLORS.gray500} name="chevron-forward" size={16} />
            )}
          </TouchableOpacity>

          {/* 산책 강도 */}
          <View style={[styles.card, styles.intensityCard]}>
            <Text style={styles.cardLabel}>산책 강도</Text>
            <View style={styles.chipRow}>
              {intensityOptions.map((opt) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!isEditing}
                  key={opt.key}
                  onPress={() => setIntensity(opt.key)}
                  style={[styles.chip, intensity === opt.key && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, intensity === opt.key && styles.chipTextActive]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 배변 */}
          <View style={styles.card}>
            <View style={styles.checkRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={!isEditing}
                onPress={() => setUrination(!urination)}
                style={styles.checkOption}
              >
                <View style={[styles.checkCircle, urination && styles.checkCircleActive]}>
                  {urination && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
                </View>
                <Text style={styles.checkLabel}>소변</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={!isEditing}
                onPress={() => setDefecation(!defecation)}
                style={styles.checkOption}
              >
                <View style={[styles.checkCircle, defecation && styles.checkCircleActive]}>
                  {defecation && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
                </View>
                <Text style={styles.checkLabel}>대변</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={!isEditing}
                onPress={() => setSpecialNote(!specialNote)}
                style={styles.checkOption}
              >
                <View style={[styles.checkCircle, specialNote && styles.checkCircleActive]}>
                  {specialNote && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
                </View>
                <Text style={styles.checkLabel}>특이사항</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          {isViewMode && !isEditing ? (
            <View style={styles.actionRow}>
              <AppButton
                onPress={() => setIsEditing(true)}
                style={styles.actionButton}
                title="수정"
                variant="success"
              />
              <AppButton
                onPress={handleDeleteRecord}
                style={styles.actionButton}
                title="삭제"
                variant="danger"
              />
            </View>
          ) : (
            <AppButton
              onPress={handleSaveRecord}
              style={{ backgroundColor: COLORS.success }}
              title={isViewMode ? '저장하기' : '산책 기록 저장'}
            />
          )}
        </View>
      </AppScreen>

      {/* 날짜 피커 */}
      <DatePickerSheet
        onClose={() => setDatePickerVisible(false)}
        onSelect={(date) => setRecordedAt(date)}
        title="산책 날짜 선택"
        value={recordedAt}
        visible={datePickerVisible}
      />

      {/* 시간 피커 */}
      <TimePickerSheet
        onClose={() => setTimePickerVisible(false)}
        onSelect={({ hour, minute }) => {
          if (timePickerTarget === 'start') {
            setStartHour(hour);
            setStartMinute(minute);
          } else {
            setEndHour(hour);
            setEndMinute(minute);
          }
        }}
        title={timePickerTarget === 'start' ? '시작 시간 선택' : '종료 시간 선택'}
        value={
          timePickerTarget === 'start'
            ? { hour: startHour, minute: startMinute }
            : { hour: endHour, minute: endMinute }
        }
        visible={timePickerVisible}
      />

      {/* 날씨 모달 */}
      <AppModal
        onClose={() => setWeatherModalVisible(false)}
        primaryAction={{
          disabled: !weatherDraft || !isTemperature(temperatureDraft),
          label: '확인',
          onPress: () => {
            setWeatherText(weatherDraft);
            setTemperatureText(temperatureDraft);
            setWeatherModalVisible(false);
          },
        }}
        secondaryAction={{
          label: '취소',
          onPress: () => setWeatherModalVisible(false),
        }}
        title="날씨 등록"
        variant="center"
        visible={weatherModalVisible}
      >
        <View style={styles.weatherModalContent}>
          <Text style={styles.weatherModalLabel}>날씨</Text>
          <View style={styles.weatherOptions}>
            {WEATHER_OPTIONS.map((option) => (
              <TouchableOpacity
                activeOpacity={0.8}
                key={option}
                onPress={() => setWeatherDraft(option)}
                style={[
                  styles.weatherOption,
                  weatherDraft === option && styles.weatherOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.weatherOptionText,
                    weatherDraft === option && styles.weatherOptionTextActive,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <AppInput
            inputMode="decimal"
            keyboardType="decimal-pad"
            label="기온"
            maxLength={5}
            onChangeText={(value) => setTemperatureDraft(parseTemperature(value))}
            placeholder="예: 24"
            rightElement={<Text style={styles.temperatureUnit}>°C</Text>}
            value={temperatureDraft}
          />
        </View>
      </AppModal>

      {/* 거리 입력 모달 (수동 기록) */}
      <AppModal
        onClose={() => setDistanceModalVisible(false)}
        primaryAction={{
          disabled: distanceDraft === '' || Number(distanceDraft) < 0,
          label: '확인',
          onPress: () => {
            const parsed = Math.min(99.9, Math.max(0, Number(distanceDraft)));
            setDistanceKm(Math.round(parsed * 10) / 10);
            setDistanceModalVisible(false);
          },
        }}
        secondaryAction={{
          label: '취소',
          onPress: () => setDistanceModalVisible(false),
        }}
        title="산책 거리 입력"
        variant="center"
        visible={distanceModalVisible}
      >
        <AppInput
          inputMode="decimal"
          keyboardType="decimal-pad"
          label="거리"
          maxLength={4}
          onChangeText={(value) => setDistanceDraft(parseDistance(value))}
          placeholder="예: 1.8"
          rightElement={<Text style={styles.temperatureUnit}>km</Text>}
          value={distanceDraft}
        />
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { gap: SPACING.lg, paddingBottom: SPACING.xxxl, paddingTop: SPACING.md },
  rowTwoCards: { flexDirection: 'row', gap: SPACING.md },
  metaCard: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  metaIcon: { height: 22, width: 22 },
  metaTextGroup: { flex: 1, gap: 2, justifyContent: 'center' },
  metaLabel: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
  metaValue: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
  placeholderText: { color: COLORS.gray500, fontFamily: TYPOGRAPHY.body2.fontFamily, fontSize: 13 },
  card: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xxl,
  },
  intensityCard: { backgroundColor: COLORS.successSoft, borderColor: 'transparent' },
  cardLabel: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
  timeGrid: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  timeCol: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: SPACING.lg,
  },
  timeLabel: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
  timeValue: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
    marginTop: 4,
  },

  // ── 산책 거리 카드 ──────────────────────────────────────────────────────────
  distanceCard: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg, // 위아래 줄임
  },
  distanceBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.successSoft,
    borderRadius: RADIUS.round,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  distanceBadgeIcon: { height: 18, width: 18 },
  distanceLabel: {
    ...TYPOGRAPHY.body2,
    color: COLORS.black,
    flex: 1,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
  distanceValue: {
    ...TYPOGRAPHY.body1,
    color: COLORS.success,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
  distancePlaceholder: {
    color: COLORS.gray500,
    fontFamily: TYPOGRAPHY.body2.fontFamily,
    fontSize: 13,
  },

  chipRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  chip: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  chipActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  chipText: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
  chipTextActive: { color: COLORS.background, fontFamily: TYPOGRAPHY.button.fontFamily },
  checkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
  },
  checkOption: { alignItems: 'center', flexDirection: 'row', gap: SPACING.sm },
  checkCircle: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkCircleActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  checkLabel: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
  bottomBar: { paddingBottom: SPACING.md, paddingTop: SPACING.md },
  actionRow: { flexDirection: 'row', gap: SPACING.md },
  actionButton: { flex: 1 },
  weatherModalContent: { gap: SPACING.lg, paddingVertical: SPACING.sm },
  weatherModalLabel: {
    ...TYPOGRAPHY.body2,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
  weatherOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  weatherOption: {
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  weatherOptionActive: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  weatherOptionText: { ...TYPOGRAPHY.caption, color: COLORS.gray600 },
  weatherOptionTextActive: { color: COLORS.background, fontFamily: TYPOGRAPHY.button.fontFamily },
  temperatureUnit: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
});
