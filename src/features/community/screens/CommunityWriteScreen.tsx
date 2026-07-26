import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton, AppIcon } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { KeyboardAwareScrollView, ScreenLayout } from '@/src/components/layout';
import { AppModal } from '@/src/components/modal';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import { usePetStore } from '@/src/features/pet/PetStore';

import {
  MARKET_TRADE_TYPES,
  REVIEW_CATEGORIES,
  TALK_CATEGORIES,
} from '../communityData';
import { useCommunityStore } from '../CommunityStore';
import type {
  CommunityAuthorSnapshot,
  MarketCategory,
  MarketTradeType,
  ReviewCategory,
  TalkCategory,
} from '../types';

const TALK_WRITE_CATEGORIES = TALK_CATEGORIES.filter(
  (category): category is Exclude<TalkCategory, '전체'> => category !== '전체',
);
const MARKET_WRITE_CATEGORIES: Exclude<MarketCategory, '전체'>[] = [
  '사료·간식',
  '용품',
  '기타',
  '영양제',
];
const REVIEW_WRITE_CATEGORIES = REVIEW_CATEGORIES.filter(
  (category): category is Exclude<ReviewCategory, '전체'> => category !== '전체',
);
const TRADE_METHODS = ['직거래', '택배', '비대면 나눔'] as const;
const TALK_TAG_SUGGESTIONS = ['피하수액', '응급', '동네병원', '산책', '고양이'];
const MAX_PHOTOS = 5;
const MAX_TITLE_LENGTH = 40;
const MAX_BODY_LENGTH = 500;
const MAX_TAG_COUNT = 5;
const MAX_TAG_LENGTH = 10;
const REVIEW_STAR_COLOR = COLORS.starWarm;

type TradeMethod = (typeof TRADE_METHODS)[number];
type WriteTab = 'market' | 'review' | 'talk';
type UserProfileState = ReturnType<typeof useMyPageStore>['profile'];
type SelectedPetState = ReturnType<typeof usePetStore>['selectedPet'];
type ReviewWriteCategory = Exclude<ReviewCategory, '전체'>;

function getReviewTargetPlaceholder(category: ReviewWriteCategory) {
  if (category === '산책 장소') return '장소 이름을 입력해주세요';
  if (category === '병원') return '병원 이름을 입력해주세요';
  if (category === '용품샵') return '용품샵 이름을 입력해주세요';
  if (category === '미용실') return '미용실 이름을 입력해주세요';
  return '자유롭게 입력해주세요';
}

function getReviewScoreLabels(category: ReviewWriteCategory) {
  return category === '산책 장소'
    ? ['쾌적도', '접근성', '재방문'] as const
    : ['친절도', '가격', '재방문'] as const;
}

function resolveWriteTab(value?: string): WriteTab {
  if (value === 'market' || value === 'review' || value === 'talk') return value;
  return 'talk';
}

function isFutureDateValue(value: string) {
  if (!value.trim()) return false;
  const normalized = value.replaceAll('.', '-');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
}

function parseDateValue(value: string) {
  const normalized = value.trim().replaceAll('.', '-');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getAuthor(
  profile: UserProfileState,
  selectedPet: SelectedPetState,
  viewerId: string,
): CommunityAuthorSnapshot {
  return {
    introduction: profile?.introduction.trim() || undefined,
    location: profile?.location || undefined,
    nickname: profile?.nickname || '파우 보호자',
    petName: selectedPet?.name,
    profileImageUri: profile?.profileImageUri ?? null,
    userId: viewerId,
  };
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function formatPrice(value: string) {
  const number = Number(value.replace(/[^0-9]/g, ''));
  if (!number) return '';
  return `${number.toLocaleString('ko-KR')}원`;
}

function normalizeTag(value: string) {
  return value.trim().replace(/^#+/, '').replace(/\s+/g, '');
}

function FieldCard({
  children,
  icon,
  required,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon?: Parameters<typeof AppIcon>[0]['name'];
  required?: boolean;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        {icon ? (
          <View style={styles.cardIcon}>
            <AppIcon color={COLORS.primary} name={icon} size={18} />
          </View>
        ) : null}
        <View style={styles.cardTitleText}>
          <Text style={styles.cardTitle}>
            {title}
            {required ? <Text style={styles.requiredMark}> *</Text> : null}
          </Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function FormLabel({ required, title }: { required?: boolean; title: string }) {
  return (
    <Text style={styles.formLabel}>
      {title}
      {required ? <Text style={styles.requiredMark}> *</Text> : null}
    </Text>
  );
}

function ChoiceChip<T extends string>({
  label,
  onPress,
  selected,
}: {
  label: T;
  onPress: (value: T) => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(label)}
      style={({ pressed }) => [
        styles.choiceChip,
        selected && styles.choiceChipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChipGroup<T extends string>({
  onChange,
  value,
  values,
}: {
  onChange: (value: T) => void;
  value: T;
  values: readonly T[];
}) {
  return (
    <View style={styles.chipGroup}>
      {values.map((item) => (
        <ChoiceChip
          key={item}
          label={item}
          onPress={onChange}
          selected={item === value}
        />
      ))}
    </View>
  );
}

function PhotoPickerRow({
  maxCount = MAX_PHOTOS,
  onAdd,
  onMoveToFirst,
  onRemove,
  photos,
}: {
  maxCount?: number;
  onAdd: () => void;
  onMoveToFirst: (index: number) => void;
  onRemove: (uri: string) => void;
  photos: string[];
}) {
  return (
    <>
      <View style={styles.photoRow}>
        {Array.from({ length: maxCount }).map((_, index) => {
          const uri = photos[index];

          return (
            <Pressable
              accessibilityHint={uri && index > 0 ? '길게 누르면 대표 이미지로 이동합니다.' : undefined}
              accessibilityLabel={uri ? `사진 ${index + 1} 삭제` : `사진 ${index + 1} 첨부`}
              accessibilityRole="button"
              key={index}
              onLongPress={uri && index > 0 ? () => onMoveToFirst(index) : undefined}
              onPress={uri ? () => onRemove(uri) : onAdd}
              style={({ pressed }) => [
                styles.photoBox,
                index === 0 && styles.photoBoxPrimary,
                pressed && styles.pressed,
              ]}
            >
              {uri ? (
                <>
                  <Image source={{ uri }} style={styles.photoPreview} />
                  {index === 0 ? (
                    <View style={styles.coverBadge}>
                      <Text style={styles.coverBadgeText}>대표</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <AppIcon
                  color={COLORS.primary}
                  name={index === 0 ? 'camera-outline' : 'add'}
                  size={index === 0 ? 22 : 24}
                />
              )}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.photoGuide}>첫 번째 사진이 대표 이미지예요. 사진을 길게 누르면 대표로 이동해요.</Text>
    </>
  );
}

function StarRating({
  onChange,
  value,
}: {
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <View style={styles.ratingRow}>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((score) => {
          const iconName = value >= score ? 'star' : value >= score - 0.5 ? 'star-half' : 'star-outline';

          return (
            <View key={score} style={styles.starButton}>
              <Pressable
                accessibilityLabel={`${score - 0.5}점`}
                accessibilityRole="button"
                onPress={() => onChange(score - 0.5)}
                style={({ pressed }) => [styles.starHitArea, styles.starHitAreaLeft, pressed && styles.pressed]}
              />
              <Pressable
                accessibilityLabel={`${score}점`}
                accessibilityRole="button"
                onPress={() => onChange(score)}
                style={({ pressed }) => [styles.starHitArea, styles.starHitAreaRight, pressed && styles.pressed]}
              />
            <AppIcon
              color={value >= score - 0.5 ? REVIEW_STAR_COLOR : COLORS.gray300}
              name={iconName}
              size={28}
            />
            </View>
          );
        })}
      </View>
      <View style={styles.ratingBadge}>
        <Text style={styles.ratingBadgeText}>{value.toFixed(1)}</Text>
      </View>
    </View>
  );
}

export function CommunityWriteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const initialTab = resolveWriteTab(type);
  const { addMarketPost, addReviewPost, addTalkPost, viewerId } = useCommunityStore();
  const { profile } = useMyPageStore();
  const { selectedPet } = usePetStore();
  const author = useMemo(
    () => getAuthor(profile, selectedPet, viewerId),
    [profile, selectedPet, viewerId],
  );
  const [submitting, setSubmitting] = useState(false);

  const [talkCategory, setTalkCategory] = useState<Exclude<TalkCategory, '전체'>>('건강상담');
  const [talkTitle, setTalkTitle] = useState('');
  const [talkBody, setTalkBody] = useState('');
  const [talkPhotos, setTalkPhotos] = useState<string[]>([]);
  const [talkTags, setTalkTags] = useState<string[]>(['피하수액', '응급']);
  const [customTag, setCustomTag] = useState('');

  const [tradeType, setTradeType] = useState<MarketTradeType>('나눔');
  const [marketCategory, setMarketCategory] = useState<Exclude<MarketCategory, '전체'>>('사료·간식');
  const [marketPhotos, setMarketPhotos] = useState<string[]>([]);
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [priceOffer, setPriceOffer] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [expiryCalendarVisible, setExpiryCalendarVisible] = useState(false);
  const [pendingExpiryDate, setPendingExpiryDate] = useState(getTomorrow);
  const [marketBody, setMarketBody] = useState('');
  const [tradeMethods, setTradeMethods] = useState<TradeMethod[]>(['직거래']);
  const [tradeLocation, setTradeLocation] = useState(profile?.location ?? '');

  const [reviewCategory, setReviewCategory] = useState<Exclude<ReviewCategory, '전체'>>('병원');
  const [reviewTarget, setReviewTarget] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewKindness, setReviewKindness] = useState(5);
  const [reviewPriceScore, setReviewPriceScore] = useState(4);
  const [reviewRevisit, setReviewRevisit] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewVisitedAt, setReviewVisitedAt] = useState('');
  const [reviewCalendarVisible, setReviewCalendarVisible] = useState(false);
  const [pendingReviewDate, setPendingReviewDate] = useState(() => new Date());
  const [reviewBody, setReviewBody] = useState('');
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([]);
  const reviewScoreLabels = getReviewScoreLabels(reviewCategory);

  const pickPhotos = async (photos: string[], setPhotos: (photos: string[]) => void, maxCount = MAX_PHOTOS) => {
    if (photos.length >= maxCount) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('사진 접근 권한이 필요해요', '설정에서 사진 접근 권한을 허용해주세요.', [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => void Linking.openSettings() },
        ]);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        defaultTab: 'photos',
        mediaTypes: ['images'],
        quality: 0.85,
        selectionLimit: maxCount - photos.length,
      });
      if (result.canceled) return;

      const nextPhotos = [
        ...photos,
        ...result.assets.map((asset) => asset.uri),
      ].slice(0, maxCount);
      setPhotos(nextPhotos);
    } catch {
      Alert.alert('사진을 불러오지 못했어요', '잠시 후 다시 시도해주세요.');
    }
  };

  const removePhoto = (photos: string[], setPhotos: (photos: string[]) => void, uri: string) => {
    setPhotos(photos.filter((photo) => photo !== uri));
  };

  const movePhotoToFirst = (photos: string[], setPhotos: (photos: string[]) => void, index: number) => {
    if (index <= 0 || index >= photos.length) return;
    const nextPhotos = [...photos];
    const [selectedPhoto] = nextPhotos.splice(index, 1);
    setPhotos([selectedPhoto, ...nextPhotos]);
  };

  const selectReviewDate = (date: Date) => {
    setReviewVisitedAt(formatDateValue(date));
  };

  const handleAndroidReviewDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) selectReviewDate(date);
  };

  const openReviewCalendar = () => {
    const initialDate = parseDateValue(reviewVisitedAt) ?? new Date();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        display: 'calendar',
        maximumDate: new Date(),
        mode: 'date',
        onChange: handleAndroidReviewDateChange,
        value: initialDate,
      });
      return;
    }

    setPendingReviewDate(initialDate);
    setReviewCalendarVisible(true);
  };

  const selectExpiryDate = (date: Date) => {
    setExpiresAt(formatDateValue(date));
  };

  const handleAndroidExpiryDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) selectExpiryDate(date);
  };

  const openExpiryCalendar = () => {
    const tomorrow = getTomorrow();
    const parsedDate = parseDateValue(expiresAt);
    const initialDate = parsedDate && parsedDate >= tomorrow ? parsedDate : tomorrow;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        display: 'calendar',
        minimumDate: tomorrow,
        mode: 'date',
        onChange: handleAndroidExpiryDateChange,
        value: initialDate,
      });
      return;
    }

    setPendingExpiryDate(initialDate);
    setExpiryCalendarVisible(true);
  };

  const customTalkTags = talkTags.filter((tag) => !TALK_TAG_SUGGESTIONS.includes(tag));

  const addCustomTag = () => {
    const nextTag = normalizeTag(customTag);
    const alreadyAdded = talkTags.some((tag) => normalizeTag(tag) === nextTag);
    if (!nextTag || nextTag.length > MAX_TAG_LENGTH || alreadyAdded) return;
    if (talkTags.length >= MAX_TAG_COUNT) return;
    setTalkTags([...talkTags, nextTag]);
    setCustomTag('');
  };

  const canSubmitTalk = Boolean(talkTitle.trim() && talkBody.trim());
  const marketNeedsPhoto = tradeType !== '구해요';
  const marketNeedsPrice = tradeType === '판매';
  const marketNeedsLocation = tradeMethods.includes('직거래') || tradeMethods.includes('비대면 나눔');
  const hasInvalidExpiry = Boolean(expiresAt.trim() && !isFutureDateValue(expiresAt));
  const canSubmitMarket = Boolean(
    productName.trim() &&
      marketBody.trim() &&
      (!marketNeedsPhoto || marketPhotos.length > 0) &&
      (!marketNeedsPrice || price.replace(/[^0-9]/g, '')) &&
      !hasInvalidExpiry &&
      (!marketNeedsLocation || tradeLocation.trim()),
  );
  const canSubmitReview = Boolean(reviewTarget.trim() && reviewTitle.trim() && reviewBody.trim());
  const canSubmit =
    initialTab === 'talk'
      ? canSubmitTalk
      : initialTab === 'market'
        ? canSubmitMarket
        : canSubmitReview;

  const getSubmitBlockMessage = () => {
    if (initialTab === 'talk') {
      if (!talkTitle.trim()) return '제목을 입력해주세요.';
      if (!talkBody.trim()) return '내용을 입력해주세요.';
      return null;
    }

    if (initialTab === 'market') {
      if (marketNeedsPhoto && marketPhotos.length === 0) return '상품 사진을 1개 이상 등록해주세요.';
      if (!productName.trim()) return '상품명을 입력해주세요.';
      if (marketNeedsPrice && !price.replace(/[^0-9]/g, '')) return '가격을 입력해주세요.';
      if (hasInvalidExpiry) {
        return '유통기한은 오늘 이후 날짜로 입력해주세요.';
      }
      if (!marketBody.trim()) return '상세 설명을 입력해주세요.';
      if (marketNeedsLocation && !tradeLocation.trim()) return '거래 지역을 입력해주세요.';
      return null;
    }

    if (!reviewTarget.trim()) return '리뷰 대상을 입력해주세요.';
    if (!reviewTitle.trim()) return '제목을 입력해주세요.';
    if (!reviewBody.trim()) return '후기 내용을 입력해주세요.';
    return null;
  };

  const submit = async () => {
    if (submitting) return;

    const blockMessage = getSubmitBlockMessage();
    if (blockMessage) {
      Alert.alert('필수 항목을 확인해주세요', blockMessage);
      return;
    }

    setSubmitting(true);

    try {
      if (initialTab === 'talk') {
        const result = await addTalkPost({
          author,
          baseBookmarkCount: 0,
          baseReactionCounts: { like: 0 },
          body: talkBody,
          category: talkCategory,
          photoUris: talkPhotos,
          showNeighborhood: true,
          tags: talkTags,
          title: talkTitle,
        });
        if (result.ok && result.postId) {
          router.replace({ pathname: '/community/[postId]', params: { postId: result.postId } });
          return;
        }

        Alert.alert('등록하지 못했어요', '입력 내용을 다시 확인해주세요.');
        return;
      }

      if (initialTab === 'market') {
        const resolvedPrice =
          tradeType === '나눔'
            ? '나눔'
            : tradeType === '교환'
              ? '교환'
              : tradeType === '구해요' && !price.replace(/[^0-9]/g, '')
                ? '가격 협의'
                : formatPrice(price);
        const result = await addMarketPost({
          author,
          baseBookmarkCount: 0,
          baseReactionCounts: { helpful: 0, notHelpful: 0 },
          body: marketBody,
          category: marketCategory,
          expiresAt: expiresAt.trim() || undefined,
          imageCount: marketPhotos.length,
          location: tradeLocation.trim() || profile?.location || '지역 미설정',
          photoUris: marketPhotos,
          priceLabel: priceOffer && resolvedPrice ? `${resolvedPrice} · 가격 제안 가능` : resolvedPrice,
          status: '진행 중',
          tags: [marketCategory, tradeType, ...tradeMethods],
          title: productName,
          tradeType,
        });
        if (result.ok && result.postId) {
          router.replace({ pathname: '/community/[postId]', params: { postId: result.postId } });
          return;
        }

        Alert.alert('등록하지 못했어요', '입력 내용을 다시 확인해주세요.');
        return;
      }

      const result = await addReviewPost({
        author,
        baseReactionCounts: { helpful: 0, notHelpful: 0 },
        body: reviewBody,
        category: reviewCategory,
        detailScores: {
          kindness: reviewKindness,
          price: reviewPriceScore,
          revisit: reviewRevisit,
        },
        rating: reviewRating,
        photoUris: reviewPhotos,
        targetName: reviewTarget,
        title: reviewTitle,
        visitedAt: reviewVisitedAt.trim() || undefined,
      });
      if (result.ok && result.postId) {
        router.replace({ pathname: '/community/[postId]', params: { postId: result.postId } });
        return;
      }

      Alert.alert('등록하지 못했어요', '입력 내용을 다시 확인해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    initialTab === 'market'
      ? '장터 글쓰기'
      : initialTab === 'review'
        ? '리뷰 글쓰기'
        : '소통 글쓰기';

  return (
    <>
      <ScreenLayout
      headerFullWidth
      headerVariant="auth"
      rightContent={
        <Pressable
          accessibilityLabel="등록"
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          onPress={submit}
          style={({ pressed }) => [
            styles.submitPill,
            canSubmit && styles.submitPillActive,
            pressed && canSubmit && styles.pressed,
          ]}
        >
          <Text style={[styles.submitPillText, canSubmit && styles.submitPillTextActive]}>
            등록
          </Text>
        </Pressable>
      }
      title={title}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.flex}
      >
        <KeyboardAwareScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, SPACING.xl) + SPACING.xxxl },
          ]}
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          {initialTab === 'talk' ? (
            <>
              <FieldCard title="게시판 선택" subtitle="글의 성격에 맞는 게시판을 골라주세요.">
                <ChipGroup onChange={setTalkCategory} value={talkCategory} values={TALK_WRITE_CATEGORIES} />
              </FieldCard>

              <FieldCard title="글 정보">
                <Text style={styles.inlineLabel}>
                  제목
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
                <AppInput
                  maxLength={MAX_TITLE_LENGTH}
                  onChangeText={setTalkTitle}
                  placeholder="제목을 입력해주세요"
                  value={talkTitle}
                />
                <Text style={styles.inlineLabel}>
                  내용
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
                <AppInput
                  inputStyle={styles.multilineInput}
                  maxLength={MAX_BODY_LENGTH}
                  multiline
                  onChangeText={setTalkBody}
                  placeholder="궁금한 점이나 공유하고 싶은 이야기를 적어주세요."
                  value={talkBody}
                />
                <Text style={styles.counter}>{talkBody.length} / {MAX_BODY_LENGTH}</Text>
                <Text style={styles.noticeLine}>긴급 상황은 가까운 동물병원에 먼저 연락해주세요.</Text>
              </FieldCard>

              <FieldCard title="사진 첨부" subtitle="검사 결과, 처방 봉투, 증상 사진 등을 올릴 수 있어요">
                <PhotoPickerRow
                  onAdd={() => void pickPhotos(talkPhotos, setTalkPhotos)}
                  onMoveToFirst={(index) => movePhotoToFirst(talkPhotos, setTalkPhotos, index)}
                  onRemove={(uri) => removePhoto(talkPhotos, setTalkPhotos, uri)}
                  photos={talkPhotos}
                />
              </FieldCard>

              <FieldCard title="태그" subtitle="태그는 최대 5개까지 등록 가능합니다.">
                <View style={styles.tagRow}>
                  {TALK_TAG_SUGGESTIONS.map((tag) => {
                    const selected = talkTags.includes(tag);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={tag}
                        onPress={() => setTalkTags(toggleValue(talkTags, tag).slice(0, MAX_TAG_COUNT))}
                        style={[styles.tagChip, selected && styles.tagChipActive]}
                      >
                        <Text style={[styles.tagChipText, selected && styles.tagChipTextActive]}>
                          #{tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {customTalkTags.map((tag) => (
                    <Pressable
                      accessibilityLabel={`${tag} 태그 삭제`}
                      accessibilityRole="button"
                      key={tag}
                      onPress={() => setTalkTags(talkTags.filter((current) => current !== tag))}
                      style={[styles.tagChip, styles.tagChipActive]}
                    >
                      <Text style={[styles.tagChipText, styles.tagChipTextActive]}>
                        #{tag}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.customTagRow}>
                  <AppInput
                    containerStyle={styles.customTagInput}
                    maxLength={MAX_TAG_LENGTH + 1}
                    onChangeText={setCustomTag}
                    onSubmitEditing={addCustomTag}
                    placeholder="직접 입력"
                    returnKeyType="done"
                    size="compact"
                    value={customTag}
                  />
                  <AppButton
                    disabled={!customTag.trim() || talkTags.length >= MAX_TAG_COUNT}
                    fullWidth={false}
                    onPress={addCustomTag}
                    size="medium"
                    style={styles.tagAddButton}
                    title="추가"
                    variant="outline"
                  />
                </View>
              </FieldCard>

              <View style={styles.guideCard}>
                <AppIcon color={COLORS.primary} name="shield-checkmark-outline" size={22} />
                <View style={styles.guideText}>
                  <Text style={styles.guideTitle}>서로에게 도움이 되는 글로 남겨주세요</Text>
                  <Text style={styles.guideDescription}>약품 거래나 처방 변경 조언은 제한될 수 있어요.</Text>
                </View>
              </View>
            </>
          ) : null}

          {initialTab === 'market' ? (
            <>
              <FieldCard title="거래 방식" subtitle="나눔, 판매, 구해요 중 목적에 맞게 골라주세요">
                <ChipGroup onChange={setTradeType} value={tradeType} values={MARKET_TRADE_TYPES} />
                <Text style={styles.sectionLabel}>품목 카테고리</Text>
                <ChipGroup onChange={setMarketCategory} value={marketCategory} values={MARKET_WRITE_CATEGORIES} />
              </FieldCard>

              <FieldCard required={marketNeedsPhoto} title="상품 사진" subtitle="대표 사진은 첫 번째로 보여져요.">
                <PhotoPickerRow
                  onAdd={() => void pickPhotos(marketPhotos, setMarketPhotos)}
                  onMoveToFirst={(index) => movePhotoToFirst(marketPhotos, setMarketPhotos, index)}
                  onRemove={(uri) => removePhoto(marketPhotos, setMarketPhotos, uri)}
                  photos={marketPhotos}
                />
                {marketNeedsPhoto && marketPhotos.length === 0 ? (
                  <Text style={styles.errorText}>상품 사진을 1개 이상 등록해주세요.</Text>
                ) : null}
              </FieldCard>

              <FieldCard icon="cube-outline" title="상품 정보" subtitle="상태와 유통기한을 정확히 적어주세요">
                <View style={styles.formRow}>
                  <FormLabel required title="상품명" />
                  <AppInput
                    containerStyle={styles.formInput}
                    maxLength={MAX_TITLE_LENGTH}
                    onChangeText={setProductName}
                    placeholder="예: 신장 케어 사료"
                    value={productName}
                  />
                </View>
                {tradeType === '판매' || tradeType === '구해요' ? (
                  <View style={styles.formRow}>
                    <FormLabel required={marketNeedsPrice} title={tradeType === '판매' ? '가격' : '희망 가격'} />
                    <View style={styles.priceRow}>
                      <AppInput
                        containerStyle={styles.priceInput}
                        keyboardType="number-pad"
                        onChangeText={(value) => setPrice(value.replace(/[^0-9]/g, ''))}
                        placeholder="0"
                        rightElement={<Text style={styles.unitText}>원</Text>}
                        value={price}
                      />
                      {tradeType === '판매' ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: priceOffer }}
                          onPress={() => setPriceOffer(!priceOffer)}
                          style={[styles.offerChip, priceOffer && styles.offerChipActive]}
                        >
                          <Text style={[styles.offerText, priceOffer && styles.offerTextActive]}>
                            가격 제안 가능
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ) : null}
                <View style={styles.formRow}>
                  <FormLabel title="유통기한" />
                  <AppInput
                    containerStyle={styles.formInput}
                    error={hasInvalidExpiry ? '오늘 이후 날짜로 입력해주세요.' : undefined}
                    maxLength={10}
                    onChangeText={setExpiresAt}
                    placeholder="2026.12.31"
                    rightElement={
                      <Pressable
                        accessibilityLabel="캘린더에서 유통기한 선택"
                        accessibilityRole="button"
                        hitSlop={SPACING.sm}
                        onPress={openExpiryCalendar}
                        style={({ pressed }) => [styles.dateIconButton, pressed && styles.pressed]}
                      >
                        <AppIcon color={COLORS.primary} name="calendar-outline" size={18} />
                      </Pressable>
                    }
                    value={expiresAt}
                  />
                </View>
              </FieldCard>

              <FieldCard required title="상세 설명">
                <AppInput
                  inputStyle={styles.marketBodyInput}
                  maxLength={MAX_BODY_LENGTH}
                  multiline
                  onChangeText={setMarketBody}
                  placeholder="거래할 품목의 구매 시기, 보관 상태를 적어주세요.\n예) 2주 전 구매, 실온 보관, 알러지 때문에 나눔해요."
                  value={marketBody}
                />
                <Text style={styles.counter}>{marketBody.length} / {MAX_BODY_LENGTH}</Text>
              </FieldCard>

              <FieldCard title="거래 방법" subtitle="여러 개를 함께 선택할 수 있어요">
                <View style={styles.chipGroup}>
                  {TRADE_METHODS.map((method) => {
                    const selected = tradeMethods.includes(method);
                    return (
                      <ChoiceChip
                        key={method}
                        label={method}
                        onPress={() => setTradeMethods(toggleValue(tradeMethods, method))}
                        selected={selected}
                      />
                    );
                  })}
                </View>
                {marketNeedsLocation ? (
                  <View style={styles.locationField}>
                    <Text style={styles.inlineLabel}>
                      거래 지역
                      <Text style={styles.requiredMark}> *</Text>
                    </Text>
                    <AppInput
                      onChangeText={setTradeLocation}
                      placeholder="거래 지역을 입력해주세요"
                      value={tradeLocation}
                    />
                  </View>
                ) : null}
              </FieldCard>
            </>
          ) : null}

          {initialTab === 'review' ? (
            <>
              <FieldCard title="리뷰 종류" subtitle="경험한 서비스나 장소를 골라주세요">
                <ChipGroup onChange={setReviewCategory} value={reviewCategory} values={REVIEW_WRITE_CATEGORIES} />
                <Text style={styles.sectionLabel}>
                  대상
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
                <AppInput
                  leftElement={<AppIcon color={COLORS.primary} name="search-outline" size={18} />}
                  onChangeText={setReviewTarget}
                  placeholder={getReviewTargetPlaceholder(reviewCategory)}
                  value={reviewTarget}
                />
              </FieldCard>

              <FieldCard title="평점" subtitle="별점과 세부 만족도를 남겨주세요">
                <StarRating onChange={setReviewRating} value={reviewRating} />
                <View style={styles.scoreGrid}>
                  {[
                    [reviewScoreLabels[0], reviewKindness, setReviewKindness],
                    [reviewScoreLabels[1], reviewPriceScore, setReviewPriceScore],
                    [reviewScoreLabels[2], reviewRevisit, setReviewRevisit],
                  ].map(([label, value, setter]) => (
                    <Pressable
                      accessibilityRole="button"
                      key={label as string}
                      onPress={() => (setter as (value: number) => void)(((value as number) % 5) + 1)}
                      style={styles.scoreChip}
                    >
                      <Text style={styles.scoreLabel}>{label as string}</Text>
                      <Text style={styles.scoreValue}>{value as number}</Text>
                    </Pressable>
                  ))}
                </View>
              </FieldCard>

              <FieldCard icon="paw" title="리뷰 정보">
                <View style={styles.formRow}>
                  <FormLabel required title="제목" />
                  <AppInput
                    containerStyle={styles.formInput}
                    maxLength={MAX_TITLE_LENGTH}
                    onChangeText={setReviewTitle}
                    placeholder="제목을 입력해주세요"
                    value={reviewTitle}
                  />
                </View>
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>이용 날짜</Text>
                  <AppInput
                    containerStyle={styles.formInput}
                    leftElement={
                      <Pressable
                        accessibilityLabel="캘린더에서 이용 날짜 선택"
                        accessibilityRole="button"
                        hitSlop={SPACING.sm}
                        onPress={openReviewCalendar}
                        style={({ pressed }) => [styles.dateIconButton, pressed && styles.pressed]}
                      >
                        <AppIcon color={COLORS.primary} name="calendar-outline" size={18} />
                      </Pressable>
                    }
                    maxLength={10}
                    onChangeText={setReviewVisitedAt}
                    placeholder="2026.07.05"
                    value={reviewVisitedAt}
                  />
                </View>
              </FieldCard>

              <FieldCard required title="후기 내용" subtitle="좋았던 점과 아쉬웠던 점을 솔직하게 남겨주세요">
                <AppInput
                  inputStyle={styles.marketBodyInput}
                  maxLength={MAX_BODY_LENGTH}
                  multiline
                  onChangeText={setReviewBody}
                  placeholder="예) 진료 설명이 자세했고 대기 시간이 짧았어요. 비용 안내도 미리 받을 수 있어서 좋았어요."
                  value={reviewBody}
                />
                <Text style={styles.counter}>{reviewBody.length} / {MAX_BODY_LENGTH}</Text>
              </FieldCard>

              <FieldCard title="사진 첨부" subtitle="방문 사진이나 영수증을 선택할 수 있어요">
                <PhotoPickerRow
                  onAdd={() => void pickPhotos(reviewPhotos, setReviewPhotos)}
                  onMoveToFirst={(index) => movePhotoToFirst(reviewPhotos, setReviewPhotos, index)}
                  onRemove={(uri) => removePhoto(reviewPhotos, setReviewPhotos, uri)}
                  photos={reviewPhotos}
                />
              </FieldCard>
            </>
          ) : null}
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
      </ScreenLayout>

      {Platform.OS === 'ios' ? (
        <>
          <AppModal
            onClose={() => setExpiryCalendarVisible(false)}
            primaryAction={{
              label: '선택',
              onPress: () => {
                selectExpiryDate(pendingExpiryDate);
                setExpiryCalendarVisible(false);
              },
            }}
            secondaryAction={{
              label: '취소',
              onPress: () => setExpiryCalendarVisible(false),
            }}
            title="유통기한 선택"
            variant="center"
            visible={expiryCalendarVisible}
          >
            <DateTimePicker
              accentColor={COLORS.primary}
              display="inline"
              locale="ko-KR"
              minimumDate={getTomorrow()}
              mode="date"
              onChange={(_, date) => date && setPendingExpiryDate(date)}
              themeVariant="light"
              value={pendingExpiryDate}
            />
          </AppModal>
          <AppModal
            onClose={() => setReviewCalendarVisible(false)}
            primaryAction={{
              label: '선택',
              onPress: () => {
                selectReviewDate(pendingReviewDate);
                setReviewCalendarVisible(false);
              },
            }}
            secondaryAction={{
              label: '취소',
              onPress: () => setReviewCalendarVisible(false),
            }}
            title="이용 날짜 선택"
            variant="center"
            visible={reviewCalendarVisible}
          >
            <DateTimePicker
              accentColor={COLORS.primary}
              display="inline"
              locale="ko-KR"
              maximumDate={new Date()}
              mode="date"
              onChange={(_, date) => date && setPendingReviewDate(date)}
              themeVariant="light"
              value={pendingReviewDate}
            />
          </AppModal>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: SPACING.xxl,
    paddingTop: SPACING.xxxl,
  },
  submitPill: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  submitPillActive: {
    backgroundColor: COLORS.primary,
  },
  submitPillText: {
    ...TYPOGRAPHY.button,
    color: COLORS.primary,
  },
  submitPillTextActive: {
    color: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: 24,
    borderWidth: 1,
    gap: SPACING.xl,
    padding: SPACING.xxl,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  cardTitleText: {
    flex: 1,
    gap: SPACING.xxs,
  },
  cardTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
    fontSize: 15,
    lineHeight: 21,
  },
  requiredMark: {
    color: COLORS.danger,
  },
  cardSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  choiceChip: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    minWidth: 74,
    paddingHorizontal: SPACING.xl,
  },
  choiceChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  choiceChipText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray800,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  choiceChipTextActive: {
    color: COLORS.background,
  },
  multilineInput: {
    minHeight: 142,
  },
  marketBodyInput: {
    minHeight: 154,
  },
  counter: {
    ...TYPOGRAPHY.caption,
    alignSelf: 'flex-end',
    color: COLORS.gray500,
    marginTop: -SPACING.xl,
    paddingRight: SPACING.xl,
  },
  noticeLine: {
    ...TYPOGRAPHY.caption,
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.round,
    color: COLORS.gray800,
    overflow: 'hidden',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  photoRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  photoBox: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 54,
  },
  photoBoxPrimary: {
    borderColor: COLORS.primary,
  },
  photoPreview: {
    height: '100%',
    width: '100%',
  },
  coverBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    bottom: 4,
    left: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    position: 'absolute',
  },
  coverBadgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.background,
    fontSize: 10,
    lineHeight: 14,
  },
  photoGuide: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tagChip: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  tagChipActive: {
    backgroundColor: COLORS.primary,
  },
  tagChipText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
  },
  tagChipTextActive: {
    color: COLORS.background,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  customTagRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  customTagInput: {
    flex: 1,
  },
  tagAddButton: {
    minWidth: 74,
  },
  guideCard: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.borderBlue,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xl,
    padding: SPACING.xxl,
  },
  guideText: {
    flex: 1,
    gap: SPACING.xxs,
  },
  guideTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
    fontSize: 15,
    lineHeight: 21,
  },
  guideDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
    marginTop: SPACING.sm,
  },
  formRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  formLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
    paddingTop: 18,
    width: 68,
  },
  formInput: {
    flex: 1,
  },
  inlineLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  locationField: {
    gap: SPACING.sm,
  },
  priceRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  priceInput: {
    flex: 1,
  },
  unitText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray800,
  },
  offerChip: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderWidth: 1,
    borderRadius: RADIUS.round,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  offerChipActive: {
    backgroundColor: COLORS.primarySoft,
  },
  offerText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray800,
  },
  offerTextActive: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  starRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  starButton: {
    height: 32,
    justifyContent: 'center',
    position: 'relative',
    width: 32,
  },
  starHitArea: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: 16,
    zIndex: 1,
  },
  starHitAreaLeft: {
    left: 0,
  },
  starHitAreaRight: {
    right: 0,
  },
  ratingBadge: {
    alignItems: 'center',
    borderColor: COLORS.primary,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    minWidth: 70,
  },
  ratingBadgeText: {
    ...TYPOGRAPHY.button,
    color: COLORS.primary,
  },
  scoreGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  scoreChip: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  scoreLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  scoreValue: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
  },
  dateIconButton: {
    padding: SPACING.xxs,
  },
  pressed: {
    opacity: 0.65,
  },
});
