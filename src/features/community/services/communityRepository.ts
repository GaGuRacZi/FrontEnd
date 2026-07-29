import AsyncStorage from '@react-native-async-storage/async-storage';

import { createInitialCommunityState } from '../communityData';
import {
  removeCommunityImages,
  removeUserCommunityImages,
} from './communityImageStorage';
import type { CommunityImageAsset, CommunityWriteDraft, StoredCommunityState } from '../types';

const COMMUNITY_STORAGE_KEY = 'paw:community-store';
const COMMUNITY_WRITE_DRAFT_PREFIX = 'paw:community-write-draft:';
type TalkWriteDraft = Extract<CommunityWriteDraft, { tab: 'talk' }>;
type MarketWriteDraft = Extract<CommunityWriteDraft, { tab: 'market' }>;
type ReviewWriteDraft = Extract<CommunityWriteDraft, { tab: 'review' }>;
let writeDraftQueue = Promise.resolve();

function writeDraftKey(userId: string, tab: CommunityWriteDraft['tab']) {
  return `${COMMUNITY_WRITE_DRAFT_PREFIX}${encodeURIComponent(userId)}:${tab}`;
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

function readStoredState(stored: string) {
  try {
    const parsed = JSON.parse(stored) as StoredCommunityState;
    if (!Array.isArray(parsed.posts) || !Array.isArray(parsed.comments)) {
      return createInitialCommunityState();
    }

    return {
      comments: parsed.comments,
      posts: parsed.posts,
      reviewPosts: Array.isArray(parsed.reviewPosts)
        ? parsed.reviewPosts
        : createInitialCommunityState().reviewPosts,
      viewerStates: parsed.viewerStates ?? {},
    };
  } catch {
    return createInitialCommunityState();
  }
}

function mergeSeedState(storedState: StoredCommunityState) {
  const seedState = createInitialCommunityState();
  const storedPostIds = new Set(storedState.posts.map((post) => post.id));
  const storedCommentIds = new Set(storedState.comments.map((comment) => comment.id));
  const storedReviewPostIds = new Set(storedState.reviewPosts.map((post) => post.id));

  return {
    comments: [
      ...storedState.comments,
      ...seedState.comments.filter((comment) => !storedCommentIds.has(comment.id)),
    ],
    posts: [
      ...storedState.posts,
      ...seedState.posts.filter((post) => !storedPostIds.has(post.id)),
    ],
    reviewPosts: [
      ...storedState.reviewPosts,
      ...seedState.reviewPosts.filter((post) => !storedReviewPostIds.has(post.id)),
    ],
    viewerStates: storedState.viewerStates ?? {},
  };
}

function getDraftImages(draft: CommunityWriteDraft): CommunityImageAsset[] {
  if (draft.tab === 'talk') return draft.talkPhotos;
  if (draft.tab === 'market') return draft.marketPhotos;
  return draft.reviewPhotos;
}

function normalizeDraftImages(value: unknown): CommunityImageAsset[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<CommunityImageAsset[]>((images, image, index) => {
    if (typeof image === 'string') {
      images.push({
        assetId: `legacy-${index}-${image}`,
        localUri: image,
      });
      return images;
    }

    if (!image || typeof image !== 'object') return images;
    const parsed = image as Partial<CommunityImageAsset>;
    if (typeof parsed.assetId !== 'string') return images;

    images.push(
      {
        assetId: parsed.assetId,
        ...(typeof parsed.localUri === 'string' ? { localUri: parsed.localUri } : {}),
        ...(typeof parsed.url === 'string' ? { url: parsed.url } : {}),
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
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null;
}

function normalizeWriteDraft(value: unknown): CommunityWriteDraft | null {
  if (!isRecord(value)) return null;
  const userId = getString(value.userId);
  const id = getString(value.id);
  const tab = getString(value.tab);
  const updatedAt = getString(value.updatedAt);

  if (!userId || !id || !updatedAt) return null;

  if (tab === 'talk') {
    const talkTitle = getString(value.talkTitle);
    const talkBody = getString(value.talkBody);
    const talkCategory = getString(value.talkCategory);
    const talkTags = getStringArray(value.talkTags);

    if (!talkTitle || talkBody === null || !talkCategory || !talkTags) return null;

    return {
      id,
      tab,
      talkBody,
      talkCategory: talkCategory as TalkWriteDraft['talkCategory'],
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
      price === null ||
      priceOffer === null ||
      productName === null ||
      tradeLocation === null ||
      !tradeMethods ||
      !tradeType
    ) {
      return null;
    }

    return {
      expiresAt,
      id,
      marketBody,
      marketCategory: marketCategory as MarketWriteDraft['marketCategory'],
      marketPhotos: normalizeDraftImages(value.marketPhotos),
      price,
      priceOffer,
      productName,
      tab,
      tradeLocation,
      tradeMethods,
      tradeType: tradeType as MarketWriteDraft['tradeType'],
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
    reviewKindness === null ||
    reviewPriceScore === null ||
    reviewRating === null ||
    reviewRevisit === null ||
    reviewTarget === null ||
    reviewTitle === null ||
    reviewVisitedAt === null
  ) {
    return null;
  }

  return {
    id,
    reviewBody,
    reviewCategory: reviewCategory as ReviewWriteDraft['reviewCategory'],
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

async function readWriteDraft(userId: string, tab: CommunityWriteDraft['tab']) {
  const stored = await AsyncStorage.getItem(writeDraftKey(userId, tab));
  if (!stored) return null;

  try {
    const parsed = normalizeWriteDraft(JSON.parse(stored));
    if (parsed?.userId === userId && parsed.tab === tab) return parsed;
  } catch {
    await AsyncStorage.removeItem(writeDraftKey(userId, tab));
    return null;
  }

  await AsyncStorage.removeItem(writeDraftKey(userId, tab));
  return null;
}

export const communityRepository = {
  async clearWriteDrafts(userId: string) {
    await enqueueWriteDraftOperation(async () => {
      const keys = await AsyncStorage.getAllKeys();
      const draftKeys = keys.filter((key) => key.startsWith(writeDraftPrefix(userId)));
      const drafts = await Promise.all(
        draftKeys.map(async (key) => {
          const stored = await AsyncStorage.getItem(key);
          if (!stored) return null;

          try {
            const parsed = normalizeWriteDraft(JSON.parse(stored));
            return parsed?.userId === userId ? parsed : null;
          } catch {
            return null;
          }
        }),
      );
      await Promise.all(
        drafts
          .filter((draft): draft is CommunityWriteDraft => Boolean(draft))
          .map((draft) => removeCommunityImages(userId, getDraftImages(draft))),
      );
      if (draftKeys.length) await AsyncStorage.multiRemove(draftKeys);
    });
  },

  async deleteWriteDraft(userId: string, tab: CommunityWriteDraft['tab']) {
    await enqueueWriteDraftOperation(() => AsyncStorage.removeItem(writeDraftKey(userId, tab)));
  },

  async discardWriteDraft(userId: string, tab: CommunityWriteDraft['tab']) {
    await enqueueWriteDraftOperation(async () => {
      const draft = await readWriteDraft(userId, tab);
      if (draft) await removeCommunityImages(userId, getDraftImages(draft));
      await AsyncStorage.removeItem(writeDraftKey(userId, tab));
    });
  },

  async deleteUserState(userId: string) {
    const state = await this.loadState();
    const removedPostIds = new Set(
      state.posts.filter((post) => post.author.userId === userId).map((post) => post.id),
    );
    const removedReviewPostIds = new Set(
      state.reviewPosts.filter((post) => post.author.userId === userId).map((post) => post.id),
    );
    const posts = state.posts.filter((post) => post.author.userId !== userId);
    const reviewPosts = state.reviewPosts.filter((post) => post.author.userId !== userId);
    const comments = state.comments.filter(
      (comment) => comment.author.userId !== userId && !removedPostIds.has(comment.postId),
    );
    const viewerStates = Object.fromEntries(
      Object.entries(state.viewerStates)
        .filter(([viewerId]) => viewerId !== userId)
        .map(([viewerId, viewerState]) => [
          viewerId,
          {
            ...viewerState,
            bookmarkedPostIds: viewerState.bookmarkedPostIds.filter(
              (postId) => !removedPostIds.has(postId),
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
    await Promise.all([
      this.saveState({ comments, posts, reviewPosts, viewerStates }),
      this.clearWriteDrafts(userId),
      removeUserCommunityImages(userId),
    ]);
  },

  async loadWriteDraft(userId: string, tab: CommunityWriteDraft['tab']) {
    try {
      await writeDraftQueue;
      return await readWriteDraft(userId, tab);
    } catch {
      await AsyncStorage.removeItem(writeDraftKey(userId, tab));
      return null;
    }
  },

  async loadState(): Promise<StoredCommunityState> {
    const stored = await AsyncStorage.getItem(COMMUNITY_STORAGE_KEY);
    if (!stored) return createInitialCommunityState();

    const restoredState = readStoredState(stored);
    const nextState = mergeSeedState(restoredState);
    if (
      nextState.posts.length !== restoredState.posts.length ||
      nextState.comments.length !== restoredState.comments.length ||
      nextState.reviewPosts.length !== restoredState.reviewPosts.length
    ) {
      await this.saveState(nextState);
    }
    return nextState;
  },

  async saveState(state: StoredCommunityState) {
    await AsyncStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(state));
  },

  async saveWriteDraft(draft: CommunityWriteDraft) {
    await enqueueWriteDraftOperation(() =>
      AsyncStorage.setItem(writeDraftKey(draft.userId, draft.tab), JSON.stringify(draft)),
    );
  },
};
