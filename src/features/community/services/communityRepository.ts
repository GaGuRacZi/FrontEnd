import AsyncStorage from '@react-native-async-storage/async-storage';

import { createInitialCommunityState } from '../communityData';
import type { StoredCommunityState } from '../types';

const COMMUNITY_STORAGE_KEY = 'paw:community-store';

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

export const communityRepository = {
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
    await this.saveState({ comments, posts, reviewPosts, viewerStates });
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
};
