import AsyncStorage from '@react-native-async-storage/async-storage';

import { createInitialCommunityState } from '../communityData';
import {
  removeCommunityImages,
  removeUserCommunityImages,
} from './communityImageStorage';
import type { CommunityImageAsset, CommunityWriteDraft, StoredCommunityState } from '../types';

const COMMUNITY_STORAGE_KEY = 'paw:community-store';
const COMMUNITY_WRITE_DRAFT_PREFIX = 'paw:community-write-draft:';

function writeDraftKey(userId: string, tab: CommunityWriteDraft['tab']) {
  return `${COMMUNITY_WRITE_DRAFT_PREFIX}${encodeURIComponent(userId)}:${tab}`;
}

function writeDraftPrefix(userId: string) {
  return `${COMMUNITY_WRITE_DRAFT_PREFIX}${encodeURIComponent(userId)}:`;
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

function normalizeWriteDraft(draft: CommunityWriteDraft): CommunityWriteDraft {
  if (draft.tab === 'talk') {
    return {
      ...draft,
      talkPhotos: normalizeDraftImages(draft.talkPhotos),
    };
  }

  if (draft.tab === 'market') {
    return {
      ...draft,
      marketPhotos: normalizeDraftImages(draft.marketPhotos),
    };
  }

  return {
    ...draft,
    reviewPhotos: normalizeDraftImages(draft.reviewPhotos),
  };
}

export const communityRepository = {
  async clearWriteDrafts(userId: string) {
    const keys = await AsyncStorage.getAllKeys();
    const draftKeys = keys.filter((key) => key.startsWith(writeDraftPrefix(userId)));
    const drafts = await Promise.all(
      draftKeys.map(async (key) => {
        const stored = await AsyncStorage.getItem(key);
        if (!stored) return null;

        try {
          const parsed = JSON.parse(stored) as CommunityWriteDraft;
          return parsed.userId === userId ? normalizeWriteDraft(parsed) : null;
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
  },

  async deleteWriteDraft(userId: string, tab: CommunityWriteDraft['tab']) {
    await AsyncStorage.removeItem(writeDraftKey(userId, tab));
  },

  async discardWriteDraft(userId: string, tab: CommunityWriteDraft['tab']) {
    const draft = await this.loadWriteDraft(userId, tab);
    if (draft) await removeCommunityImages(userId, getDraftImages(draft));
    await this.deleteWriteDraft(userId, tab);
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
    const stored = await AsyncStorage.getItem(writeDraftKey(userId, tab));
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored) as CommunityWriteDraft;
      if (parsed.userId !== userId || parsed.tab !== tab) {
        await this.deleteWriteDraft(userId, tab);
        return null;
      }
      return normalizeWriteDraft(parsed);
    } catch {
      await this.deleteWriteDraft(userId, tab);
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
    await AsyncStorage.setItem(writeDraftKey(draft.userId, draft.tab), JSON.stringify(draft));
  },
};
