import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createInitialCommunityState,
  MARKET_CATEGORIES,
  MARKET_TRADE_METHODS,
  MARKET_TRADE_TYPES,
  REVIEW_CATEGORIES,
  TALK_CATEGORIES,
} from '../communityData';
import {
  flushQueuedCommunityImageRemovals,
  queueCommunityImageRemovals,
  queueUserCommunityImageRemoval,
} from './communityImageStorage';
import type {
  CommunityAuthorSnapshot,
  CommunityComment,
  CommunityImageAsset,
  CommunityViewerState,
  CommunityWriteDraft,
  MarketPost,
  PostKind,
  ReactionKind,
  ReviewPost,
  StoredCommunityState,
  TalkPost,
} from '../types';
import { isValidMarketPriceLabel } from '../utils/marketValidation';
import {
  getValidReviewInput,
  getValidReviewTarget,
  isValidReviewScore,
  REVIEW_BODY_MAX_LENGTH,
  REVIEW_TARGET_MAX_LENGTH,
  REVIEW_TITLE_MAX_LENGTH,
} from '../utils/reviewValidation';

const COMMUNITY_STORAGE_KEY = 'paw:community-store';
const COMMUNITY_WRITE_DRAFT_PREFIX = 'paw:community-write-draft:';
type TalkWriteDraft = Extract<CommunityWriteDraft, { tab: 'talk' }>;
type MarketWriteDraft = Extract<CommunityWriteDraft, { tab: 'market' }>;
type ReviewWriteDraft = Extract<CommunityWriteDraft, { tab: 'review' }>;
let writeDraftQueue = Promise.resolve();

export function getDeletedComment(
  comment: CommunityComment,
  deletedAt = new Date().toISOString(),
): CommunityComment {
  return {
    ...comment,
    author: {
      nickname: '',
      profileImageUri: null,
      userId: `deleted-${comment.id}`,
    },
    body: '삭제된 댓글입니다.',
    deletedAt,
    updatedAt: deletedAt,
  };
}

function writeDraftKey(
  userId: string,
  tab: CommunityWriteDraft['tab'],
  editPostId?: string,
) {
  const baseKey = `${COMMUNITY_WRITE_DRAFT_PREFIX}${encodeURIComponent(userId)}:${tab}`;
  return editPostId ? `${baseKey}:edit:${encodeURIComponent(editPostId)}` : baseKey;
}

function writeDraftPrefix(userId: string) {
  return `${COMMUNITY_WRITE_DRAFT_PREFIX}${encodeURIComponent(userId)}:`;
}

function enqueueWriteDraftOperation<T>(operation: () => Promise<T>) {
  const nextOperation = writeDraftQueue.then(operation, operation);
  writeDraftQueue = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
}

async function retryWriteDraftOperation<T>(operation: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 150 * (attempt + 1));
        });
      }
    }
  }

  throw lastError;
}

function readStoredState(stored: string) {
  try {
    return normalizeStoredState(JSON.parse(stored));
  } catch {
    return createInitialCommunityState();
  }
}

function mergeSeedState(storedState: StoredCommunityState) {
  const seedState = createInitialCommunityState();
  const storedPostIds = new Set(storedState.posts.map((post) => post.id));
  const storedCommentIds = new Set(storedState.comments.map((comment) => comment.id));
  const storedReviewPostIds = new Set(storedState.reviewPosts.map((post) => post.id));
  const storedEntityIds = new Set([...storedPostIds, ...storedReviewPostIds]);
  const posts = [
    ...storedState.posts,
    ...seedState.posts.filter((post) => !storedEntityIds.has(post.id)),
  ];
  const postIds = new Set(posts.map((post) => post.id));
  const reviewPosts = [
    ...storedState.reviewPosts,
    ...seedState.reviewPosts.filter(
      (post) => !storedEntityIds.has(post.id) && !postIds.has(post.id),
    ),
  ];
  const talkPostIds = new Set(
    posts.filter((post) => post.kind === 'talk').map((post) => post.id),
  );
  const marketPostIds = new Set(
    posts.filter((post) => post.kind === 'market').map((post) => post.id),
  );
  const reviewAuthors = new Map(
    reviewPosts.map((post) => [post.id, post.author.userId]),
  );
  const viewerStates = Object.fromEntries(
    Object.entries(storedState.viewerStates ?? {}).map(([viewerId, viewerState]) => {
      const uniqueIds = (values: string[] | undefined, validIds: ReadonlySet<string>) =>
        [...new Set(values ?? [])].filter((id) => validIds.has(id));
      const validReviewIds = new Set(
        [...reviewAuthors]
          .filter(([, authorId]) => authorId !== viewerId)
          .map(([postId]) => postId),
      );
      const notHelpfulIds = uniqueIds(
        viewerState.reactionPostIds?.notHelpful,
        validReviewIds,
      );
      const notHelpfulSet = new Set(notHelpfulIds);

      return [
        viewerId,
        {
          ...viewerState,
          bookmarkedPostIds: uniqueIds(
            viewerState.bookmarkedPostIds,
            marketPostIds,
          ),
          reactionPostIds: {
            helpful: uniqueIds(
              viewerState.reactionPostIds?.helpful,
              validReviewIds,
            ).filter((postId) => !notHelpfulSet.has(postId)),
            like: uniqueIds(viewerState.reactionPostIds?.like, talkPostIds),
            notHelpful: notHelpfulIds,
          },
        },
      ];
    }),
  );

  return {
    comments: [
      ...storedState.comments,
      ...seedState.comments.filter((comment) => !storedCommentIds.has(comment.id)),
    ],
    posts,
    reviewPosts,
    viewerStates,
  };
}

async function readCommunityState() {
  const stored = await AsyncStorage.getItem(COMMUNITY_STORAGE_KEY);
  if (!stored) return createInitialCommunityState();

  const nextState = mergeSeedState(readStoredState(stored));
  if (JSON.stringify(nextState) !== stored) {
    await AsyncStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(nextState));
  }
  return nextState;
}

function getDraftImages(draft: CommunityWriteDraft): CommunityImageAsset[] {
  if (draft.tab === 'talk') return draft.talkPhotos;
  if (draft.tab === 'market') return draft.marketPhotos;
  return draft.reviewPhotos;
}

function getStoredImageIds(state: StoredCommunityState) {
  return new Set(
    [...state.posts, ...state.reviewPosts].flatMap((post) =>
      (post.images ?? []).map((image) => image.assetId),
    ),
  );
}

function getStoredImageUris(state: StoredCommunityState) {
  return [...state.posts, ...state.reviewPosts].flatMap((post) =>
    (post.images ?? []).flatMap((image) => (image.localUri ? [image.localUri] : [])),
  );
}

function getRemovableDraftImages(
  draft: CommunityWriteDraft,
  storedImageIds: ReadonlySet<string>,
) {
  return getDraftImages(draft).filter((image) => !storedImageIds.has(image.assetId));
}

function normalizeDraftImages(value: unknown): CommunityImageAsset[] {
  if (!Array.isArray(value)) return [];

  const assetIds = new Set<string>();
  const imageUris = new Set<string>();
  return value.reduce<CommunityImageAsset[]>((images, image, index) => {
    if (typeof image === 'string') {
      const localUri = image.trim();
      if (!localUri || imageUris.has(localUri)) return images;
      const assetId = `legacy-${index}-${localUri}`;
      if (assetIds.has(assetId)) return images;
      assetIds.add(assetId);
      imageUris.add(localUri);
      images.push({
        assetId,
        localUri,
      });
      return images;
    }

    if (!image || typeof image !== 'object') return images;
    const parsed = image as Partial<CommunityImageAsset>;
    if (typeof parsed.assetId !== 'string') return images;
    const assetId = parsed.assetId.trim();
    if (!assetId || assetIds.has(assetId)) return images;
    const localUri =
      typeof parsed.localUri === 'string' && parsed.localUri.trim()
        ? parsed.localUri.trim()
        : undefined;
    const url = typeof parsed.url === 'string' && parsed.url.trim() ? parsed.url.trim() : undefined;
    if (!localUri && !url) return images;
    if ((localUri && imageUris.has(localUri)) || (url && imageUris.has(url))) return images;

    assetIds.add(assetId);
    if (localUri) imageUris.add(localUri);
    if (url) imageUris.add(url);
    images.push(
      {
        assetId,
        ...(localUri ? { localUri } : {}),
        ...(url ? { url } : {}),
      },
    );
    return images;
  }, []);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function getBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return value as string[];
}

function isValueIn<T extends string>(value: string, values: readonly T[]): value is T {
  return values.some((item) => item === value);
}

const POST_KINDS: PostKind[] = ['talk', 'market', 'review'];
const REACTION_KINDS: ReactionKind[] = ['helpful', 'like', 'notHelpful'];
const MARKET_STATUSES: MarketPost['status'][] = ['진행 중', '예약 중', '완료'];

function getTrimmedString(value: unknown) {
  const parsed = getString(value)?.trim();
  return parsed || null;
}

function getOptionalString(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return getString(value);
}

function getTimestamp(value: unknown) {
  const parsed = getString(value);
  return parsed && Number.isFinite(Date.parse(parsed)) ? parsed : null;
}

function getNonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = getNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeAuthor(
  value: unknown,
  allowEmptyNickname = false,
): CommunityAuthorSnapshot | null {
  if (!isRecord(value)) return null;
  const userId = getTrimmedString(value.userId);
  const nickname = getString(value.nickname);
  if (!userId || nickname === null || (!allowEmptyNickname && !nickname.trim())) return null;

  const introduction =
    typeof value.introduction === 'string' ? value.introduction : undefined;
  const location = typeof value.location === 'string' ? value.location : undefined;
  const petName = typeof value.petName === 'string' ? value.petName : undefined;
  const profileImageUri =
    value.profileImageUri === null
      ? null
      : typeof value.profileImageUri === 'string'
        ? value.profileImageUri
        : undefined;

  return {
    ...(introduction !== undefined ? { introduction } : {}),
    ...(location !== undefined ? { location } : {}),
    nickname,
    ...(petName !== undefined ? { petName } : {}),
    ...(profileImageUri !== undefined ? { profileImageUri } : {}),
    userId,
  };
}

function normalizeReactionCounts(
  value: unknown,
  allowedKinds: readonly ReactionKind[],
): Partial<Record<ReactionKind, number>> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    allowedKinds.flatMap((kind) => {
      const count = getNumber(value[kind]);
      return count !== null && Number.isInteger(count) && count >= 0
        ? [[kind, count] as const]
        : [];
    }),
  );
}

function normalizeStoredImages(value: unknown) {
  const images = normalizeDraftImages(value);
  return images.length ? images : undefined;
}

function normalizeLegacyPhotoUris(value: unknown) {
  const uris = normalizeStringList(value);
  return uris.length ? uris : undefined;
}

function normalizeTalkPost(value: unknown): TalkPost | null {
  if (!isRecord(value) || value.kind !== 'talk') return null;
  const author = normalizeAuthor(value.author);
  const body = getTrimmedString(value.body);
  const category = getString(value.category);
  const createdAt = getTimestamp(value.createdAt);
  const id = getTrimmedString(value.id);
  const showNeighborhood = getBoolean(value.showNeighborhood) ?? false;
  const title = getTrimmedString(value.title);
  const updatedAt = getTimestamp(value.updatedAt);
  if (
    !author ||
    !body ||
    !category ||
    !isTalkWriteCategory(category) ||
    !createdAt ||
    !id ||
    !title ||
    !updatedAt
  ) {
    return null;
  }

  const images = normalizeStoredImages(value.images);
  const photoUris = normalizeLegacyPhotoUris(value.photoUris);

  return {
    author,
    baseBookmarkCount: getNonNegativeInteger(value.baseBookmarkCount),
    baseReactionCounts: normalizeReactionCounts(value.baseReactionCounts, ['like']),
    body,
    category,
    createdAt,
    id,
    ...(images ? { images } : {}),
    kind: 'talk',
    ...(photoUris ? { photoUris } : {}),
    showNeighborhood,
    tags: normalizeStringList(value.tags),
    title,
    updatedAt,
  };
}

function normalizeMarketPost(value: unknown): MarketPost | null {
  if (!isRecord(value) || value.kind !== 'market') return null;
  const author = normalizeAuthor(value.author);
  const body = getTrimmedString(value.body);
  const category = getString(value.category);
  const createdAt = getTimestamp(value.createdAt);
  const id = getTrimmedString(value.id);
  const location = getString(value.location);
  const priceLabel = getTrimmedString(value.priceLabel);
  const status = getString(value.status);
  const title = getTrimmedString(value.title);
  const tradeType = getString(value.tradeType);
  const updatedAt = getTimestamp(value.updatedAt);
  if (
    !author ||
    !body ||
    !category ||
    !isMarketWriteCategory(category) ||
    !createdAt ||
    !id ||
    location === null ||
    !priceLabel ||
    !status ||
    !isValueIn(status, MARKET_STATUSES) ||
    !title ||
    !tradeType ||
    !isValueIn(tradeType, MARKET_TRADE_TYPES) ||
    !isValidMarketPriceLabel(tradeType, priceLabel) ||
    !updatedAt
  ) {
    return null;
  }

  const expiresAt = getOptionalString(value.expiresAt);
  if (expiresAt === null) return null;
  const images = normalizeStoredImages(value.images);
  const photoUris = normalizeLegacyPhotoUris(value.photoUris);

  return {
    author,
    baseBookmarkCount: getNonNegativeInteger(value.baseBookmarkCount),
    baseReactionCounts: normalizeReactionCounts(value.baseReactionCounts, []),
    body,
    category,
    createdAt,
    ...(expiresAt !== undefined ? { expiresAt } : {}),
    id,
    imageCount: getNonNegativeInteger(
      value.imageCount,
      images?.length ?? photoUris?.length ?? 0,
    ),
    ...(images ? { images } : {}),
    kind: 'market',
    location,
    ...(photoUris ? { photoUris } : {}),
    priceLabel,
    status,
    tags: normalizeStringList(value.tags),
    title,
    tradeType,
    updatedAt,
  };
}

function normalizeReviewPost(value: unknown): ReviewPost | null {
  if (!isRecord(value)) return null;
  const author = normalizeAuthor(value.author);
  const body = getTrimmedString(value.body);
  const category = getString(value.category);
  const createdAt = getTimestamp(value.createdAt);
  const id = getTrimmedString(value.id);
  const rating = getNumber(value.rating);
  const targetName = getTrimmedString(value.targetName);
  const title = getTrimmedString(value.title);
  const visitedAt = getTrimmedString(value.visitedAt);
  if (
    !author ||
    !body ||
    !category ||
    !isReviewWriteCategory(category) ||
    !createdAt ||
    !id ||
    rating === null ||
    !isValidReviewScore(rating) ||
    !targetName ||
    !title ||
    !visitedAt
  ) {
    return null;
  }

  if (!isRecord(value.detailScores)) return null;
  const kindness = getNumber(value.detailScores.kindness);
  const price = getNumber(value.detailScores.price);
  const revisit = getNumber(value.detailScores.revisit);
  if (
    kindness === null ||
    !isValidReviewScore(kindness) ||
    price === null ||
    !isValidReviewScore(price) ||
    revisit === null ||
    !isValidReviewScore(revisit)
  ) {
    return null;
  }
  const detailScores = { kindness, price, revisit };

  const reviewInput = getValidReviewInput({
    body,
    detailScores,
    rating,
    title,
    visitedAt,
  });
  const normalizedTargetName = getValidReviewTarget(targetName);
  if (!reviewInput || !normalizedTargetName) return null;

  const images = normalizeStoredImages(value.images);
  const photoUris = normalizeLegacyPhotoUris(value.photoUris);
  const placeholderPhotoCount = getNonNegativeInteger(value.placeholderPhotoCount);

  return {
    author,
    baseReactionCounts: normalizeReactionCounts(value.baseReactionCounts, [
      'helpful',
      'notHelpful',
    ]),
    body: reviewInput.body,
    category,
    createdAt,
    detailScores,
    id,
    ...(images ? { images } : {}),
    ...(photoUris ? { photoUris } : {}),
    ...(placeholderPhotoCount ? { placeholderPhotoCount } : {}),
    rating,
    targetName: normalizedTargetName,
    title: reviewInput.title,
    visitedAt: reviewInput.visitedAt,
  };
}

function normalizeComment(value: unknown): CommunityComment | null {
  if (!isRecord(value)) return null;
  const deletedAt =
    value.deletedAt === undefined ? undefined : getTimestamp(value.deletedAt);
  const author = normalizeAuthor(value.author, deletedAt !== undefined);
  const body = getTrimmedString(value.body);
  const createdAt = getTimestamp(value.createdAt);
  const id = getTrimmedString(value.id);
  const parentId =
    value.parentId === undefined ? undefined : getTrimmedString(value.parentId);
  const postId = getTrimmedString(value.postId);
  const updatedAt = getTimestamp(value.updatedAt);
  if (
    !author ||
    !body ||
    !createdAt ||
    !id ||
    (value.deletedAt !== undefined && !deletedAt) ||
    (value.parentId !== undefined && !parentId) ||
    !postId ||
    !updatedAt
  ) {
    return null;
  }

  return {
    author,
    body,
    createdAt,
    ...(deletedAt ? { deletedAt } : {}),
    id,
    ...(parentId ? { parentId } : {}),
    postId,
    updatedAt,
  };
}

function normalizeIdList(value: unknown) {
  return normalizeStringList(value);
}

export function normalizeCommunityFilterSession(
  value: unknown,
): CommunityViewerState['filterSession'] {
  const filter = isRecord(value) ? value : {};
  const activeTab = getString(filter.activeTab);
  const marketCategory = getString(filter.marketCategory);
  const reviewCategory = getString(filter.reviewCategory);
  const searchQuery = getString(filter.searchQuery);
  const searchTab = getString(filter.searchTab);
  const talkCategory = getString(filter.talkCategory);

  return {
    activeTab: activeTab && isValueIn(activeTab, POST_KINDS) ? activeTab : 'talk',
    marketCategory:
      marketCategory && isValueIn(marketCategory, MARKET_CATEGORIES)
        ? marketCategory
        : '전체',
    marketStatuses: normalizeIdList(filter.marketStatuses).filter(
      (status): status is MarketPost['status'] => isValueIn(status, MARKET_STATUSES),
    ),
    marketTradeTypes: normalizeIdList(filter.marketTradeTypes).filter(
      (tradeType): tradeType is MarketPost['tradeType'] =>
        isValueIn(tradeType, MARKET_TRADE_TYPES),
    ),
    reviewCategory:
      reviewCategory && isValueIn(reviewCategory, REVIEW_CATEGORIES)
        ? reviewCategory
        : '전체',
    searchQuery: searchQuery ?? '',
    searchTab: searchTab && isValueIn(searchTab, POST_KINDS) ? searchTab : 'talk',
    talkCategory:
      talkCategory && isValueIn(talkCategory, TALK_CATEGORIES)
        ? talkCategory
        : '전체',
  };
}

function normalizeViewerState(value: unknown): CommunityViewerState | null {
  if (!isRecord(value)) return null;
  const storedReactionPostIds = isRecord(value.reactionPostIds)
    ? value.reactionPostIds
    : null;
  const reactionPostIds = storedReactionPostIds
    ? Object.fromEntries(
        REACTION_KINDS.flatMap((kind) => {
          const ids = normalizeIdList(storedReactionPostIds[kind]);
          return ids.length ? [[kind, ids] as const] : [];
        }),
      )
    : {};

  return {
    bookmarkedPostIds: normalizeIdList(value.bookmarkedPostIds),
    filterSession: normalizeCommunityFilterSession(value.filterSession),
    reactionPostIds,
  };
}

function uniqueById<T extends { id: string }>(values: T[]) {
  const ids = new Set<string>();
  return values.filter((value) => {
    if (ids.has(value.id)) return false;
    ids.add(value.id);
    return true;
  });
}

function normalizeStoredState(value: unknown): StoredCommunityState {
  if (!isRecord(value)) return createInitialCommunityState();

  const posts = uniqueById(
    (Array.isArray(value.posts) ? value.posts : []).flatMap((post) => {
      const normalized =
        isRecord(post) && post.kind === 'talk'
          ? normalizeTalkPost(post)
          : normalizeMarketPost(post);
      return normalized ? [normalized] : [];
    }),
  );
  const postIds = new Set(posts.map((post) => post.id));
  const reviewPosts = uniqueById(
    (Array.isArray(value.reviewPosts) ? value.reviewPosts : []).flatMap((post) => {
      const normalized = normalizeReviewPost(post);
      return normalized && !postIds.has(normalized.id) ? [normalized] : [];
    }),
  );
  const talkPostIds = new Set(
    [...posts, ...createInitialCommunityState().posts]
      .filter((post) => post.kind === 'talk')
      .map((post) => post.id),
  );
  const normalizedComments = uniqueById(
    (Array.isArray(value.comments) ? value.comments : []).flatMap((comment) => {
      const normalized = normalizeComment(comment);
      return normalized && talkPostIds.has(normalized.postId) ? [normalized] : [];
    }),
  );
  const commentsById = new Map(
    normalizedComments.map((comment) => [comment.id, comment]),
  );
  const structurallyValidComments = normalizedComments.filter((comment) => {
    if (!comment.parentId) return true;
    const parent = commentsById.get(comment.parentId);
    return Boolean(parent && !parent.parentId && parent.postId === comment.postId);
  });
  const parentsWithReplies = new Set(
    structurallyValidComments
      .filter((comment) => comment.parentId && !comment.deletedAt)
      .map((comment) => comment.parentId),
  );
  const comments = structurallyValidComments.filter(
    (comment) => !comment.deletedAt || parentsWithReplies.has(comment.id),
  );
  const viewerStates = isRecord(value.viewerStates)
    ? Object.fromEntries(
        Object.entries(value.viewerStates).flatMap(([viewerId, viewerState]) => {
          const normalized = viewerId.trim() ? normalizeViewerState(viewerState) : null;
          return normalized ? [[viewerId, normalized]] : [];
        }),
      )
    : {};

  return {
    comments,
    posts,
    reviewPosts,
    viewerStates,
  };
}

function isTalkWriteCategory(value: string): value is TalkWriteDraft['talkCategory'] {
  return isValueIn(value, TALK_CATEGORIES) && value !== '전체';
}

function isMarketWriteCategory(value: string): value is MarketWriteDraft['marketCategory'] {
  return isValueIn(value, MARKET_CATEGORIES) && value !== '전체';
}

function isReviewWriteCategory(value: string): value is ReviewWriteDraft['reviewCategory'] {
  return isValueIn(value, REVIEW_CATEGORIES) && value !== '전체';
}

function normalizeWriteDraft(value: unknown): CommunityWriteDraft | null {
  if (!isRecord(value)) return null;
  const userId = getString(value.userId);
  const rawEditPostId = value.editPostId;
  const editPostId = rawEditPostId === undefined ? undefined : getString(rawEditPostId)?.trim();
  const id = getString(value.id);
  const tab = getString(value.tab);
  const updatedAt = getString(value.updatedAt);

  if (
    !userId ||
    (rawEditPostId !== undefined && !editPostId) ||
    !id ||
    !updatedAt ||
    Number.isNaN(Date.parse(updatedAt)) ||
    new Date(updatedAt).toISOString() !== updatedAt
  ) {
    return null;
  }

  if (tab === 'talk') {
    const talkTitle = getString(value.talkTitle);
    const talkBody = getString(value.talkBody);
    const talkCategory = getString(value.talkCategory);
    const talkTags = getStringArray(value.talkTags);

    if (
      talkTitle === null ||
      talkBody === null ||
      !talkCategory ||
      !isTalkWriteCategory(talkCategory) ||
      !talkTags
    ) {
      return null;
    }

    return {
      ...(editPostId ? { editPostId } : {}),
      id,
      tab,
      talkBody,
      talkCategory,
      talkPhotos: normalizeDraftImages(value.talkPhotos),
      talkTags,
      talkTitle,
      updatedAt,
      userId,
    };
  }

  if (tab === 'market') {
    const expiresAt = getString(value.expiresAt);
    const marketBody = getString(value.marketBody);
    const marketCategory = getString(value.marketCategory);
    const price = getString(value.price);
    const priceOffer = getBoolean(value.priceOffer);
    const productName = getString(value.productName);
    const tradeLocation = getString(value.tradeLocation);
    const tradeMethods = getStringArray(value.tradeMethods);
    const tradeType = getString(value.tradeType);

    if (
      expiresAt === null ||
      marketBody === null ||
      !marketCategory ||
      !isMarketWriteCategory(marketCategory) ||
      price === null ||
      priceOffer === null ||
      productName === null ||
      tradeLocation === null ||
      !tradeMethods ||
      !tradeMethods.every((method) => isValueIn(method, MARKET_TRADE_METHODS)) ||
      !tradeType ||
      !isValueIn(tradeType, MARKET_TRADE_TYPES)
    ) {
      return null;
    }

    return {
      ...(editPostId ? { editPostId } : {}),
      expiresAt,
      id,
      marketBody,
      marketCategory,
      marketPhotos: normalizeDraftImages(value.marketPhotos),
      price,
      priceOffer,
      productName,
      tab,
      tradeLocation,
      tradeMethods,
      tradeType,
      updatedAt,
      userId,
    };
  }

  if (tab !== 'review') return null;

  const reviewBody = getString(value.reviewBody);
  const reviewCategory = getString(value.reviewCategory);
  const reviewKindness = getNumber(value.reviewKindness);
  const reviewPriceScore = getNumber(value.reviewPriceScore);
  const reviewRating = getNumber(value.reviewRating);
  const reviewRevisit = getNumber(value.reviewRevisit);
  const reviewTarget = getString(value.reviewTarget);
  const reviewTitle = getString(value.reviewTitle);
  const reviewVisitedAt = getString(value.reviewVisitedAt);

  if (
    reviewBody === null ||
    !reviewCategory ||
    !isReviewWriteCategory(reviewCategory) ||
    reviewKindness === null ||
    !isValidReviewScore(reviewKindness) ||
    reviewPriceScore === null ||
    !isValidReviewScore(reviewPriceScore) ||
    reviewRating === null ||
    !isValidReviewScore(reviewRating) ||
    reviewRevisit === null ||
    !isValidReviewScore(reviewRevisit) ||
    reviewTarget === null ||
    reviewTarget.length > REVIEW_TARGET_MAX_LENGTH ||
    reviewTitle === null ||
    reviewTitle.length > REVIEW_TITLE_MAX_LENGTH ||
    reviewVisitedAt === null ||
    reviewBody.length > REVIEW_BODY_MAX_LENGTH
  ) {
    return null;
  }

  return {
    ...(editPostId ? { editPostId } : {}),
    id,
    reviewBody,
    reviewCategory,
    reviewKindness,
    reviewPhotos: normalizeDraftImages(value.reviewPhotos),
    reviewPriceScore,
    reviewRating,
    reviewRevisit,
    reviewTarget,
    reviewTitle,
    reviewVisitedAt,
    tab,
    updatedAt,
    userId,
  };
}

async function readWriteDraft(
  userId: string,
  tab: CommunityWriteDraft['tab'],
  editPostId?: string,
) {
  const key = writeDraftKey(userId, tab, editPostId);
  const stored = await AsyncStorage.getItem(key);
  if (!stored) return null;

  try {
    const parsed = normalizeWriteDraft(JSON.parse(stored));
    if (
      parsed?.userId === userId &&
      parsed.tab === tab &&
      parsed.editPostId === editPostId
    ) {
      return parsed;
    }
  } catch {
    await AsyncStorage.removeItem(key).catch(() => undefined);
    return null;
  }

  await AsyncStorage.removeItem(key).catch(() => undefined);
  return null;
}

export const communityRepository = {
  async clearWriteDrafts(userId: string) {
    await enqueueWriteDraftOperation(async () => {
      const [keys, storedState] = await Promise.all([
        AsyncStorage.getAllKeys(),
        readCommunityState(),
      ]);
      const draftKeys = keys.filter((key) => key.startsWith(writeDraftPrefix(userId)));
      const storedImageIds = getStoredImageIds(storedState);
      const drafts = await Promise.all(
        draftKeys.map(async (key) => {
          try {
            const stored = await AsyncStorage.getItem(key);
            if (!stored) return null;
            const parsed = normalizeWriteDraft(JSON.parse(stored));
            return parsed?.userId === userId ? parsed : null;
          } catch {
            return null;
          }
        }),
      );
      const removableImages = drafts
        .filter((draft): draft is CommunityWriteDraft => Boolean(draft))
        .flatMap((draft) => getRemovableDraftImages(draft, storedImageIds));
      await queueCommunityImageRemovals(userId, removableImages);
      if (draftKeys.length) await AsyncStorage.multiRemove(draftKeys);
      await this.flushImageRemovals(storedState, userId);
    });
  },

  async deleteWriteDraft(
    userId: string,
    tab: CommunityWriteDraft['tab'],
    editPostId?: string,
  ) {
    await enqueueWriteDraftOperation(async () => {
      const key = writeDraftKey(userId, tab, editPostId);
      await retryWriteDraftOperation(() => AsyncStorage.setItem(key, 'null'));
      await retryWriteDraftOperation(() => AsyncStorage.removeItem(key)).catch(() => undefined);
    });
  },

  async discardWriteDraft(
    userId: string,
    tab: CommunityWriteDraft['tab'],
    editPostId?: string,
  ) {
    await enqueueWriteDraftOperation(async () => {
      const [draft, storedState] = await Promise.all([
        readWriteDraft(userId, tab, editPostId).catch(() => null),
        readCommunityState(),
      ]);
      if (draft) {
        await queueCommunityImageRemovals(
          userId,
          getRemovableDraftImages(draft, getStoredImageIds(storedState)),
        );
      }
      await AsyncStorage.removeItem(writeDraftKey(userId, tab, editPostId));
      await this.flushImageRemovals(storedState, userId).catch(() => undefined);
    });
  },

  async deleteUserState(userId: string) {
    const state = await readCommunityState();
    const deletedAt = new Date().toISOString();
    const removedImages = [...state.posts, ...state.reviewPosts]
      .filter((post) => post.author.userId === userId)
      .flatMap((post) => post.images ?? []);
    const removedPostIds = new Set(
      state.posts.filter((post) => post.author.userId === userId).map((post) => post.id),
    );
    const removedReviewPostIds = new Set(
      state.reviewPosts.filter((post) => post.author.userId === userId).map((post) => post.id),
    );
    const posts = state.posts.filter((post) => post.author.userId !== userId);
    const reviewPosts = state.reviewPosts.filter((post) => post.author.userId !== userId);
    const retainedComments = state.comments.filter(
      (comment) => !removedPostIds.has(comment.postId),
    );
    const retainedParentIds = new Set(
      retainedComments
        .filter((comment) => comment.author.userId !== userId)
        .map((comment) => comment.parentId)
        .filter((parentId): parentId is string => Boolean(parentId)),
    );
    const comments = retainedComments.flatMap((comment) => {
      if (comment.author.userId !== userId) return [comment];
      if (!retainedParentIds.has(comment.id)) return [];
      return [getDeletedComment(comment, deletedAt)];
    });
    const viewerStates = Object.fromEntries(
      Object.entries(state.viewerStates)
        .filter(([viewerId]) => viewerId !== userId)
        .map(([viewerId, viewerState]) => [
          viewerId,
          {
            ...viewerState,
            bookmarkedPostIds: viewerState.bookmarkedPostIds.filter(
              (postId) => !removedPostIds.has(postId) && !removedReviewPostIds.has(postId),
            ),
            reactionPostIds: Object.fromEntries(
              Object.entries(viewerState.reactionPostIds).map(([kind, postIds]) => [
                kind,
                postIds.filter((postId) => !removedPostIds.has(postId) && !removedReviewPostIds.has(postId)),
              ]),
            ),
          },
        ]),
    );
    const nextState = { comments, posts, reviewPosts, viewerStates };
    await queueCommunityImageRemovals(userId, removedImages);
    await this.saveState(nextState);
    await this.clearWriteDrafts(userId);
    await queueUserCommunityImageRemoval(userId);
    await this.flushImageRemovals(nextState, userId);
  },

  async flushImageRemovals(state: StoredCommunityState, userId?: string) {
    const draftKeys = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith(COMMUNITY_WRITE_DRAFT_PREFIX),
    );
    const drafts = await Promise.all(
      draftKeys.map(async (key) => {
        const stored = await AsyncStorage.getItem(key);
        if (!stored) return null;
        try {
          return normalizeWriteDraft(JSON.parse(stored));
        } catch {
          return null;
        }
      }),
    );
    const retainedUris = new Set([
      ...getStoredImageUris(state),
      ...drafts
        .filter((draft): draft is CommunityWriteDraft => Boolean(draft))
        .flatMap((draft) =>
          getDraftImages(draft).flatMap((image) =>
            image.localUri ? [image.localUri] : [],
          ),
        ),
    ]);
    await flushQueuedCommunityImageRemovals({ retainedUris, userId });
  },

  async loadWriteDraft(
    userId: string,
    tab: CommunityWriteDraft['tab'],
    editPostId?: string,
  ) {
    try {
      return await enqueueWriteDraftOperation(() => readWriteDraft(userId, tab, editPostId));
    } catch {
      return null;
    }
  },

  async loadState(): Promise<StoredCommunityState> {
    const nextState = await readCommunityState();
    await this.flushImageRemovals(nextState).catch(() => undefined);
    return nextState;
  },

  async saveState(state: StoredCommunityState) {
    await AsyncStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(state));
  },

  async saveWriteDraft(draft: CommunityWriteDraft) {
    await enqueueWriteDraftOperation(() =>
      AsyncStorage.setItem(
        writeDraftKey(draft.userId, draft.tab, draft.editPostId),
        JSON.stringify(draft),
      ),
    );
  },
};
