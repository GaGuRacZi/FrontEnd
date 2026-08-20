import * as ImagePicker from 'expo-image-picker';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton, AppIcon, DatePickerSheet, TimePickerSheet } from '@/src/components/common';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';

import {
  ApiWeightRecord,
  AppetiteType,
  BodyType,
  createWeight,
  deleteWeight,
  getWeight,
  updateWeight,
} from '../services/weightService';
import { AppetiteCondition, BodyCondition } from '../types';

// ─── 타입 매핑 ────────────────────────────────────────────────────────────────

const BODY_TYPE_MAP: Record<BodyCondition, BodyType> = {
  lean: 'SKINNY',
  ideal: 'HEALTHY',
  overweight: 'OVER_WEIGHT',
};

const BODY_TYPE_REVERSE: Record<BodyType, BodyCondition> = {
  SKINNY: 'lean',
  HEALTHY: 'ideal',
  OVER_WEIGHT: 'overweight',
};

const APPETITE_MAP: Record<AppetiteCondition, AppetiteType> = {
  low: 'LOW',
  normal: 'MIDDLE',
  high: 'HIGH',
};

const APPETITE_REVERSE: Record<AppetiteType, AppetiteCondition> = {
  LOW: 'low',
  MIDDLE: 'normal',
  HIGH: 'high',
};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatRecordDate = (date: Date) =>
  `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

const formatRecordTime = (date: Date) => {
  const hours24 = date.getHours();
  const period = hours24 < 12 ? '오전' : '오후';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${period} ${hours12}:${pad2(date.getMinutes())}`;
};

/** "yyyy-MM-ddTHH:mm:ss" 형식으로 변환 — 서버가 UTC로 파싱하므로 UTC 기준으로 포맷 */
function toISOLocalString(date: Date): string {
  return (
    `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:00`
  );
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function WeightRecordScreen() {
  const router = useRouter();
  const isSaving = useRef(false);
  const { selectedPet } = usePetStore();
  const { recordId } = useLocalSearchParams<{ recordId?: string }>();

  // 로딩 상태 (recordId가 있을 때만 초기에 true)
  const [isLoadingRecord, setIsLoadingRecord] = useState(!!recordId);

  // 서버에서 가져온 기존 기록
  const [existingRecord, setExistingRecord] = useState<ApiWeightRecord | null>(null);

  // 폼 상태
  const [isEditing, setIsEditing] = useState(!recordId);
  const [recordedAt, setRecordedAt] = useState(new Date());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [weight, setWeight] = useState('');
  const [bodyCondition, setBodyCondition] = useState<BodyCondition>('ideal');
  const [appetite, setAppetite] = useState<AppetiteCondition>('low');
  const [memo, setMemo] = useState('');

  // 사진 상태
  // - existingPhotoUrl: 서버에 있는 기존 사진 URL (수정 시 keepPhotoUrls에 사용)
  // - selectedImageUri: 새로 선택한 로컬 이미지 URI
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // 화면에 표시할 이미지: 새로 선택한 이미지 우선, 없으면 기존 서버 이미지
  const displayImageUri = selectedImageUri ?? existingPhotoUrl;

  // ─── 기존 기록 로드 ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!recordId || !selectedPet) {
      setIsLoadingRecord(false);
      return;
    }
    const weightId = Number(recordId);
    if (isNaN(weightId)) {
      setIsLoadingRecord(false);
      return;
    }

    getWeight(Number(selectedPet.id), weightId)
      .then((rec) => {
        setExistingRecord(rec);
        // 서버 문자열은 UTC → 'Z' 붙여서 UTC로 파싱, 표시는 getHours()(KST)로 자동 변환
        setRecordedAt(new Date(rec.recordedAt + 'Z'));
        setWeight(String(rec.weight));
        setBodyCondition(BODY_TYPE_REVERSE[rec.bodyType] ?? 'ideal');
        setAppetite(APPETITE_REVERSE[rec.appetiteType] ?? 'low');
        setMemo(rec.memoContent ?? '');
        setExistingPhotoUrl(rec.photos[0]?.url ?? null);
        setIsEditing(false);
      })
      .catch(() => {
        Alert.alert('오류', '체중 기록을 불러오는 중 문제가 발생했어요.');
      })
      .finally(() => setIsLoadingRecord(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 사진 선택 ─────────────────────────────────────────────────────────────

  const handlePickImage = async () => {
    if (!isEditing) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 허용되어야 사진을 추가할 수 있어요.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('오류', '사진을 불러오는 중 문제가 발생했어요.');
    }
  };

  const handleRemoveImage = () => {
    setSelectedImageUri(null);
    setExistingPhotoUrl(null);
  };

  // ─── 저장 ──────────────────────────────────────────────────────────────────

  const handleSaveRecord = async () => {
    if (isSaving.current) return;
    if (!selectedPet) {
      Alert.alert('반려동물 선택 필요', '체중을 기록할 반려동물을 먼저 선택해주세요.');
      return;
    }
    const parsedWeight = parseFloat(weight);
    if (!parsedWeight || parsedWeight <= 0) {
      Alert.alert('입력 오류', '올바른 체중을 입력해주세요.');
      return;
    }

    // 내일 이후 날짜는 클라이언트에서 차단 (서버 에러 대신 명확한 안내)
    const now = new Date();
    const tomorrowMidnight = new Date(
      now.getFullYear(), now.getMonth(), now.getDate() + 1,
    );
    if (recordedAt >= tomorrowMidnight) {
      Alert.alert('날짜 오류', '오늘 이후의 날짜로는 체중을 기록할 수 없어요.');
      return;
    }

    isSaving.current = true;
    try {
      const petId = Number(selectedPet.id);

      // 오늘 날짜 + 미래 시간: 현재 시각으로 clamp (서버 PET_WEIGHT_400_1 방지)
      const clampedMs = Math.min(recordedAt.getTime(), now.getTime());
      const clampedRecordedAt = new Date(clampedMs);
      clampedRecordedAt.setSeconds(0, 0);

      const recordedAtISO = toISOLocalString(clampedRecordedAt);

      if (existingRecord) {
        // 수정: 기존 사진 유지 여부 결정
        // - 새 이미지가 있으면 기존 사진 교체 (keepPhotoUrls: [])
        // - 새 이미지 없고 기존 사진이 그대로면 유지 (keepPhotoUrls: [existingPhotoUrl])
        // - 사진을 지웠으면 모두 삭제 (keepPhotoUrls: [])
        const keepPhotoUrls =
          !selectedImageUri && existingPhotoUrl ? [existingPhotoUrl] : [];
        const imageUris = selectedImageUri ? [selectedImageUri] : [];

        await updateWeight(
          petId,
          existingRecord.petWeightId,
          {
            weight: parsedWeight,
            bodyType: BODY_TYPE_MAP[bodyCondition],
            appetiteType: APPETITE_MAP[appetite],
            memoContent: memo.trim() || undefined,
            recordedAt: recordedAtISO,
            keepPhotoUrls,
          },
          imageUris,
        );
      } else {
        // 신규 저장
        await createWeight(
          petId,
          {
            weight: parsedWeight,
            bodyType: BODY_TYPE_MAP[bodyCondition],
            appetiteType: APPETITE_MAP[appetite],
            memoContent: memo.trim() || undefined,
            recordedAt: recordedAtISO,
          },
          selectedImageUri ? [selectedImageUri] : [],
        );
      }

      router.replace({ pathname: '/health-summary', params: { tab: 'weight' } } as Href);
    } catch (error) {
      Alert.alert('오류', error instanceof Error ? error.message : '저장 중 문제가 발생했어요.');
    } finally {
      isSaving.current = false;
    }
  };

  // ─── 삭제 ──────────────────────────────────────────────────────────────────

  const handleDeleteRecord = () => {
    if (!existingRecord || !selectedPet) return;
    Alert.alert('체중 기록을 삭제할까요?', '삭제한 기록은 되돌릴 수 없어요.', [
      { style: 'cancel', text: '취소' },
      {
        style: 'destructive',
        text: '삭제',
        onPress: async () => {
          try {
            await deleteWeight(Number(selectedPet.id), existingRecord.petWeightId);
            router.replace({ pathname: '/health-summary', params: { tab: 'weight' } } as Href);
          } catch {
            Alert.alert('오류', '삭제 중 문제가 발생했어요.');
          }
        },
      },
    ]);
  };

  // ─── 옵션 ──────────────────────────────────────────────────────────────────

  const bodyOptions: { key: BodyCondition; label: string }[] = [
    { key: 'lean', label: '마름' },
    { key: 'ideal', label: '적정' },
    { key: 'overweight', label: '과체중' },
  ];

  const appetiteOptions: { key: AppetiteCondition; label: string }[] = [
    { key: 'low', label: '식욕이 떨어짐' },
    { key: 'normal', label: '식욕 평범' },
    { key: 'high', label: '식욕이 많음' },
  ];

  const recordDate = formatRecordDate(recordedAt);
  const recordTime = formatRecordTime(recordedAt);

  if (isLoadingRecord) {
    return (
      <AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
        <TopHeader
          leftAccessibilityLabel="뒤로가기"
          leftIcon="chevron-back"
          onLeftPress={() => router.back()}
          title="체중 기록하기"
        />
      </AppScreen>
    );
  }

  // ─── 렌더 ──────────────────────────────────────────────────────────────────

  return (
    <>
      <AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
        <TopHeader
          leftAccessibilityLabel="뒤로가기"
          leftIcon="chevron-back"
          onLeftPress={() => router.back()}
          title="체중 기록하기"
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 날짜 / 시간 카드 */}
          <View style={styles.rowTwoCards}>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!isEditing}
              onPress={() => setDatePickerVisible(true)}
              style={styles.metaCard}
            >
              <Image
                resizeMode="contain"
                source={HEALTH_SUMMARY_IMAGES.icons.calendar}
                style={styles.metaIcon}
              />
              <View style={styles.metaTextGroup}>
                <Text style={styles.metaLabel}>기록 날짜</Text>
                <Text style={styles.metaValue}>{recordDate}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={!isEditing}
              onPress={() => setTimePickerVisible(true)}
              style={styles.metaCard}
            >
              <View style={styles.metaTextGroup}>
                <Text style={styles.metaLabel}>측정 시간</Text>
                <Text style={styles.metaValue}>{recordTime}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* 몸무게 */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>몸무게</Text>
            <View style={styles.inputRow}>
              <TextInput
                editable={isEditing}
                keyboardType="decimal-pad"
                onChangeText={setWeight}
                placeholder="몸무게를 입력해주세요"
                placeholderTextColor={COLORS.gray500}
                style={[styles.inputValue, !weight && styles.inputPlaceholder]}
                value={weight}
              />
              <Text style={styles.inputUnit}>kg</Text>
            </View>
          </View>

          {/* 체형 상태 */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>체형 상태</Text>
            <Text style={styles.cardHint}>육안으로 봤을 때 가장 가까운 상태를 골라요.</Text>
            <View style={styles.chipRow}>
              {bodyOptions.map((opt) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!isEditing}
                  key={opt.key}
                  onPress={() => setBodyCondition(opt.key)}
                  style={[styles.chip, bodyCondition === opt.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, bodyCondition === opt.key && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 컨디션 체크 */}
          <View style={[styles.card, { backgroundColor: COLORS.cream, borderColor: COLORS.transparent }]}>
            <Text style={styles.cardLabel}>컨디션 체크</Text>
            <View style={styles.radioGroup}>
              {appetiteOptions.map((opt) => {
                const active = appetite === opt.key;
                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={!isEditing}
                    key={opt.key}
                    onPress={() => setAppetite(opt.key)}
                    style={styles.radioOption}
                  >
                    <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                      {active && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
                    </View>
                    <Text style={styles.radioLabel}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 메모 & 사진 */}
          <View style={styles.card}>
            <View style={styles.memoHeader}>
              <Text style={styles.cardLabel}>메모</Text>
              <TouchableOpacity
                accessibilityLabel="사진 추가"
                accessibilityRole="button"
                activeOpacity={0.7}
                disabled={!isEditing}
                onPress={handlePickImage}
                style={styles.photoButton}
              >
                <AppIcon color={COLORS.primary} name="camera" size={16} />
                <Text style={styles.photoButtonText}>사진</Text>
              </TouchableOpacity>
            </View>

            {displayImageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: displayImageUri }} style={styles.previewImage} />
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!isEditing}
                  onPress={handleRemoveImage}
                  style={styles.removeImageButton}
                >
                  <AppIcon color={COLORS.background} name="close" size={14} />
                </TouchableOpacity>
              </View>
            ) : null}

            <TextInput
              editable={isEditing}
              multiline
              scrollEnabled={false}
              onChangeText={setMemo}
              placeholder="식사 후 같은 시간대에 측정했어요."
              placeholderTextColor={COLORS.gray500}
              style={styles.memoInput}
              value={memo}
            />
          </View>
        </ScrollView>

        {/* 하단 버튼 */}
        <View style={styles.bottomBar}>
          {existingRecord && !isEditing ? (
            <View style={styles.actionRow}>
              <AppButton onPress={() => setIsEditing(true)} style={styles.actionButton} title="수정" />
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
              title={existingRecord ? '저장하기' : '체중 기록 저장'}
            />
          )}
        </View>
      </AppScreen>

      <DatePickerSheet
        onClose={() => setDatePickerVisible(false)}
        onSelect={(date) => setRecordedAt(date)}
        title="기록 날짜 선택"
        value={recordedAt}
        visible={datePickerVisible}
      />
      <TimePickerSheet
        onClose={() => setTimePickerVisible(false)}
        onSelect={({ hour, minute }) => {
          const updated = new Date(recordedAt);
          updated.setHours(hour, minute, 0, 0);
          setRecordedAt(updated);
        }}
        title="측정 시간 선택"
        value={{ hour: recordedAt.getHours(), minute: recordedAt.getMinutes() }}
        visible={timePickerVisible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { gap: SPACING.lg, paddingBottom: SPACING.xxxl, paddingTop: SPACING.xxl },
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
  card: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xxl,
  },
  cardLabel: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
  cardHint: { ...TYPOGRAPHY.small, color: COLORS.gray500, marginVertical: 4 },
  inputRow: {
    alignItems: 'center',
    borderBottomColor: COLORS.primary,
    borderBottomWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    paddingBottom: SPACING.xs,
  },
  inputValue: {
    ...TYPOGRAPHY.title1,
    color: COLORS.black,
    fontSize: 28,
    height: 38,
    lineHeight: 38,
    margin: 0,
    padding: 0,
    textAlignVertical: 'center',
  },
  inputPlaceholder: { color: COLORS.gray500, fontFamily: TYPOGRAPHY.body2.fontFamily, fontSize: 16, lineHeight: 24 },
  inputUnit: { ...TYPOGRAPHY.body1, color: COLORS.gray600 },
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
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
  chipTextActive: { color: COLORS.background, fontFamily: TYPOGRAPHY.button.fontFamily },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },
  radioOption: { alignItems: 'center', flexDirection: 'row', gap: SPACING.sm },
  radioCircle: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioCircleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  radioLabel: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
  memoHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  photoButton: {
    alignItems: 'center',
    backgroundColor: COLORS.summarycontainer,
    borderRadius: RADIUS.round,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
  },
  photoButtonText: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontFamily: TYPOGRAPHY.button.fontFamily },
  imagePreviewContainer: { height: 80, marginTop: SPACING.md, position: 'relative', width: 80 },
  previewImage: { borderRadius: RADIUS.md, height: '100%', width: '100%' },
  removeImageButton: {
    alignItems: 'center',
    backgroundColor: COLORS.gray800,
    borderRadius: RADIUS.round,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    top: -6,
    width: 20,
  },
  memoInput: {
    ...TYPOGRAPHY.body2,
    color: COLORS.black,
    marginTop: SPACING.lg,
    minHeight: 60,
    padding: 0,
    textAlignVertical: 'top',
  },
  bottomBar: { paddingBottom: SPACING.md, paddingTop: SPACING.md },
  actionRow: { flexDirection: 'row', gap: SPACING.md },
  actionButton: { flex: 1 },
});
