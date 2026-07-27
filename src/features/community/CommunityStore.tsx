import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';

import { COMMUNITY_GUEST_ID } from './communityData';
import { communityRepository } from './services/communityRepository';
import type {
  CommunityAuthorSnapshot,
  CommunityComment,
  CommunityPost,
  CommunityViewerState,
  MarketPost,
  ReactionKind,
  ReviewPost,
  StoredCommunityState,
  TalkPost,
} from './types';

type MutationResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'error' | 'not-found' | 'not-ready' | 'not-yours' };

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
  clearScreenSession: () => void;
  comments: CommunityComment[];
  deleteComment: (commentId: string) => Promise<MutationResult>;
  deletePost: (postId: string) => Promise<MutationResult>;
  deleteUserCommunityData: (userId?: string) => Promise<void>;
  getAuthoredPosts: (userId?: string) => CommunityPost[];
  getBookmarkedPosts: (userId?: string) => CommunityPost[];
  getCommentCount: (postId: string) => number;
  getCommentedPosts: (userId?: string) => CommunityPost[];
  getCommentsByPostId: (postId: string) => CommunityComment[];
  getPostById: (postId: string) => CommunityPost | null;
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
  viewerId: string;
};

const CommunityStoreContext = createContext<CommunityStoreContextValue | null>(null);

const EMPTY_STATE: StoredCommunityState = {
  comments: [],
  posts: [],
  reviewPosts: [],
  viewerStates: {},
};

const DEFAULT_FILTER_SESSION: CommunityViewerState['filterSession'] = {
  marketCategory: '전체',
  marketStatuses: [],
  marketTradeTypes: [],
  talkCategory: '전체',
};

function createViewerState(): CommunityViewerState {
  return {
    bookmarkedPostIds: [],
    filterSession: { ...DEFAULT_FILTER_SESSION },
    reactionPostIds: {},
  };
}

function getViewerState(state: StoredCommunityState, viewerId: string) {
  return state.viewerStates[viewerId] ?? createViewerState();
}

function getViewerStateFromMap(
  viewerStates: StoredCommunityState['viewerStates'],
  viewerId: string,
) {
  return viewerStates[viewerId] ?? createViewerState();
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
  const [state, setState] = useState<StoredCommunityState>(EMPTY_STATE);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const stateRef = useRef<StoredCommunityState>(EMPTY_STATE);
  const readyRef = useRef(false);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const viewerId = currentUserId ?? COMMUNITY_GUEST_ID;

  const applyState = useCallback((nextState: StoredCommunityState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const reloadCommunity = useCallback(async () => {
    setIsReady(false);
    setHasLoadError(false);
    readyRef.current = false;

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

  const getPostById = useCallback(
    (postId: string) => stateRef.current.posts.find((post) => post.id === postId) ?? null,
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
      mutateState((current) => {
        const postExists =
          current.posts.some((post) => post.id === postId) ||
          current.reviewPosts.some((post) => post.id === postId);

        if (!postExists) {
          return { ok: false, reason: 'not-found' };
        }

        const previous = getViewerState(current, viewerId);
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
    [mutateState, viewerId],
  );

  const toggleBookmark = useCallback(
    (postId: string) =>
      mutateState((current) => {
        if (!current.posts.some((post) => post.id === postId)) {
          return { ok: false, reason: 'not-found' };
        }

        const previous = getViewerState(current, viewerId);
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
    [mutateState, viewerId],
  );

  const addComment = useCallback(
    (postId: string, body: string, author: CommunityAuthorSnapshot, parentId?: string) =>
      mutateState((current) => {
        const trimmedBody = body.trim();
        if (!trimmedBody) return { ok: false, reason: 'empty' };
        if (!current.posts.some((post) => post.id === postId)) {
          return { ok: false, reason: 'not-found' };
        }
        const parentComment = parentId
          ? current.comments.find(
              (comment) => comment.id === parentId && comment.postId === postId,
            )
          : null;
        if (parentId && !parentComment) return { ok: false, reason: 'not-found' };

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
    [mutateState],
  );

  const addTalkPost = useCallback(
    (post: Omit<TalkPost, 'createdAt' | 'id' | 'kind' | 'updatedAt'>) =>
      enqueueMutation(async (): Promise<MutationResult & { postId?: string }> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };

        const trimmedTitle = post.title.trim();
        const trimmedBody = post.body.trim();
        if (!trimmedTitle || !trimmedBody) return { ok: false, reason: 'empty' };

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
    [enqueueMutation, persistMutation, sessionReady],
  );

  const addMarketPost = useCallback(
    (post: Omit<MarketPost, 'createdAt' | 'id' | 'kind' | 'updatedAt'>) =>
      enqueueMutation(async (): Promise<MutationResult & { postId?: string }> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };

        const trimmedTitle = post.title.trim();
        const trimmedBody = post.body.trim();
        if (!trimmedTitle || !trimmedBody) return { ok: false, reason: 'empty' };

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
    [enqueueMutation, persistMutation, sessionReady],
  );

  const addReviewPost = useCallback(
    (post: Omit<ReviewPost, 'createdAt' | 'id'>) =>
      enqueueMutation(async (): Promise<MutationResult & { postId?: string }> => {
        if (!sessionReady || !readyRef.current) return { ok: false, reason: 'not-ready' };

        const trimmedTitle = post.title.trim();
        const trimmedBody = post.body.trim();
        if (!trimmedTitle || !trimmedBody) return { ok: false, reason: 'empty' };

        const now = new Date().toISOString();
        const postId = createId('review');
        const saveResult = await persistMutation({
          ...stateRef.current,
          reviewPosts: [
            {
              ...post,
              body: trimmedBody,
              createdAt: now,
              id: postId,
              targetName: post.targetName?.trim(),
              title: trimmedTitle,
              visitedAt: post.visitedAt?.trim(),
            },
            ...stateRef.current.reviewPosts,
          ],
        });
        if (!saveResult.ok) return saveResult;
        return { ok: true, postId };
      }),
    [enqueueMutation, persistMutation, sessionReady],
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

  const deleteComment = useCallback(
    (commentId: string) =>
      mutateState((current) => {
        const comment = current.comments.find((currentComment) => currentComment.id === commentId);
        if (!comment) return { ok: false, reason: 'not-found' };
        if (comment.author.userId !== viewerId) return { ok: false, reason: 'not-yours' };
        if (comment.deletedAt) return { ok: false, reason: 'not-found' };

        const now = new Date().toISOString();

        return {
          ...current,
          comments: current.comments.map((currentComment) =>
            currentComment.id === commentId
              ? {
                  ...currentComment,
                  author: {
                    nickname: '',
                    profileImageUri: null,
                    userId: `deleted-${commentId}`,
                  },
                  body: '삭제된 댓글입니다.',
                  deletedAt: now,
                  updatedAt: now,
                }
              : currentComment,
          ),
        };
      }),
    [mutateState, viewerId],
  );

  const deletePost = useCallback(
    (postId: string) =>
      mutateState((current) => {
        const post = current.posts.find((currentPost) => currentPost.id === postId);
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

        return {
          ...current,
          comments: current.comments.filter((comment) => comment.postId !== postId),
          posts: current.posts.filter((currentPost) => currentPost.id !== postId),
          viewerStates,
        };
      }),
    [mutateState, viewerId],
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

  const clearScreenSession = useCallback(() => {
    void mutateState((current) => {
      const previous = getViewerState(current, viewerId);

      return {
        ...current,
        viewerStates: {
          ...current.viewerStates,
          [viewerId]: {
            ...previous,
            filterSession: { ...DEFAULT_FILTER_SESSION },
          },
        },
      };
    });
  }, [mutateState, viewerId]);

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
      deleteUserCommunityData,
      getAuthoredPosts,
      getBookmarkedPosts,
      getCommentCount,
      getCommentedPosts,
      getCommentsByPostId,
      getPostById,
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
      deleteUserCommunityData,
      getAuthoredPosts,
      getBookmarkedPosts,
      getCommentCount,
      getCommentedPosts,
      getCommentsByPostId,
      getPostById,
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
