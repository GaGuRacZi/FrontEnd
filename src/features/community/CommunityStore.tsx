import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import { flushQueuedProfileImageRemovals } from '@/src/features/mypage/services/profileImageStorage';

import { COMMUNITY_GUEST_ID } from './communityData';
import { queueCommunityImageRemovals } from './services/communityImageStorage';
import {
  communityRepository,
  getDeletedComment,
  normalizeCommunityFilterSession,
} from './services/communityRepository';
import {
  getMarketTradeMethods,
  isValidMarketPriceLabel,
  isValidMarketTradeMethodSelection,
} from './utils/marketValidation';
import { getValidReviewInput, getValidReviewTarget } from './utils/reviewValidation';
import type {
  CommunityAuthorSnapshot,
  CommunityComment,
  CommunityPost,
  CommunityViewerState,
  MarketPost,
  MarketStatus,
  ReactionKind,
  ReviewPost,
  StoredCommunityState,
  TalkPost,
} from './types';

type MutationResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'error' | 'not-found' | 'not-ready' | 'not-yours' };

type TalkPostForm = Pick<TalkPost, 'body' | 'category' | 'images' | 'showNeighborhood' | 'tags' | 'title'>;
type MarketPostForm = Pick<
  MarketPost,
  'body' | 'category' | 'expiresAt' | 'imageCount' | 'images' | 'location' | 'priceLabel' | 'tags' | 'title' | 'tradeType'
>;

type CommunityStoreContextValue = {
  addComment: (
    postId: string,
    body: string,
    author: CommunityAuthorSnapshot,
    parentId?: string,
  ) => Promise<MutationResult>;
  addMarketPost: (
    post: Omit<MarketPost, 'createdAt' | 'id' | 'kind' | 'updatedAt'>,
  ) => Promise<MutationResult & { postId?: string }>;
  addReviewPost: (
    post: Omit<ReviewPost, 'createdAt' | 'id'>,
  ) => Promise<MutationResult & { postId?: string }>;
  addTalkPost: (
    post: Omit<TalkPost, 'createdAt' | 'id' | 'kind' | 'updatedAt'>,
  ) => Promise<MutationResult & { postId?: string }>;
  clearScreenSession: () => Promise<void>;
  comments: CommunityComment[];
  deleteComment: (commentId: string) => Promise<MutationResult>;
  deletePost: (postId: string) => Promise<MutationResult>;
  deleteReviewPost: (postId: string) => Promise<MutationResult>;
  deleteUserCommunityData: (userId?: string) => Promise<void>;
  filterSession: CommunityViewerState['filterSession'];
  filterSessionGeneration: number;
  getAuthoredPosts: (userId?: string) => CommunityPost[];
  getBookmarkedPosts: (userId?: string) => CommunityPost[];
  getCommentCount: (postId: string) => number;
  getCommentedPosts: (userId?: string) => CommunityPost[];
  getCommentsByPostId: (postId: string) => CommunityComment[];
  getPostById: (postId: string) => CommunityPost | null;
  getReviewPostById: (postId: string) => ReviewPost | null;
  getReactionCount: (postId: string, kind: ReactionKind) => number;
  hasLoadError: boolean;
  isBookmarked: (postId: string) => boolean;
  isReady: boolean;
  isReacted: (postId: string, kind: ReactionKind) => boolean;
  posts: CommunityPost[];
  reloadCommunity: () => Promise<void>;
  reviewPosts: ReviewPost[];
  toggleBookmark: (postId: string) => Promise<MutationResult>;
  toggleReaction: (postId: string, kind: ReactionKind) => Promise<MutationResult>;
  updateComment: (commentId: string, body: string) => Promise<MutationResult>;
  updateFilterSession: (
    session: Partial<CommunityViewerState['filterSession']>,
    generation: number,
  ) => Promise<MutationResult>;
  updateMarketPost: (postId: string, post: MarketPostForm) => Promise<MutationResult>;
  updateMarketStatus: (postId: string, status: MarketStatus) => Promise<MutationResult>;
  updateReviewPost: (
    postId: string,
    post: Pick<ReviewPost, 'body' | 'detailScores' | 'images' | 'rating' | 'title' | 'visitedAt'>,
  ) => Promise<MutationResult>;
  updateTalkPost: (postId: string, post: TalkPostForm) => Promise<MutationResult>;
  viewerId: string;
};

const CommunityStoreContext = createContext<CommunityStoreContextValue | null>(null);

const EMPTY_STATE: StoredCommunityState = {
  comments: [],
  posts: [],
  reviewPosts: [],
  viewerStates: {},
};

const MAX_POST_BODY_LENGTH = 500;
const MAX_POST_TITLE_LENGTH = 40;
const TOGGLE_COOLDOWN_MS = 350;

function isValidPostText(title: string, body: string) {
  return Boolean(
    title &&
      body &&
      title.length <= MAX_POST_TITLE_LENGTH &&
      body.length <= MAX_POST_BODY_LENGTH,
  );
}

function isValidMarketPostInput(
  post: Pick<MarketPost, 'priceLabel' | 'tags' | 'tradeType'>,
) {
  return isValidMarketPriceLabel(post.tradeType, post.priceLabel) &&
    isValidMarketTradeMethodSelection(
      post.tradeType,
      getMarketTradeMethods(post.tags),
    );
}

function createViewerState(): CommunityViewerState {
  return {
    bookmarkedPostIds: [],
    filterSession: normalizeCommunityFilterSession(undefined),
    reactionPostIds: {},
  };
}

function getViewerStateFromMap(
  viewerStates: StoredCommunityState['viewerStates'],
  viewerId: string,
) {
  const viewerState = viewerStates[viewerId];
  if (!viewerState) return createViewerState();

  return {
    ...viewerState,
    filterSession: normalizeCommunityFilterSession(viewerState.filterSession),
  };
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CommunityProvider({ children }: PropsWithChildren) {
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const { profile } = useMyPageStore();
  const [state, setState] = useState<StoredCommunityState>(EMPTY_STATE);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [profileSyncRequest, setProfileSyncRequest] = useState(0);
  const [filterSessionGeneration, setFilterSessionGeneration] = useState(0);
  const stateRef = useRef<StoredCommunityState>(EMPTY_STATE);
  const readyRef = useRef(false);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingToggleKeysRef = useRef(new Set<string>());
  const lastToggleAtRef = useRef(new Map<string, number>());
  const syncedProfileRef = useRef('');
  const profileSyncAttemptsRef = useRef(new Map<string, number>());
  const activeViewerIdRef = useRef(currentUserId ?? COMMUNITY_GUEST_ID);
  const filterSessionGenerationRef = useRef(0);
  const viewerId = currentUserId ?? COMMUNITY_GUEST_ID;

  useEffect(() => {
    activeViewerIdRef.current = viewerId;
  }, [viewerId]);

  const applyState = useCallback((nextState: StoredCommunityState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const reloadCommunity = useCallback(async () => {
    setIsReady(false);
    setHasLoadError(false);
    readyRef.current = false;
    syncedProfileRef.current = '';
    profileSyncAttemptsRef.current.clear();

    try {
      const loadedState = await communityRepository.loadState();
      readyRef.current = true;
      applyState(loadedState);
    } catch {
      readyRef.current = false;
      setHasLoadError(true);
    } finally {
      setIsReady(true);
    }
  }, [applyState]);

  useEffect(() => {
    let active = true;
    setIsReady(false);
    setHasLoadError(false);
    syncedProfileRef.current = '';
    profileSyncAttemptsRef.current.clear();

    communityRepository
      .loadState()
      .then((loadedState) => {
        if (!active) return;
        readyRef.current = true;
        applyState(loadedState);
      })
      .catch(() => {
        if (!active) return;
        readyRef.current = false;
        setHasLoadError(true);
      })
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [applyState]);

  const enqueueMutation = useCallback(<T,>(mutation: () => Promise<T>) => {
    const result = mutationQueueRef.current.then(mutation, mutation);
    mutationQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  const persist = useCallback(
    async (nextState: StoredCommunityState) => {
      await communityRepository.saveState(nextState);
      applyState(nextState);
    },
    [applyState],
  );

  const persistMutation = useCallback(
    async (nextState: StoredCommunityState): Promise<MutationResult> => {
      try {
        await persist(nextState);
        return { ok: true };
      } catch {
        return { ok: false, reason: 'error' };
      }
    },
    [persist],
  );

  const persistMutationWithImageRemovals = useCallback(
    async (
      nextState: StoredCommunityState,
      userId: string,
      images?: CommunityPost['images'],
    ): Promise<MutationResult> => {
      try {
        await queueCommunityImageRemovals(userId, images);
      } catch {
        return { ok: false, reason: 'error' };
      }

      const result = await persistMutation(nextState);
      await communityRepository
        .flushImageRemovals(result.ok ? nextState : stateRef.current, userId)
        .catch(() => undefined);
      return result;
    },
    [persistMutation],
  );

  const mutateState = useCallback(
    (updater: (current: StoredCommunityState) => StoredCommunityState | MutationResult) =>
      enqueueMutation(async (): Promise<MutationResult> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };

        const result = updater(stateRef.current);
        if ('ok' in result) return result;

        return persistMutation(result);
      }),
    [enqueueMutation, persistMutation, sessionReady],
  );

  useEffect(() => {
    if (!currentUserId || !profile || !isReady || !readyRef.current) return;

    const signature = [
      currentUserId,
      profile.introduction,
      profile.location,
      profile.nickname,
      profile.profileImageUri ?? '',
      profile.updatedAt,
    ].join(':');
    if (syncedProfileRef.current === signature) return;
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    void mutateState((current) => {
      let changed = false;
      const syncAuthor = (author: CommunityAuthorSnapshot) => {
        if (author.userId !== currentUserId) return author;

        const nextAuthor = {
          ...author,
          introduction: profile.introduction,
          location: profile.location,
          nickname: profile.nickname,
          profileImageUri: profile.profileImageUri,
        };
        if (
          author.introduction === nextAuthor.introduction &&
          author.location === nextAuthor.location &&
          author.nickname === nextAuthor.nickname &&
          author.profileImageUri === nextAuthor.profileImageUri
        ) {
          return author;
        }

        changed = true;
        return nextAuthor;
      };

      const posts = current.posts.map((post) => ({
        ...post,
        author: syncAuthor(post.author),
      }));
      const reviewPosts = current.reviewPosts.map((post) => ({
        ...post,
        author: syncAuthor(post.author),
      }));
      const comments = current.comments.map((comment) => ({
        ...comment,
        author: syncAuthor(comment.author),
      }));

      return changed ? { ...current, comments, posts, reviewPosts } : { ok: true };
    }).then(async (result) => {
      if (!active) return;

      if (result.ok) {
        try {
          await flushQueuedProfileImageRemovals(currentUserId, [
            profile.profileImageUri,
          ]);
          if (!active) return;
          syncedProfileRef.current = signature;
          profileSyncAttemptsRef.current.delete(signature);
          return;
        } catch {
          if (!active) return;
        }
      }

      const attempts = (profileSyncAttemptsRef.current.get(signature) ?? 0) + 1;
      profileSyncAttemptsRef.current.set(signature, attempts);
      if (attempts < 3) {
        retryTimer = setTimeout(() => {
          if (active) setProfileSyncRequest((current) => current + 1);
        }, 500);
      }
    });

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [currentUserId, isReady, mutateState, profile, profileSyncRequest]);

  const runSingleToggle = useCallback(
    async (key: string, mutation: () => Promise<MutationResult>) => {
      const now = Date.now();
      const lastToggleAt = lastToggleAtRef.current.get(key) ?? 0;
      if (
        pendingToggleKeysRef.current.has(key) ||
        now - lastToggleAt < TOGGLE_COOLDOWN_MS
      ) {
        return { ok: true } as const;
      }

      pendingToggleKeysRef.current.add(key);
      try {
        const result = await mutation();
        if (result.ok) lastToggleAtRef.current.set(key, Date.now());
        return result;
      } finally {
        pendingToggleKeysRef.current.delete(key);
      }
    },
    [],
  );

  const getPostById = useCallback(
    (postId: string) => stateRef.current.posts.find((post) => post.id === postId) ?? null,
    [],
  );

  const getReviewPostById = useCallback(
    (postId: string) =>
      stateRef.current.reviewPosts.find((post) => post.id === postId) ?? null,
    [],
  );

  const getCommentsByPostId = useCallback(
    (postId: string) =>
      stateRef.current.comments
        .filter((comment) => comment.postId === postId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [],
  );

  const getCommentCount = useCallback(
    (postId: string) => stateRef.current.comments.filter((comment) => comment.postId === postId).length,
    [],
  );

  const isReacted = useCallback(
    (postId: string, kind: ReactionKind) =>
      Boolean(getViewerStateFromMap(state.viewerStates, viewerId).reactionPostIds[kind]?.includes(postId)),
    [state.viewerStates, viewerId],
  );

  const getReactionCount = useCallback((postId: string, kind: ReactionKind) => {
    const post =
      stateRef.current.posts.find((current) => current.id === postId) ??
      stateRef.current.reviewPosts.find((current) => current.id === postId);
    const baseCount = post?.baseReactionCounts?.[kind] ?? 0;
    const viewerCount = Object.values(state.viewerStates).filter((viewerState) =>
      viewerState.reactionPostIds[kind]?.includes(postId),
    ).length;
    return baseCount + viewerCount;
  }, [state.viewerStates]);

  const isBookmarked = useCallback(
    (postId: string) => getViewerStateFromMap(state.viewerStates, viewerId).bookmarkedPostIds.includes(postId),
    [state.viewerStates, viewerId],
  );

  const toggleReaction = useCallback(
    (postId: string, kind: ReactionKind) =>
      runSingleToggle(`reaction:${viewerId}:${postId}:${kind}`, () =>
        mutateState((current) => {
          if (kind === 'like') {
            const talkPost = current.posts.find((post) => post.id === postId);
            if (!talkPost || talkPost.kind !== 'talk') {
              return { ok: false, reason: 'not-found' };
            }
          } else {
            const reviewPost = current.reviewPosts.find((post) => post.id === postId);
            if (!reviewPost) return { ok: false, reason: 'not-found' };
            if (reviewPost.author.userId === viewerId) {
              return { ok: false, reason: 'not-yours' };
            }
          }

          const previous = getViewerStateFromMap(current.viewerStates, viewerId);
          const exclusiveKind =
            kind === 'helpful' ? 'notHelpful' : kind === 'notHelpful' ? 'helpful' : null;
          const nextReactionPostIds = {
            ...previous.reactionPostIds,
            ...(exclusiveKind
              ? {
                  [exclusiveKind]: (previous.reactionPostIds[exclusiveKind] ?? []).filter(
                    (id) => id !== postId,
                  ),
                }
              : {}),
            [kind]: toggleValue(previous.reactionPostIds[kind] ?? [], postId),
          };

          return {
            ...current,
            viewerStates: {
              ...current.viewerStates,
              [viewerId]: {
                ...previous,
                reactionPostIds: nextReactionPostIds,
              },
            },
          };
        }),
      ),
    [mutateState, runSingleToggle, viewerId],
  );

  const toggleBookmark = useCallback(
    (postId: string) =>
      runSingleToggle(`bookmark:${viewerId}:${postId}`, () =>
        mutateState((current) => {
          const marketPost = current.posts.find((post) => post.id === postId);
          if (!marketPost || marketPost.kind !== 'market') {
            return { ok: false, reason: 'not-found' };
          }

          const previous = getViewerStateFromMap(current.viewerStates, viewerId);
          return {
            ...current,
            viewerStates: {
              ...current.viewerStates,
              [viewerId]: {
                ...previous,
                bookmarkedPostIds: toggleValue(previous.bookmarkedPostIds, postId),
              },
            },
          };
        }),
      ),
    [mutateState, runSingleToggle, viewerId],
  );

  const addComment = useCallback(
    (postId: string, body: string, author: CommunityAuthorSnapshot, parentId?: string) =>
      mutateState((current) => {
        const trimmedBody = body.trim();
        if (!trimmedBody) return { ok: false, reason: 'empty' };
        if (author.userId !== viewerId) return { ok: false, reason: 'not-yours' };
        const talkPost = current.posts.find((post) => post.id === postId);
        if (!talkPost || talkPost.kind !== 'talk') {
          return { ok: false, reason: 'not-found' };
        }
        const parentComment = parentId
          ? current.comments.find(
              (comment) => comment.id === parentId && comment.postId === postId,
            )
          : null;
        if (parentId && (!parentComment || parentComment.deletedAt)) {
          return { ok: false, reason: 'not-found' };
        }

        const now = new Date().toISOString();
        const comment: CommunityComment = {
          author,
          body: trimmedBody,
          createdAt: now,
          id: createId('comment'),
          parentId: parentComment?.parentId ?? parentComment?.id,
          postId,
          updatedAt: now,
        };

        return {
          ...current,
          comments: [...current.comments, comment],
        };
      }),
    [mutateState, viewerId],
  );

  const addTalkPost = useCallback(
    (post: Omit<TalkPost, 'createdAt' | 'id' | 'kind' | 'updatedAt'>) =>
      enqueueMutation(async (): Promise<MutationResult & { postId?: string }> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };
        if (post.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };

        const trimmedTitle = post.title.trim();
        const trimmedBody = post.body.trim();
        if (!isValidPostText(trimmedTitle, trimmedBody)) return { ok: false, reason: 'empty' };

        const now = new Date().toISOString();
        const postId = createId('talk');
        const saveResult = await persistMutation({
          ...stateRef.current,
          posts: [
            {
              ...post,
              body: trimmedBody,
              createdAt: now,
              id: postId,
              kind: 'talk',
              tags: post.tags.map((tag) => tag.trim()).filter(Boolean),
              title: trimmedTitle,
              updatedAt: now,
            },
            ...stateRef.current.posts,
          ],
        });
        if (!saveResult.ok) return saveResult;
        return { ok: true, postId };
      }),
    [enqueueMutation, persistMutation, sessionReady, viewerId],
  );

  const addMarketPost = useCallback(
    (post: Omit<MarketPost, 'createdAt' | 'id' | 'kind' | 'updatedAt'>) =>
      enqueueMutation(async (): Promise<MutationResult & { postId?: string }> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };
        if (post.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };

        const trimmedTitle = post.title.trim();
        const trimmedBody = post.body.trim();
        if (
          !isValidPostText(trimmedTitle, trimmedBody) ||
          !isValidMarketPostInput(post)
        ) {
          return { ok: false, reason: 'empty' };
        }

        const now = new Date().toISOString();
        const postId = createId('market');
        const saveResult = await persistMutation({
          ...stateRef.current,
          posts: [
            {
              ...post,
              body: trimmedBody,
              createdAt: now,
              id: postId,
              kind: 'market',
              tags: post.tags.map((tag) => tag.trim()).filter(Boolean),
              title: trimmedTitle,
              updatedAt: now,
            },
            ...stateRef.current.posts,
          ],
        });
        if (!saveResult.ok) return saveResult;
        return { ok: true, postId };
      }),
    [enqueueMutation, persistMutation, sessionReady, viewerId],
  );

  const addReviewPost = useCallback(
    (post: Omit<ReviewPost, 'createdAt' | 'id'>) =>
      enqueueMutation(async (): Promise<MutationResult & { postId?: string }> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };
        if (post.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };

        const reviewInput = getValidReviewInput(post);
        const targetName = getValidReviewTarget(post.targetName);
        if (!reviewInput || !targetName) return { ok: false, reason: 'empty' };

        const now = new Date().toISOString();
        const postId = createId('review');
        const saveResult = await persistMutation({
          ...stateRef.current,
          reviewPosts: [
            {
              ...post,
              body: reviewInput.body,
              createdAt: now,
              id: postId,
              targetName,
              title: reviewInput.title,
              visitedAt: reviewInput.visitedAt,
            },
            ...stateRef.current.reviewPosts,
          ],
        });
        if (!saveResult.ok) return saveResult;
        return { ok: true, postId };
      }),
    [enqueueMutation, persistMutation, sessionReady, viewerId],
  );

  const updateComment = useCallback(
    (commentId: string, body: string) =>
      mutateState((current) => {
        const trimmedBody = body.trim();
        if (!trimmedBody) return { ok: false, reason: 'empty' };

        const comment = current.comments.find((currentComment) => currentComment.id === commentId);
        if (!comment) return { ok: false, reason: 'not-found' };
        if (comment.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };
        if (comment.deletedAt) return { ok: false, reason: 'not-found' };

        return {
          ...current,
          comments: current.comments.map((currentComment) =>
            currentComment.id === commentId
              ? { ...currentComment, body: trimmedBody, updatedAt: new Date().toISOString() }
              : currentComment,
          ),
        };
      }),
    [mutateState, viewerId],
  );

  const updateMarketStatus = useCallback(
    (postId: string, status: MarketStatus) =>
      mutateState((current) => {
        const post = current.posts.find((currentPost) => currentPost.id === postId);
        if (!post) return { ok: false, reason: 'not-found' };
        if (post.kind !== 'market') return { ok: false, reason: 'not-found' };
        if (post.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };
        if (post.status === status) return current;
        if (post.status === '완료') return { ok: false, reason: 'not-ready' };

        return {
          ...current,
          posts: current.posts.map((currentPost) =>
            currentPost.id === postId && currentPost.kind === 'market'
              ? { ...currentPost, status, updatedAt: new Date().toISOString() }
              : currentPost,
          ),
        };
      }),
    [mutateState, viewerId],
  );

  const updateTalkPost = useCallback(
    (postId: string, post: TalkPostForm) =>
      enqueueMutation(async (): Promise<MutationResult> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };

        const current = stateRef.current;
        const previousPost = current.posts.find((currentPost) => currentPost.id === postId);
        if (!previousPost) return { ok: false, reason: 'not-found' };
        if (previousPost.kind !== 'talk') return { ok: false, reason: 'not-found' };
        if (previousPost.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };

        const trimmedTitle = post.title.trim();
        const trimmedBody = post.body.trim();
        if (!isValidPostText(trimmedTitle, trimmedBody)) return { ok: false, reason: 'empty' };

        const nextImages = post.images ?? [];
        const nextImageIds = new Set(nextImages.map((image) => image.assetId));
        const removedImages = previousPost.images?.filter((image) => !nextImageIds.has(image.assetId)) ?? [];
        const now = new Date().toISOString();

        const nextState: StoredCommunityState = {
          ...current,
          posts: current.posts.map((currentPost) =>
            currentPost.id === postId && currentPost.kind === 'talk'
              ? {
                  ...currentPost,
                  body: trimmedBody,
                  category: post.category,
                  images: nextImages,
                  showNeighborhood: post.showNeighborhood,
                  tags: post.tags.map((tag) => tag.trim()).filter(Boolean),
                  title: trimmedTitle,
                  updatedAt: now,
                }
              : currentPost,
          ),
        };
        return persistMutationWithImageRemovals(
          nextState,
          viewerId,
          removedImages,
        );
      }),
    [
      enqueueMutation,
      persistMutationWithImageRemovals,
      sessionReady,
      viewerId,
    ],
  );

  const updateMarketPost = useCallback(
    (postId: string, post: MarketPostForm) =>
      enqueueMutation(async (): Promise<MutationResult> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };

        const current = stateRef.current;
        const previousPost = current.posts.find((currentPost) => currentPost.id === postId);
        if (!previousPost) return { ok: false, reason: 'not-found' };
        if (previousPost.kind !== 'market') return { ok: false, reason: 'not-found' };
        if (previousPost.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };

        const trimmedTitle = post.title.trim();
        const trimmedBody = post.body.trim();
        if (
          !isValidPostText(trimmedTitle, trimmedBody) ||
          !isValidMarketPostInput(post)
        ) {
          return { ok: false, reason: 'empty' };
        }

        const nextImages = post.images ?? [];
        const nextImageIds = new Set(nextImages.map((image) => image.assetId));
        const removedImages = previousPost.images?.filter((image) => !nextImageIds.has(image.assetId)) ?? [];
        const now = new Date().toISOString();

        const nextState: StoredCommunityState = {
          ...current,
          posts: current.posts.map((currentPost) =>
            currentPost.id === postId && currentPost.kind === 'market'
              ? {
                  ...currentPost,
                  body: trimmedBody,
                  category: post.category,
                  expiresAt: post.expiresAt?.trim() || undefined,
                  imageCount: post.imageCount,
                  images: nextImages,
                  location: post.location.trim(),
                  priceLabel: post.priceLabel.trim(),
                  tags: post.tags.map((tag) => tag.trim()).filter(Boolean),
                  title: trimmedTitle,
                  tradeType: post.tradeType,
                  updatedAt: now,
                }
              : currentPost,
          ),
        };
        return persistMutationWithImageRemovals(
          nextState,
          viewerId,
          removedImages,
        );
      }),
    [
      enqueueMutation,
      persistMutationWithImageRemovals,
      sessionReady,
      viewerId,
    ],
  );

  const deleteComment = useCallback(
    (commentId: string) =>
      mutateState((current) => {
        const comment = current.comments.find((currentComment) => currentComment.id === commentId);
        if (!comment) return { ok: false, reason: 'not-found' };
        if (comment.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };
        if (comment.deletedAt) return { ok: false, reason: 'not-found' };

        const hasReplies = current.comments.some(
          (currentComment) =>
            currentComment.parentId === commentId && !currentComment.deletedAt,
        );
        const commentsWithoutTarget = current.comments.filter(
          (currentComment) => currentComment.id !== commentId,
        );
        const deletedParentId = comment.parentId;
        const deletedParent = deletedParentId
          ? commentsWithoutTarget.find(
              (currentComment) => currentComment.id === deletedParentId,
            )
          : null;
        const hasRemainingReplies = deletedParentId
          ? commentsWithoutTarget.some(
              (currentComment) =>
                currentComment.parentId === deletedParentId &&
                !currentComment.deletedAt,
            )
          : false;

        return {
          ...current,
          comments: hasReplies
            ? current.comments.map((currentComment) =>
                currentComment.id === commentId
                  ? getDeletedComment(currentComment)
                  : currentComment,
              )
            : deletedParent?.deletedAt && !hasRemainingReplies
              ? commentsWithoutTarget.filter(
                  (currentComment) => currentComment.id !== deletedParentId,
                )
              : commentsWithoutTarget,
        };
      }),
    [mutateState, viewerId],
  );

  const deletePost = useCallback(
    (postId: string) =>
      enqueueMutation(async (): Promise<MutationResult> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };

        const current = stateRef.current;
        const post = current.posts.find((currentPost) => currentPost.id === postId);
        if (!post) return { ok: false, reason: 'not-found' };
        if (post.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };
        if (post.kind === 'market' && post.status !== '진행 중') {
          return { ok: false, reason: 'not-ready' };
        }

        const viewerStates = Object.fromEntries(
          Object.entries(current.viewerStates).map(([currentViewerId, viewerState]) => [
            currentViewerId,
            {
              ...viewerState,
              bookmarkedPostIds: viewerState.bookmarkedPostIds.filter((id) => id !== postId),
              reactionPostIds: Object.fromEntries(
                Object.entries(viewerState.reactionPostIds).map(([kind, postIds]) => [
                  kind,
                  postIds.filter((id) => id !== postId),
                ]),
              ),
            },
          ]),
        );

        const nextState: StoredCommunityState = {
          ...current,
          comments: current.comments.filter((comment) => comment.postId !== postId),
          posts: current.posts.filter((currentPost) => currentPost.id !== postId),
          viewerStates,
        };
        return persistMutationWithImageRemovals(nextState, viewerId, post.images);
      }),
    [
      enqueueMutation,
      persistMutationWithImageRemovals,
      sessionReady,
      viewerId,
    ],
  );

  const updateReviewPost = useCallback(
    (
      postId: string,
      post: Pick<ReviewPost, 'body' | 'detailScores' | 'images' | 'rating' | 'title' | 'visitedAt'>,
    ) =>
      enqueueMutation(async (): Promise<MutationResult> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };

        const current = stateRef.current;
        const previousPost = current.reviewPosts.find((currentPost) => currentPost.id === postId);
        if (!previousPost) return { ok: false, reason: 'not-found' };
        if (previousPost.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };

        const reviewInput = getValidReviewInput(post);
        if (!reviewInput) return { ok: false, reason: 'empty' };

        const nextImages = post.images ?? [];
        const nextImageIds = new Set(nextImages.map((image) => image.assetId));
        const removedImages = previousPost.images?.filter((image) => !nextImageIds.has(image.assetId)) ?? [];

        const nextState: StoredCommunityState = {
          ...current,
          reviewPosts: current.reviewPosts.map((currentPost) =>
            currentPost.id === postId
              ? {
                  ...currentPost,
                  body: reviewInput.body,
                  detailScores: post.detailScores,
                  images: nextImages,
                  rating: post.rating,
                  title: reviewInput.title,
                  visitedAt: reviewInput.visitedAt,
                }
              : currentPost,
          ),
        };
        return persistMutationWithImageRemovals(
          nextState,
          viewerId,
          removedImages,
        );
      }),
    [
      enqueueMutation,
      persistMutationWithImageRemovals,
      sessionReady,
      viewerId,
    ],
  );

  const deleteReviewPost = useCallback(
    (postId: string) =>
      enqueueMutation(async (): Promise<MutationResult> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };

        const current = stateRef.current;
        const post = current.reviewPosts.find((currentPost) => currentPost.id === postId);
        if (!post) return { ok: false, reason: 'not-found' };
        if (post.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };

        const viewerStates = Object.fromEntries(
          Object.entries(current.viewerStates).map(([currentViewerId, viewerState]) => [
            currentViewerId,
            {
              ...viewerState,
              bookmarkedPostIds: viewerState.bookmarkedPostIds.filter((id) => id !== postId),
              reactionPostIds: Object.fromEntries(
                Object.entries(viewerState.reactionPostIds).map(([kind, postIds]) => [
                  kind,
                  postIds.filter((id) => id !== postId),
                ]),
              ),
            },
          ]),
        );

        const nextState: StoredCommunityState = {
          ...current,
          comments: current.comments.filter((comment) => comment.postId !== postId),
          reviewPosts: current.reviewPosts.filter((currentPost) => currentPost.id !== postId),
          viewerStates,
        };
        return persistMutationWithImageRemovals(nextState, viewerId, post.images);
      }),
    [
      enqueueMutation,
      persistMutationWithImageRemovals,
      sessionReady,
      viewerId,
    ],
  );

  const getBookmarkedPosts = useCallback(
    (userId?: string) => {
      const targetViewerId = userId ?? viewerId;
      const bookmarkedPostIds = getViewerStateFromMap(
        state.viewerStates,
        targetViewerId,
      ).bookmarkedPostIds;
      return stateRef.current.posts
        .filter((post) => bookmarkedPostIds.includes(post.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    [state.viewerStates, viewerId],
  );

  const getAuthoredPosts = useCallback(
    (userId?: string) => {
      const targetViewerId = userId ?? viewerId;
      return stateRef.current.posts
        .filter((post) => post.author.userId === targetViewerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    [viewerId],
  );

  const getCommentedPosts = useCallback(
    (userId?: string) => {
      const targetViewerId = userId ?? viewerId;
      const commentedPostIds = new Set(
        stateRef.current.comments
          .filter((comment) => comment.author.userId === targetViewerId)
          .map((comment) => comment.postId),
      );
      return stateRef.current.posts
        .filter((post) => commentedPostIds.has(post.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    [viewerId],
  );

  const filterSession = useMemo(
    () => getViewerStateFromMap(state.viewerStates, viewerId).filterSession,
    [state.viewerStates, viewerId],
  );

  const updateFilterSession = useCallback(
    (
      session: Partial<CommunityViewerState['filterSession']>,
      generation: number,
    ) => {
      const ownerViewerId = viewerId;
      if (
        generation !== filterSessionGenerationRef.current ||
        ownerViewerId !== activeViewerIdRef.current
      ) {
        return Promise.resolve({ ok: false, reason: 'not-ready' } as const);
      }

      return mutateState((current) => {
        if (
          generation !== filterSessionGenerationRef.current ||
          ownerViewerId !== activeViewerIdRef.current
        ) {
          return { ok: false, reason: 'not-ready' };
        }
        const previous = getViewerStateFromMap(current.viewerStates, viewerId);

        return {
          ...current,
          viewerStates: {
            ...current.viewerStates,
            [viewerId]: {
              ...previous,
              filterSession: normalizeCommunityFilterSession({
                ...previous.filterSession,
                ...session,
              }),
            },
          },
        };
      });
    },
    [mutateState, viewerId],
  );

  const clearScreenSession = useCallback(async () => {
    const sessionViewerId = viewerId;
    const nextGeneration = filterSessionGenerationRef.current + 1;
    filterSessionGenerationRef.current = nextGeneration;

    try {
      const [draftResult, filterResult] = await Promise.allSettled([
        communityRepository.clearWriteDrafts(sessionViewerId),
        enqueueMutation(async () => {
          const current = readyRef.current
            ? stateRef.current
            : await communityRepository.loadState();
          const previous = getViewerStateFromMap(current.viewerStates, sessionViewerId);
          await persist({
            ...current,
            viewerStates: {
              ...current.viewerStates,
              [sessionViewerId]: {
                ...previous,
                filterSession: normalizeCommunityFilterSession(undefined),
              },
            },
          });
        }),
      ]);
      if (
        draftResult.status === 'rejected' ||
        filterResult.status === 'rejected'
      ) {
        throw new Error('community-session-clear-failed');
      }
    } finally {
      setFilterSessionGeneration(nextGeneration);
    }
  }, [enqueueMutation, persist, viewerId]);

  const deleteUserCommunityData = useCallback(
    (userId?: string) =>
      enqueueMutation(async () => {
        const resolvedUserId = userId ?? currentUserId;
        if (!resolvedUserId) return;
        await communityRepository.deleteUserState(resolvedUserId);
        const nextState = await communityRepository.loadState();
        applyState(nextState);
      }),
    [applyState, currentUserId, enqueueMutation],
  );

  const value = useMemo<CommunityStoreContextValue>(
    () => ({
      addComment,
      addMarketPost,
      addReviewPost,
      addTalkPost,
      clearScreenSession,
      comments: state.comments,
      deleteComment,
      deletePost,
      deleteReviewPost,
      deleteUserCommunityData,
      filterSession,
      filterSessionGeneration,
      getAuthoredPosts,
      getBookmarkedPosts,
      getCommentCount,
      getCommentedPosts,
      getCommentsByPostId,
      getPostById,
      getReviewPostById,
      getReactionCount,
      hasLoadError,
      isBookmarked,
      isReady,
      isReacted,
      posts: state.posts,
      reloadCommunity,
      reviewPosts: state.reviewPosts,
      toggleBookmark,
      toggleReaction,
      updateComment,
      updateFilterSession,
      updateMarketPost,
      updateMarketStatus,
      updateReviewPost,
      updateTalkPost,
      viewerId,
    }),
    [
      addComment,
      addMarketPost,
      addReviewPost,
      addTalkPost,
      clearScreenSession,
      deleteComment,
      deletePost,
      deleteReviewPost,
      deleteUserCommunityData,
      filterSession,
      filterSessionGeneration,
      getAuthoredPosts,
      getBookmarkedPosts,
      getCommentCount,
      getCommentedPosts,
      getCommentsByPostId,
      getPostById,
      getReviewPostById,
      getReactionCount,
      hasLoadError,
      isBookmarked,
      isReady,
      isReacted,
      reloadCommunity,
      state.comments,
      state.posts,
      state.reviewPosts,
      toggleBookmark,
      toggleReaction,
      updateComment,
      updateFilterSession,
      updateMarketPost,
      updateMarketStatus,
      updateReviewPost,
      updateTalkPost,
      viewerId,
    ],
  );

  return <CommunityStoreContext.Provider value={value}>{children}</CommunityStoreContext.Provider>;
}

export function useCommunityStore() {
  const context = useContext(CommunityStoreContext);

  if (!context) {
    throw new Error('useCommunityStore must be used inside CommunityProvider.');
  }

  return context;
}
