import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { type NavigationAction, useNavigation, usePreventRemove } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppButton,
  AppIcon,
  BrandPawLogo,
  EmptyState,
  LoadingView,
} from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { KeyboardAwareScrollView, ScreenLayout } from '@/src/components/layout';
import { AppModal, useAppAlert } from '@/src/components/modal';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import { usePetStore } from '@/src/features/pet/PetStore';

import {
  MARKET_TRADE_METHODS,
  MARKET_TRADE_TYPES,
  REVIEW_CATEGORIES,
  TALK_CATEGORIES,
} from '../communityData';
import { useCommunityStore } from '../CommunityStore';
import {
  getCommunityImageUri,
  persistCommunityImage,
  queueCommunityImageRemovals,
  removeCommunityImages,
} from '../services/communityImageStorage';
import { communityRepository } from '../services/communityRepository';
import type {
  CommunityImageAsset,
  CommunityPost,
  CommunityWriteDraft,
  MarketCategory,
  MarketPost,
  MarketTradeMethod,
  MarketTradeType,
  ReviewCategory,
  TalkCategory,
  TalkPost,
} from '../types';
import { createCommunityAuthor } from '../utils/author';
import {
  formatDateValue,
  isFutureDateValue,
  parseDateValue,
} from '../utils/date';
import {
  createMarketPriceLabel,
  getMarketTradeMethods,
  getPositiveMarketPrice,
  isValidMarketTradeMethodSelection,
} from '../utils/marketValidation';
import {
  REVIEW_BODY_MAX_LENGTH,
  REVIEW_TARGET_MAX_LENGTH,
  REVIEW_TITLE_MAX_LENGTH,
  getReviewInputValidationMessage,
  getReviewScoreLabels,
  getReviewTargetValidationMessage,
  getValidReviewInput,
  getValidReviewTarget,
} from '../utils/reviewValidation';

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
const TALK_TAG_SUGGESTIONS = ['피하수액', '응급', '동네병원', '산책', '고양이'];
const DEFAULT_TALK_TAGS: string[] = [];
const MAX_PHOTOS = 5;
const MAX_TITLE_LENGTH = 40;
const MAX_BODY_LENGTH = 500;
const MAX_TAG_COUNT = 5;
const MAX_TAG_LENGTH = 10;
const REVIEW_STAR_COLOR = COLORS.starWarm;
const PHOTO_SLOT_SIZE = 62;

type WriteTab = 'market' | 'review' | 'talk';
type ReviewWriteCategory = Exclude<ReviewCategory, '전체'>;

function getReviewTargetPlaceholder(category: ReviewWriteCategory) {
  if (category === '산책 장소') return '장소 이름을 입력해주세요';
  if (category === '병원') return '병원 이름을 입력해주세요';
  if (category === '용품샵') return '용품샵 이름을 입력해주세요';
  if (category === '미용실') return '미용실 이름을 입력해주세요';
  return '자유롭게 입력해주세요';
}

function resolveWriteTab(value?: string): WriteTab {
  if (value === 'market' || value === 'review' || value === 'talk') return value;
  return 'talk';
}

function getDefaultReviewDate() {
  return formatDateValue(new Date());
}

function formatDateInput(value: string) {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function parsePriceValue(value: string) {
  return value.replace(/[^0-9]/g, '');
}

function hasPriceOffer(value: string) {
  return value.includes('가격 제안 가능');
}

function normalizeTag(value: string) {
  return value.trim().replace(/^#+/, '').replace(/\s+/g, '');
}

function sameStringList(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function getEditableMarketTradeMethods(post: MarketPost): MarketTradeMethod[] {
  const methods = getMarketTradeMethods(post.tags);
  const compatibleMethods = post.tradeType === '나눔'
    ? methods
    : methods.filter((method) => method !== '비대면 나눔');
  if (compatibleMethods[0]) return [compatibleMethods[0]];
  return ['직거래'];
}

function hasWriteDraftContent(draft: CommunityWriteDraft, defaultMarketLocation = '') {
  if (draft.tab === 'talk') {
    return Boolean(
      draft.talkBody.trim() ||
        draft.talkTitle.trim() ||
        draft.talkPhotos.length ||
        draft.talkCategory !== '건강상담' ||
        !sameStringList(draft.talkTags, DEFAULT_TALK_TAGS),
    );
  }

  if (draft.tab === 'market') {
    return Boolean(
      draft.expiresAt.trim() ||
        draft.marketBody.trim() ||
        draft.marketCategory !== '사료·간식' ||
        draft.marketPhotos.length ||
        draft.price.trim() ||
        draft.priceOffer ||
        draft.productName.trim() ||
        draft.tradeLocation.trim() !== defaultMarketLocation.trim() ||
        !sameStringList(draft.tradeMethods, ['직거래']) ||
        draft.tradeType !== '나눔',
    );
  }

  return Boolean(
    draft.reviewBody.trim() ||
      draft.reviewCategory !== '병원' ||
      draft.reviewKindness !== 5 ||
      draft.reviewPhotos.length ||
      draft.reviewPriceScore !== 4 ||
      draft.reviewRating !== 5 ||
      draft.reviewRevisit !== 5 ||
      draft.reviewTarget.trim() ||
      draft.reviewTitle.trim() ||
      (draft.reviewVisitedAt.trim() && draft.reviewVisitedAt !== getDefaultReviewDate()),
  );
}

function FieldCard({
  brandPaw,
  children,
  icon,
  required,
  subtitle,
  title,
}: {
  brandPaw?: boolean;
  children: ReactNode;
  icon?: Parameters<typeof AppIcon>[0]['name'];
  required?: boolean;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        {brandPaw || icon ? (
          <View style={styles.cardIcon}>
            {brandPaw ? (
              <BrandPawLogo size={20} />
            ) : icon ? (
              <AppIcon color={COLORS.primary} name={icon} size={18} />
            ) : null}
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
  onRemove,
  onReorder,
  photos,
}: {
  maxCount?: number;
  onAdd: () => void;
  onRemove: (uri: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  photos: CommunityImageAsset[];
}) {
  return (
    <>
      <View style={styles.photoRow}>
        {Array.from({ length: maxCount }).map((_, index) => {
          const image = photos[index];
          const uri = image ? getCommunityImageUri(image) : undefined;

          return (
            <DraggablePhotoBox
              key={image?.assetId ?? index}
              index={index}
              maxPhotoIndex={Math.max(photos.length - 1, 0)}
              onAdd={onAdd}
              onRemove={onRemove}
              onReorder={onReorder}
              uri={uri}
            />
          );
        })}
      </View>
      <Text style={styles.photoGuide}>첫 번째 사진이 대표 이미지예요. 사진을 좌우로 드래그해 순서를 바꿀 수 있어요.</Text>
    </>
  );
}

function DraggablePhotoBox({
  index,
  maxPhotoIndex,
  onAdd,
  onRemove,
  onReorder,
  uri,
}: {
  index: number;
  maxPhotoIndex: number;
  onAdd: () => void;
  onRemove: (uri: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  uri?: string;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const panResponder = useMemo(
    () => {
      const shouldStartDrag = (_: unknown, gesture: { dx: number; dy: number }) =>
        Boolean(uri) &&
        Math.abs(gesture.dx) > 4 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy);

      return PanResponder.create({
        onMoveShouldSetPanResponder: shouldStartDrag,
        onMoveShouldSetPanResponderCapture: shouldStartDrag,
        onPanResponderGrant: () => {
          setDragging(true);
          setDragX(0);
        },
        onPanResponderMove: (_, gesture) => {
          setDragX(gesture.dx);
        },
        onPanResponderRelease: (_, gesture) => {
          const offset =
            gesture.dx > 0
              ? Math.floor((gesture.dx + PHOTO_SLOT_SIZE * 0.35) / PHOTO_SLOT_SIZE)
              : Math.ceil((gesture.dx - PHOTO_SLOT_SIZE * 0.35) / PHOTO_SLOT_SIZE);
          const nextIndex = Math.min(Math.max(index + offset, 0), maxPhotoIndex);
          setDragging(false);
          setDragX(0);

          if (nextIndex !== index) {
            onReorder(index, nextIndex);
          }
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          setDragX(0);
        },
      });
    },
    [index, maxPhotoIndex, onReorder, uri],
  );

  if (!uri) {
    return (
      <Pressable
        accessibilityLabel={`사진 ${index + 1} 첨부`}
        accessibilityRole="button"
        onPress={onAdd}
        style={({ pressed }) => [
          styles.photoBox,
          index === 0 && styles.photoBoxPrimary,
          pressed && styles.pressed,
        ]}
      >
        <AppIcon
          color={COLORS.primary}
          name={index === 0 ? 'camera-outline' : 'add'}
          size={index === 0 ? 22 : 24}
        />
      </Pressable>
    );
  }

  return (
    <View
      accessibilityActions={[
        ...(index > 0 ? [{ name: 'decrement', label: '앞으로 이동' }] : []),
        ...(index < maxPhotoIndex ? [{ name: 'increment', label: '뒤로 이동' }] : []),
        { name: 'deletePhoto', label: '사진 삭제' },
      ]}
      accessibilityHint="좌우로 드래그해 사진 순서를 변경할 수 있습니다."
      accessibilityLabel={`사진 ${index + 1}`}
      accessibilityRole="adjustable"
      accessibilityValue={{
        max: maxPhotoIndex + 1,
        min: 1,
        now: index + 1,
        text: index === 0 ? '대표 이미지' : `${index + 1}번째 이미지`,
      }}
      accessible
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'decrement' && index > 0) {
          onReorder(index, index - 1);
        }
        if (event.nativeEvent.actionName === 'increment' && index < maxPhotoIndex) {
          onReorder(index, index + 1);
        }
        if (event.nativeEvent.actionName === 'deletePhoto') {
          onRemove(uri);
        }
      }}
      style={[
        styles.photoBox,
        index === 0 && styles.photoBoxPrimary,
        dragging && styles.photoBoxDragging,
        { transform: [{ translateX: dragX }] },
      ]}
      {...panResponder.panHandlers}
    >
      <Image source={{ uri }} style={styles.photoPreview} />
      {index === 0 ? (
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>대표</Text>
        </View>
      ) : null}
      <Pressable
        accessible={false}
        onPress={() => onRemove(uri)}
        style={({ pressed }) => [styles.photoRemoveButton, pressed && styles.pressed]}
      >
        <View style={styles.photoRemoveIcon}>
          <AppIcon color={COLORS.background} name="close" size={12} />
        </View>
      </Pressable>
    </View>
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
                accessibilityState={{ selected: value === score - 0.5 }}
                onPress={() => onChange(score - 0.5)}
                style={({ pressed }) => [styles.starHitArea, styles.starHitAreaLeft, pressed && styles.pressed]}
              />
              <Pressable
                accessibilityLabel={`${score}점`}
                accessibilityRole="button"
                accessibilityState={{ selected: value === score }}
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
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const showAlert = useAppAlert();
  const { origin, postId, type } = useLocalSearchParams<{
    origin?: string;
    postId?: string;
    type?: string;
  }>();
  const initialTab = resolveWriteTab(type);
  const {
    addMarketPost,
    addReviewPost,
    addTalkPost,
    getPostById,
    getReviewPostById,
    hasLoadError,
    isReady,
    posts,
    reloadCommunity,
    reviewPosts,
    updateMarketPost,
    updateReviewPost,
    updateTalkPost,
    viewerId,
  } = useCommunityStore();
  const { profile } = useMyPageStore();
  const { selectedPet } = usePetStore();
  const author = useMemo(
    () => createCommunityAuthor(profile, selectedPet, viewerId),
    [profile, selectedPet, viewerId],
  );
  const reviewPostToEdit = useMemo(
    () => initialTab === 'review' && postId
      ? reviewPosts.find((post) => post.id === postId) ?? null
      : null,
    [initialTab, postId, reviewPosts],
  );
  const postToEdit = useMemo<CommunityPost | null>(
    () => initialTab !== 'review' && postId
      ? posts.find((post) => post.id === postId) ?? null
      : null,
    [initialTab, postId, posts],
  );
  const talkPostToEdit = postToEdit?.kind === 'talk' ? postToEdit : null;
  const marketPostToEdit = postToEdit?.kind === 'market' ? postToEdit : null;
  const isTalkEditRequested = initialTab === 'talk' && Boolean(postId);
  const isMarketEditRequested = initialTab === 'market' && Boolean(postId);
  const isReviewEditRequested = initialTab === 'review' && Boolean(postId);
  const isEditRequested = isTalkEditRequested || isMarketEditRequested || isReviewEditRequested;
  const isTalkEditMode = Boolean(talkPostToEdit?.author.userId === viewerId);
  const isMarketEditMode = Boolean(marketPostToEdit?.author.userId === viewerId);
  const isReviewEditMode = Boolean(reviewPostToEdit?.author.userId === viewerId);
  const isEditMode = isTalkEditMode || isMarketEditMode || isReviewEditMode;
  const [submitting, setSubmitting] = useState(false);

  const [talkCategory, setTalkCategory] = useState<Exclude<TalkCategory, '전체'>>('건강상담');
  const [talkTitle, setTalkTitle] = useState('');
  const [talkBody, setTalkBody] = useState('');
  const [talkPhotos, setTalkPhotos] = useState<CommunityImageAsset[]>([]);
  const [talkTags, setTalkTags] = useState<string[]>(DEFAULT_TALK_TAGS);
  const [customTag, setCustomTag] = useState('');

  const [tradeType, setTradeType] = useState<MarketTradeType>('나눔');
  const [marketCategory, setMarketCategory] = useState<Exclude<MarketCategory, '전체'>>('사료·간식');
  const [marketPhotos, setMarketPhotos] = useState<CommunityImageAsset[]>([]);
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [priceOffer, setPriceOffer] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [expiryCalendarVisible, setExpiryCalendarVisible] = useState(false);
  const [pendingExpiryDate, setPendingExpiryDate] = useState(getTomorrow);
  const [marketBody, setMarketBody] = useState('');
  const [tradeMethods, setTradeMethods] = useState<MarketTradeMethod[]>(['직거래']);
  const [tradeLocation, setTradeLocation] = useState(profile?.location ?? '');

  const [reviewCategory, setReviewCategory] = useState<Exclude<ReviewCategory, '전체'>>('병원');
  const [reviewTarget, setReviewTarget] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewKindness, setReviewKindness] = useState(5);
  const [reviewPriceScore, setReviewPriceScore] = useState(4);
  const [reviewRevisit, setReviewRevisit] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewVisitedAt, setReviewVisitedAt] = useState(getDefaultReviewDate);
  const [reviewCalendarVisible, setReviewCalendarVisible] = useState(false);
  const [pendingReviewDate, setPendingReviewDate] = useState(() => new Date());
  const [reviewBody, setReviewBody] = useState('');
  const [reviewPhotos, setReviewPhotos] = useState<CommunityImageAsset[]>([]);
  const reviewScoreLabels = getReviewScoreLabels(reviewCategory);
  const originalImageIds = useMemo(() => {
    if (talkPostToEdit?.images) return new Set(talkPostToEdit.images.map((image) => image.assetId));
    if (marketPostToEdit?.images) return new Set(marketPostToEdit.images.map((image) => image.assetId));
    if (reviewPostToEdit?.images) return new Set(reviewPostToEdit.images.map((image) => image.assetId));
    return new Set<string>();
  }, [marketPostToEdit?.images, reviewPostToEdit?.images, talkPostToEdit?.images]);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [pendingExitAction, setPendingExitAction] = useState<NavigationAction | null>(null);
  const [manualExitPending, setManualExitPending] = useState(false);
  const [pendingSubmittedPostId, setPendingSubmittedPostId] = useState<string | null>(null);
  const draftCompleted = useRef(false);
  const allowNavigation = useRef(false);
  const submitLock = useRef(false);
  const appliedEditRequestKey = useRef<string | null>(null);
  const defaultMarketLocation = profile?.location ?? '';
  const editRequestKey =
    isEditRequested && postId ? `${initialTab}:${postId}:${viewerId}` : null;

  const currentDraft = useMemo<CommunityWriteDraft>(() => {
    const updatedAt = new Date().toISOString();

    if (initialTab === 'market') {
      return {
        ...(isMarketEditMode && postId ? { editPostId: postId } : {}),
        expiresAt,
        id: isMarketEditMode && postId ? `edit-${initialTab}-${postId}` : `write-${initialTab}`,
        marketBody,
        marketCategory,
        marketPhotos,
        price,
        priceOffer,
        productName,
        tab: 'market',
        tradeLocation,
        tradeMethods,
        tradeType,
        updatedAt,
        userId: viewerId,
      };
    }

    if (initialTab === 'review') {
      return {
        ...(isReviewEditMode && postId ? { editPostId: postId } : {}),
        id: isReviewEditMode && postId ? `edit-${initialTab}-${postId}` : `write-${initialTab}`,
        reviewBody,
        reviewCategory,
        reviewKindness,
        reviewPhotos,
        reviewPriceScore,
        reviewRating,
        reviewRevisit,
        reviewTarget,
        reviewTitle,
        reviewVisitedAt,
        tab: 'review',
        updatedAt,
        userId: viewerId,
      };
    }

    return {
      ...(isTalkEditMode && postId ? { editPostId: postId } : {}),
      id: isTalkEditMode && postId ? `edit-${initialTab}-${postId}` : `write-${initialTab}`,
      tab: 'talk',
      talkBody,
      talkCategory,
      talkPhotos,
      talkTags,
      talkTitle,
      updatedAt,
      userId: viewerId,
    };
  }, [
    expiresAt,
    initialTab,
    isMarketEditMode,
    isReviewEditMode,
    isTalkEditMode,
    marketBody,
    marketCategory,
    marketPhotos,
    price,
    priceOffer,
    productName,
    postId,
    reviewBody,
    reviewCategory,
    reviewKindness,
    reviewPhotos,
    reviewPriceScore,
    reviewRating,
    reviewRevisit,
    reviewTarget,
    reviewTitle,
    reviewVisitedAt,
    talkBody,
    talkCategory,
    talkPhotos,
    talkTags,
    talkTitle,
    tradeLocation,
    tradeMethods,
    tradeType,
    viewerId,
  ]);
  const isReviewEditDirty = Boolean(
    isReviewEditMode &&
      reviewPostToEdit &&
      (
        reviewRating !== reviewPostToEdit.rating ||
        reviewKindness !== (reviewPostToEdit.detailScores?.kindness ?? 5) ||
        reviewPriceScore !== (reviewPostToEdit.detailScores?.price ?? 4) ||
        reviewRevisit !== (reviewPostToEdit.detailScores?.revisit ?? 5) ||
        reviewTitle !== reviewPostToEdit.title ||
        reviewVisitedAt !== (reviewPostToEdit.visitedAt ?? '') ||
        reviewBody !== reviewPostToEdit.body ||
        reviewPhotos.map((image) => image.assetId).join('|') !==
          (reviewPostToEdit.images ?? []).map((image) => image.assetId).join('|')
      ),
  );
  const isTalkEditDirty = Boolean(
    isTalkEditMode &&
      talkPostToEdit &&
      (
        talkCategory !== talkPostToEdit.category ||
        talkTitle !== talkPostToEdit.title ||
        talkBody !== talkPostToEdit.body ||
        !sameStringList(talkTags, talkPostToEdit.tags) ||
        talkPhotos.map((image) => image.assetId).join('|') !==
          (talkPostToEdit.images ?? []).map((image) => image.assetId).join('|')
      ),
  );
  const isMarketEditDirty = Boolean(
    isMarketEditMode &&
      marketPostToEdit &&
      (
        tradeType !== marketPostToEdit.tradeType ||
        marketCategory !== marketPostToEdit.category ||
        productName !== marketPostToEdit.title ||
        price !== parsePriceValue(marketPostToEdit.priceLabel) ||
        priceOffer !== hasPriceOffer(marketPostToEdit.priceLabel) ||
        expiresAt !== (marketPostToEdit.expiresAt ?? '') ||
        marketBody !== marketPostToEdit.body ||
        tradeLocation !== marketPostToEdit.location ||
        !sameStringList(tradeMethods, getEditableMarketTradeMethods(marketPostToEdit)) ||
        marketPhotos.map((image) => image.assetId).join('|') !==
          (marketPostToEdit.images ?? []).map((image) => image.assetId).join('|')
      ),
  );
  const isDirty = isDraftReady &&
    (isEditMode
      ? isTalkEditDirty || isMarketEditDirty || isReviewEditDirty
      : hasWriteDraftContent(currentDraft, defaultMarketLocation));
  const performBack = useCallback(() => {
    if ((origin === 'community' || origin === 'detail') && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace({ pathname: '/community', params: { tab: initialTab } });
  }, [initialTab, origin, router]);
  const goBack = useCallback(() => {
    if (submitLock.current || submitting) return;
    if (pendingSubmittedPostId) {
      showAlert('게시글은 저장됐어요', '화면을 이동하지 못했어요. 등록 버튼을 다시 눌러주세요.');
      return;
    }

    if (isDirty) {
      setManualExitPending(true);
      return;
    }

    performBack();
  }, [isDirty, pendingSubmittedPostId, performBack, showAlert, submitting]);

  const applyDraft = useCallback((draft: CommunityWriteDraft) => {
    if (draft.tab === 'talk') {
      setTalkCategory(draft.talkCategory);
      setTalkTitle(draft.talkTitle);
      setTalkBody(draft.talkBody);
      setTalkPhotos(draft.talkPhotos);
      setTalkTags(draft.talkTags);
      return;
    }

    if (draft.tab === 'market') {
      setTradeType(draft.tradeType);
      setMarketCategory(draft.marketCategory);
      setMarketPhotos(draft.marketPhotos);
      setProductName(draft.productName);
      setPrice(draft.price);
      setPriceOffer(draft.priceOffer);
      setExpiresAt(draft.expiresAt);
      setMarketBody(draft.marketBody);
      const methods = draft.tradeMethods
        .filter((method): method is MarketTradeMethod =>
          MARKET_TRADE_METHODS.includes(method) &&
          (draft.tradeType === '나눔' || method !== '비대면 나눔'),
        )
        .slice(0, 1);
      setTradeMethods(methods.length ? methods : ['직거래']);
      setTradeLocation(draft.tradeLocation);
      return;
    }

    setReviewCategory(draft.reviewCategory);
    setReviewTarget(draft.reviewTarget);
    setReviewRating(draft.reviewRating);
    setReviewKindness(draft.reviewKindness);
    setReviewPriceScore(draft.reviewPriceScore);
    setReviewRevisit(draft.reviewRevisit);
    setReviewTitle(draft.reviewTitle);
    setReviewVisitedAt(draft.reviewVisitedAt);
    setReviewBody(draft.reviewBody);
    setReviewPhotos(draft.reviewPhotos);
  }, []);

  const applyTalkPost = useCallback((post: TalkPost) => {
    setTalkCategory(post.category);
    setTalkTitle(post.title);
    setTalkBody(post.body);
    setTalkPhotos(post.images ?? []);
    setTalkTags(post.tags);
  }, []);

  const applyMarketPost = useCallback((post: MarketPost) => {
    setTradeType(post.tradeType);
    setMarketCategory(post.category);
    setMarketPhotos(post.images ?? []);
    setProductName(post.title);
    setPrice(parsePriceValue(post.priceLabel));
    setPriceOffer(hasPriceOffer(post.priceLabel));
    setExpiresAt(post.expiresAt ?? '');
    setMarketBody(post.body);
    setTradeMethods(getEditableMarketTradeMethods(post));
    setTradeLocation(post.location);
  }, []);

  const applyReviewPost = useCallback((post: NonNullable<typeof reviewPostToEdit>) => {
    setReviewCategory(post.category);
    setReviewTarget(post.targetName ?? '');
    setReviewRating(post.rating);
    setReviewKindness(post.detailScores?.kindness ?? 5);
    setReviewPriceScore(post.detailScores?.price ?? 4);
    setReviewRevisit(post.detailScores?.revisit ?? 5);
    setReviewTitle(post.title);
    setReviewVisitedAt(post.visitedAt ?? '');
    setReviewBody(post.body);
    setReviewPhotos(post.images ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    if (editRequestKey && appliedEditRequestKey.current === editRequestKey) return undefined;
    if (!editRequestKey) appliedEditRequestKey.current = null;
    if (!isReady || hasLoadError) return undefined;

    setIsDraftReady(false);
    draftCompleted.current = false;
    allowNavigation.current = false;

    const requestedPost = postId ? getPostById(postId) : null;
    const requestedReviewPost = postId ? getReviewPostById(postId) : null;
    let ownsRequestedPost = false;
    if (isTalkEditRequested) {
      if (requestedPost?.kind === 'talk' && requestedPost.author.userId === viewerId) {
        applyTalkPost(requestedPost);
        ownsRequestedPost = true;
      }
    } else if (isMarketEditRequested) {
      if (requestedPost?.kind === 'market' && requestedPost.author.userId === viewerId) {
        applyMarketPost(requestedPost);
        ownsRequestedPost = true;
      }
    } else if (isReviewEditRequested) {
      if (requestedReviewPost?.author.userId === viewerId) {
        applyReviewPost(requestedReviewPost);
        ownsRequestedPost = true;
      }
    }

    if (isEditRequested) {
      if (!ownsRequestedPost || !postId) {
        if (postId) {
          void communityRepository
            .discardWriteDraft(viewerId, initialTab, postId)
            .catch(() => undefined);
        }
        setIsDraftReady(true);
        return () => {
          active = false;
        };
      }

      appliedEditRequestKey.current = editRequestKey;
      communityRepository
        .loadWriteDraft(viewerId, initialTab, postId)
        .then((draft) => {
          if (!active || !draft) return;
          applyDraft(draft);
          if (isReviewEditRequested && requestedReviewPost) {
            setReviewCategory(requestedReviewPost.category);
            setReviewTarget(requestedReviewPost.targetName ?? '');
          }
        })
        .finally(() => {
          if (active) setIsDraftReady(true);
        });

      return () => {
        active = false;
      };
    }

    communityRepository
      .loadWriteDraft(viewerId, initialTab)
      .then((draft) => {
        if (!active) return;
        if (draft) applyDraft(draft);
      })
      .finally(() => {
        if (active) setIsDraftReady(true);
      });

    return () => {
      active = false;
    };
  }, [
    applyDraft,
    applyMarketPost,
    applyReviewPost,
    applyTalkPost,
    editRequestKey,
    getPostById,
    getReviewPostById,
    hasLoadError,
    initialTab,
    isEditRequested,
    isReady,
    isMarketEditRequested,
    isReviewEditRequested,
    isTalkEditRequested,
    postId,
    viewerId,
  ]);

  useEffect(() => {
    if (
      !isDraftReady ||
      draftCompleted.current ||
      (isEditRequested && !isEditMode)
    ) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      if (draftCompleted.current) return;

      const shouldSave = isEditMode
        ? isDirty
        : hasWriteDraftContent(currentDraft, defaultMarketLocation);

      if (shouldSave) {
        void communityRepository.saveWriteDraft(currentDraft).catch(() => undefined);
        return;
      }

      void communityRepository
        .deleteWriteDraft(viewerId, initialTab, isEditMode ? postId : undefined)
        .catch(() => undefined);
    }, 220);

    return () => clearTimeout(timeout);
  }, [
    currentDraft,
    defaultMarketLocation,
    initialTab,
    isDirty,
    isDraftReady,
    isEditMode,
    isEditRequested,
    postId,
    viewerId,
  ]);

  usePreventRemove(isDirty || submitting || Boolean(pendingSubmittedPostId), ({ data }) => {
    if (allowNavigation.current) {
      navigation.dispatch(data.action);
      return;
    }

    if (submitting) return;
    if (pendingSubmittedPostId) {
      showAlert('게시글은 저장됐어요', '화면을 이동하지 못했어요. 등록 버튼을 다시 눌러주세요.');
      return;
    }

    setManualExitPending(false);
    setPendingExitAction(data.action);
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });

    return () => subscription.remove();
  }, [goBack]);

  const discardDraftAndLeave = useCallback(() => {
    if (pendingSubmittedPostId) {
      showAlert('게시글은 저장됐어요', '화면을 이동하지 못했어요. 등록 버튼을 다시 눌러주세요.');
      return;
    }

    const exitAction = pendingExitAction;
    const shouldPerformManualExit = manualExitPending;
    if (!exitAction && !shouldPerformManualExit) return;

    setPendingExitAction(null);
    setManualExitPending(false);
    void (async () => {
      draftCompleted.current = true;
      try {
        const photos = initialTab === 'talk'
          ? talkPhotos
          : initialTab === 'market'
            ? marketPhotos
            : reviewPhotos;
        await communityRepository.discardWriteDraft(
          viewerId,
          initialTab,
          isEditMode ? postId : undefined,
        );
        await removeCommunityImages(
          viewerId,
          isEditMode
            ? photos.filter((image) => !originalImageIds.has(image.assetId))
            : photos,
        );
      } catch {
        draftCompleted.current = false;
        setPendingExitAction(exitAction);
        setManualExitPending(shouldPerformManualExit);
        showAlert('작성 화면을 종료하지 못했어요', '잠시 후 다시 시도해주세요.');
        return;
      }
      allowNavigation.current = true;
      setIsDraftReady(false);
      setTimeout(() => {
        if (exitAction) {
          navigation.dispatch(exitAction);
          return;
        }
        performBack();
      }, 0);
    })();
  }, [
    initialTab,
    isEditMode,
    manualExitPending,
    marketPhotos,
    navigation,
    originalImageIds,
    pendingExitAction,
    pendingSubmittedPostId,
    performBack,
    postId,
    reviewPhotos,
    showAlert,
    talkPhotos,
    viewerId,
  ]);

  const pickPhotos = async (
    photos: CommunityImageAsset[],
    setPhotos: (photos: CommunityImageAsset[]) => void,
    maxCount = MAX_PHOTOS,
  ) => {
    if (photos.length >= maxCount) return;

    try {
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showAlert('사진 접근 권한이 필요해요', '설정에서 사진 접근 권한을 허용해주세요.', [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => void Linking.openSettings() },
          ]);
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        defaultTab: 'photos',
        mediaTypes: ['images'],
        quality: 0.85,
        selectionLimit: maxCount - photos.length,
      });
      if (result.canceled) return;

      const persistedImages: CommunityImageAsset[] = [];
      try {
        for (const asset of result.assets.slice(0, maxCount - photos.length)) {
          persistedImages.push(await persistCommunityImage(viewerId, asset.uri));
        }
      } catch (error) {
        await removeCommunityImages(viewerId, persistedImages).catch(() => undefined);
        throw error;
      }
      const nextPhotos = [
        ...photos,
        ...persistedImages,
      ].slice(0, maxCount);
      setPhotos(nextPhotos);
    } catch {
      showAlert('사진을 불러오지 못했어요', '잠시 후 다시 시도해주세요.');
    }
  };

  const removePhoto = (
    photos: CommunityImageAsset[],
    setPhotos: (photos: CommunityImageAsset[]) => void,
    uri: string,
  ) => {
    const target = photos.find((photo) => getCommunityImageUri(photo) === uri);
    if (target && (!isEditMode || !originalImageIds.has(target.assetId))) {
      void queueCommunityImageRemovals(viewerId, [target]).catch(() => undefined);
    }
    setPhotos(photos.filter((photo) => getCommunityImageUri(photo) !== uri));
  };

  const reorderPhotos = (
    photos: CommunityImageAsset[],
    setPhotos: (photos: CommunityImageAsset[]) => void,
    fromIndex: number,
    toIndex: number,
  ) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= photos.length ||
      toIndex >= photos.length
    ) {
      return;
    }

    const nextPhotos = [...photos];
    const [selectedPhoto] = nextPhotos.splice(fromIndex, 1);
    nextPhotos.splice(toIndex, 0, selectedPhoto);
    setPhotos(nextPhotos);
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
  const availableTradeMethods = tradeType === '나눔'
    ? MARKET_TRADE_METHODS
    : MARKET_TRADE_METHODS.filter((method) => method !== '비대면 나눔');
  const hasValidTradeMethods = isValidMarketTradeMethodSelection(tradeType, tradeMethods);
  const marketPrice = getPositiveMarketPrice(price);
  const marketNeedsLocation = tradeMethods.includes('직거래') || tradeMethods.includes('비대면 나눔');
  const hasInvalidExpiry = Boolean(expiresAt.trim() && !isFutureDateValue(expiresAt));
  const reviewInput = getValidReviewInput({
    body: reviewBody,
    detailScores: {
      kindness: reviewKindness,
      price: reviewPriceScore,
      revisit: reviewRevisit,
    },
    rating: reviewRating,
    title: reviewTitle,
    visitedAt: reviewVisitedAt,
  });
  const normalizedReviewTarget = getValidReviewTarget(reviewTarget);
  const reviewValidationMessage =
    getReviewTargetValidationMessage(reviewTarget) ??
    getReviewInputValidationMessage({
      body: reviewBody,
      detailScores: {
        kindness: reviewKindness,
        price: reviewPriceScore,
        revisit: reviewRevisit,
      },
      rating: reviewRating,
      title: reviewTitle,
      visitedAt: reviewVisitedAt,
    });
  const canSubmitMarket = Boolean(
    productName.trim() &&
      marketBody.trim() &&
      (!marketNeedsPhoto || marketPhotos.length > 0) &&
      (!marketNeedsPrice || marketPrice) &&
      hasValidTradeMethods &&
      !hasInvalidExpiry &&
      (!marketNeedsLocation || tradeLocation.trim()),
  );
  const canSubmitReview = reviewValidationMessage === null;
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
      if (marketNeedsPrice && !marketPrice) return '가격은 0원보다 크게 입력해주세요.';
      if (hasInvalidExpiry) {
        return '유통기한은 오늘 이후 날짜로 입력해주세요.';
      }
      if (!marketBody.trim()) return '상세 설명을 입력해주세요.';
      if (!hasValidTradeMethods) return '거래 방법을 선택해주세요.';
      if (marketNeedsLocation && !tradeLocation.trim()) return '거래 지역을 입력해주세요.';
      return null;
    }

    return reviewValidationMessage;
  };

  const openSubmittedPost = (savedPostId: string) => {
    allowNavigation.current = true;

    if (isEditMode && origin === 'detail' && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace({
      pathname: '/community/[postId]',
      params: {
        ...(origin === 'community' ? { origin: 'community' } : {}),
        ...(origin === 'community' && !isEditMode ? { focusOnReturn: '1' } : {}),
        postId: savedPostId,
      },
    });
  };

  const finalizeSubmittedPost = async (savedPostId: string) => {
    setPendingSubmittedPostId(savedPostId);
    draftCompleted.current = true;

    try {
      await communityRepository.deleteWriteDraft(
        viewerId,
        initialTab,
        isEditMode ? postId : undefined,
      );
      openSubmittedPost(savedPostId);
      setPendingSubmittedPostId(null);
      return true;
    } catch {
      showAlert(
        '게시글은 저장됐어요',
        '화면을 이동하지 못했어요. 등록 버튼을 다시 눌러주세요.',
      );
      return false;
    }
  };

  const submit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;

    if (pendingSubmittedPostId) {
      setSubmitting(true);
      try {
        await finalizeSubmittedPost(pendingSubmittedPostId);
      } finally {
        submitLock.current = false;
        setSubmitting(false);
      }
      return;
    }

    const blockMessage = getSubmitBlockMessage();
    if (blockMessage) {
      showAlert('필수 항목을 확인해주세요', blockMessage);
      submitLock.current = false;
      return;
    }

    setSubmitting(true);

    try {
      if (isEditMode) {
        try {
          await communityRepository.saveWriteDraft(currentDraft);
        } catch {
          showAlert('작성 내용을 저장하지 못했어요', '잠시 후 다시 시도해주세요.');
          return;
        }
      }

      if (initialTab === 'talk') {
        if (isTalkEditMode && postId) {
          const result = await updateTalkPost(postId, {
            body: talkBody,
            category: talkCategory,
            images: talkPhotos,
            showNeighborhood: true,
            tags: talkTags,
            title: talkTitle,
          });
          if (result.ok) {
            await finalizeSubmittedPost(postId);
            return;
          }

          await communityRepository.saveWriteDraft(currentDraft).catch(() => undefined);
          showAlert('저장하지 못했어요', '입력 내용을 다시 확인해주세요.');
          return;
        }

        const result = await addTalkPost({
          author,
          baseBookmarkCount: 0,
          baseReactionCounts: { like: 0 },
          body: talkBody,
          category: talkCategory,
          images: talkPhotos,
          showNeighborhood: true,
          tags: talkTags,
          title: talkTitle,
        });
        if (result.ok && result.postId) {
          await finalizeSubmittedPost(result.postId);
          return;
        }

        showAlert('등록하지 못했어요', '입력 내용을 다시 확인해주세요.');
        return;
      }

      if (initialTab === 'market') {
        const resolvedPrice = createMarketPriceLabel(tradeType, price, priceOffer);
        if (!resolvedPrice) {
          showAlert('필수 항목을 확인해주세요', '가격은 0원보다 크게 입력해주세요.');
          return;
        }
        const marketPayload = {
          body: marketBody,
          category: marketCategory,
          expiresAt: expiresAt.trim() || undefined,
          images: marketPhotos,
          imageCount: marketPhotos.length,
          location: marketNeedsLocation
            ? tradeLocation.trim() || profile?.location || '지역 미설정'
            : '지역 미설정',
          priceLabel: resolvedPrice,
          tags: [marketCategory, tradeType, ...tradeMethods],
          title: productName,
          tradeType,
        };
        if (isMarketEditMode && postId) {
          const result = await updateMarketPost(postId, marketPayload);
          if (result.ok) {
            await finalizeSubmittedPost(postId);
            return;
          }

          await communityRepository.saveWriteDraft(currentDraft).catch(() => undefined);
          showAlert('저장하지 못했어요', '입력 내용을 다시 확인해주세요.');
          return;
        }

        const result = await addMarketPost({
          ...marketPayload,
          author,
          baseBookmarkCount: 0,
          status: '진행 중',
        });
        if (result.ok && result.postId) {
          await finalizeSubmittedPost(result.postId);
          return;
        }

        showAlert('등록하지 못했어요', '입력 내용을 다시 확인해주세요.');
        return;
      }

      if (!reviewInput || !normalizedReviewTarget) {
        showAlert('필수 항목을 확인해주세요', '리뷰 입력 내용을 다시 확인해주세요.');
        return;
      }

      const reviewPayload = {
        body: reviewInput.body,
        detailScores: {
          kindness: reviewKindness,
          price: reviewPriceScore,
          revisit: reviewRevisit,
        },
        images: reviewPhotos,
        rating: reviewRating,
        title: reviewInput.title,
        visitedAt: reviewInput.visitedAt,
      };
      if (isReviewEditMode && postId) {
        const result = await updateReviewPost(postId, reviewPayload);
        if (result.ok) {
          await finalizeSubmittedPost(postId);
          return;
        }

        await communityRepository.saveWriteDraft(currentDraft).catch(() => undefined);
        showAlert('저장하지 못했어요', '입력 내용을 다시 확인해주세요.');
        return;
      }

      const result = await addReviewPost({
        ...reviewPayload,
        author,
        baseReactionCounts: { helpful: 0, notHelpful: 0 },
        category: reviewCategory,
        targetName: normalizedReviewTarget,
      });
      if (result.ok && result.postId) {
        await finalizeSubmittedPost(result.postId);
        return;
      }

      showAlert('등록하지 못했어요', '입력 내용을 다시 확인해주세요.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const title =
    isTalkEditMode
      ? '소통 수정'
      : isMarketEditMode
        ? '장터 수정'
        : isReviewEditMode
      ? '리뷰 수정'
      : initialTab === 'market'
      ? '장터 글쓰기'
      : initialTab === 'review'
        ? '리뷰 글쓰기'
        : '소통 글쓰기';
  const submitLabel = pendingSubmittedPostId ? '다시 시도' : isEditMode ? '저장' : '등록';
  const submitReady = canSubmit || Boolean(pendingSubmittedPostId);

  if (!isReady) {
    return (
      <ScreenLayout
        headerFullWidth
        headerVariant="auth"
        leftAccessibilityLabel="커뮤니티로 돌아가기"
        onLeftPress={goBack}
        title="커뮤니티"
      >
        <LoadingView label="게시글을 불러오고 있어요" />
      </ScreenLayout>
    );
  }

  if (hasLoadError) {
    return (
      <ScreenLayout
        headerFullWidth
        headerVariant="auth"
        leftAccessibilityLabel="커뮤니티로 돌아가기"
        onLeftPress={goBack}
        title="커뮤니티"
      >
        <EmptyState
          actionLabel="다시 시도"
          description="잠시 후 다시 글쓰기를 열어주세요."
          icon={<AppIcon color={COLORS.primary} name="chatbubbles-outline" size={32} />}
          onActionPress={() => void reloadCommunity()}
          title="게시글을 불러오지 못했어요."
        />
      </ScreenLayout>
    );
  }

  if (isEditRequested && !isEditMode && isDraftReady) {
    return (
      <ScreenLayout
        headerFullWidth
        headerVariant="auth"
        leftAccessibilityLabel="커뮤니티로 돌아가기"
        onLeftPress={goBack}
        title="커뮤니티"
      >
        <EmptyState
          description="이미 삭제되었거나 수정할 수 없는 게시글이에요."
          icon={<AppIcon color={COLORS.primary} name="alert-circle-outline" size={32} />}
          title="게시글을 찾을 수 없어요"
        />
      </ScreenLayout>
    );
  }

  return (
    <>
      <ScreenLayout
      headerFullWidth
      headerVariant="auth"
      leftAccessibilityLabel="커뮤니티로 돌아가기"
      onLeftPress={goBack}
      rightContent={
        <Pressable
          accessibilityLabel={submitLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          onPress={submit}
          style={({ pressed }) => [
            styles.submitPill,
            submitReady && styles.submitPillActive,
            pressed && submitReady && styles.pressed,
          ]}
        >
          <Text style={[styles.submitPillText, submitReady && styles.submitPillTextActive]}>
            {submitLabel}
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
                  onRemove={(uri) => removePhoto(talkPhotos, setTalkPhotos, uri)}
                  onReorder={(fromIndex, toIndex) => reorderPhotos(talkPhotos, setTalkPhotos, fromIndex, toIndex)}
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
                  <Text style={styles.guideDescription}>
                    전문의약품·처방약 거래나 약물 용량 변경 권유는 할 수 없어요.
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {initialTab === 'market' ? (
            <>
              <FieldCard title="거래 방식" subtitle="나눔, 판매, 교환, 구해요 중 목적에 맞게 골라주세요">
                <ChipGroup
                  onChange={(value) => {
                    setTradeType(value);
                    setPriceOffer(false);
                    setTradeMethods((current) => {
                      const compatible = value === '나눔'
                        ? current
                        : current.filter((method) => method !== '비대면 나눔');
                      return compatible[0] ? [compatible[0]] : ['직거래'];
                    });
                  }}
                  value={tradeType}
                  values={MARKET_TRADE_TYPES}
                />
                <Text style={styles.sectionLabel}>품목 카테고리</Text>
                <ChipGroup onChange={setMarketCategory} value={marketCategory} values={MARKET_WRITE_CATEGORIES} />
              </FieldCard>

              <FieldCard required={marketNeedsPhoto} title="상품 사진" subtitle="대표 사진은 첫 번째로 보여져요.">
                <PhotoPickerRow
                  onAdd={() => void pickPhotos(marketPhotos, setMarketPhotos)}
                  onRemove={(uri) => removePhoto(marketPhotos, setMarketPhotos, uri)}
                  onReorder={(fromIndex, toIndex) => reorderPhotos(marketPhotos, setMarketPhotos, fromIndex, toIndex)}
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
                  placeholder={'거래할 품목의 구매 시기, 보관 상태를 적어주세요.\n예) 2주 전 구매, 실온 보관, 알러지 때문에 나눔해요.'}
                  value={marketBody}
                />
                <Text style={styles.counter}>{marketBody.length} / {MAX_BODY_LENGTH}</Text>
              </FieldCard>

              <FieldCard required title="거래 방법" subtitle="한 가지 방법을 선택해주세요">
                <View style={styles.chipGroup}>
                  {availableTradeMethods.map((method) => {
                    const selected = tradeMethods.includes(method);
                    return (
                      <ChoiceChip
                        key={method}
                        label={method}
                        onPress={() => setTradeMethods([method])}
                        selected={selected}
                      />
                    );
                  })}
                </View>
                {!hasValidTradeMethods ? (
                  <Text style={styles.errorText}>거래 방법을 선택해주세요.</Text>
                ) : null}
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
                {isReviewEditMode ? (
                  <View style={styles.lockedReviewCategory}>
                    <Text style={styles.lockedReviewCategoryText}>{reviewCategory}</Text>
                  </View>
                ) : (
                  <ChipGroup onChange={setReviewCategory} value={reviewCategory} values={REVIEW_WRITE_CATEGORIES} />
                )}
                <Text style={styles.sectionLabel}>
                  대상
                  <Text style={styles.requiredMark}> *</Text>
                </Text>
                <AppInput
                  editable={!isReviewEditMode}
                  leftElement={<AppIcon color={COLORS.primary} name="search-outline" size={18} />}
                  maxLength={REVIEW_TARGET_MAX_LENGTH}
                  onChangeText={setReviewTarget}
                  placeholder={getReviewTargetPlaceholder(reviewCategory)}
                  value={reviewTarget}
                />
                {isReviewEditMode ? (
                  <Text style={styles.lockedReviewGuide}>리뷰 종류와 대상은 수정할 수 없어요.</Text>
                ) : null}
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

              <FieldCard brandPaw title="리뷰 정보">
                <View style={styles.formRow}>
                  <FormLabel required title="제목" />
                  <AppInput
                    containerStyle={styles.formInput}
                    maxLength={REVIEW_TITLE_MAX_LENGTH}
                    onChangeText={setReviewTitle}
                    placeholder="제목을 입력해주세요"
                    value={reviewTitle}
                  />
                </View>
                <View style={styles.formRow}>
                  <FormLabel required title="이용 날짜" />
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
                    keyboardType="number-pad"
                    maxLength={10}
                    onChangeText={(value) => setReviewVisitedAt(formatDateInput(value))}
                    placeholder="2026.07.05"
                    value={reviewVisitedAt}
                  />
                </View>
              </FieldCard>

              <FieldCard required title="후기 내용" subtitle="좋았던 점과 아쉬웠던 점을 솔직하게 남겨주세요">
                <AppInput
                  inputStyle={styles.marketBodyInput}
                  maxLength={REVIEW_BODY_MAX_LENGTH}
                  multiline
                  onChangeText={setReviewBody}
                  placeholder="예) 진료 설명이 자세했고 대기 시간이 짧았어요. 비용 안내도 미리 받을 수 있어서 좋았어요."
                  value={reviewBody}
                />
                <Text style={styles.counter}>{reviewBody.length} / {REVIEW_BODY_MAX_LENGTH}</Text>
              </FieldCard>

              <FieldCard title="사진 첨부" subtitle="방문 사진이나 영수증을 선택할 수 있어요">
                <PhotoPickerRow
                  onAdd={() => void pickPhotos(reviewPhotos, setReviewPhotos)}
                  onRemove={(uri) => removePhoto(reviewPhotos, setReviewPhotos, uri)}
                  onReorder={(fromIndex, toIndex) => reorderPhotos(reviewPhotos, setReviewPhotos, fromIndex, toIndex)}
                  photos={reviewPhotos}
                />
              </FieldCard>
              <Text style={styles.photoGuide}>
                사진에 개인정보가 노출되지 않았는지 확인해주세요.{'\n'}
                사실과 다른 내용이나 과도한 비방은 삼가주세요.
              </Text>
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

      <AppModal
        onClose={() => {
          setManualExitPending(false);
          setPendingExitAction(null);
        }}
        primaryAction={{
          label: '나가기',
          onPress: discardDraftAndLeave,
          variant: 'danger',
        }}
        secondaryAction={{
          label: '계속 작성',
          onPress: () => {
            setManualExitPending(false);
            setPendingExitAction(null);
          },
        }}
        title="글쓰기를 그만할까요?"
        variant="center"
        visible={manualExitPending || Boolean(pendingExitAction)}
      >
        <Text style={styles.exitModalDescription}>작성 중인 내용이 삭제돼요.</Text>
      </AppModal>
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
  photoBoxDragging: {
    elevation: 8,
    opacity: 0.92,
    zIndex: 10,
  },
  photoPreview: {
    height: '100%',
    width: '100%',
  },
  photoRemoveButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 44,
  },
  photoRemoveIcon: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(26, 26, 26, 0.56)',
    borderRadius: RADIUS.round,
    height: 20,
    justifyContent: 'center',
    marginRight: 3,
    marginTop: 3,
    width: 20,
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
  lockedReviewCategory: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
  },
  lockedReviewCategoryText: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
  },
  lockedReviewGuide: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
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
  exitModalDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
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
