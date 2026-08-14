import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';

import {
  flushQueuedChatImageRemovals,
  getChatImageAssetKey,
  persistChatImages,
  queueChatImageRemovals,
  removeChatImages,
} from './services/chatImageStorage';
import {
  chatRepository,
  EMPTY_CHAT_STATE,
  getDirectChatRoomKey,
  getMarketChatRoomKey,
} from './services/chatRepository';
import type {
  ChatDraft,
  ChatImageAsset,
  ChatMessage,
  ChatMessageMutationResult,
  ChatMutationResult,
  ChatParticipantSnapshot,
  ChatPostReferenceSnapshot,
  ChatRoom,
  ChatRoomMutationResult,
  ChatViewerState,
  StoredChatState,
} from './types';

export type ChatMockRoomSeed = {
  messages: {
    createdAt: string;
    from: 'me' | 'other';
    status?: 'failed' | 'sent';
    text: string;
  }[];
  otherParticipant: ChatParticipantSnapshot;
  postReference?: ChatPostReferenceSnapshot;
  unreadCount?: number;
};

type ChatStoreContextValue = {
  addDraftImages: (roomId: string, sourceUris: string[]) => Promise<ChatMutationResult>;
  bootstrapMockRooms: (
    me: ChatParticipantSnapshot,
    seeds: ChatMockRoomSeed[],
  ) => Promise<ChatMutationResult>;
  canSendMessage: (roomId: string) => boolean;
  clearScreenSession: () => Promise<void>;
  deleteUserChatData: (userId?: string) => Promise<void>;
  getDraft: (roomId: string) => ChatDraft;
  getMessages: (roomId: string) => ChatMessage[];
  getOtherParticipant: (room: ChatRoom) => ChatParticipantSnapshot | null;
  getRoomById: (roomId: string) => ChatRoom | null;
  getUnreadCount: (roomId: string) => number;
  hasLoadError: boolean;
  isReady: boolean;
  markPostDeleted: (postId: string) => Promise<ChatMutationResult>;
  markRoomRead: (roomId: string) => Promise<ChatMutationResult>;
  openMarketRoom: (
    buyer: ChatParticipantSnapshot,
    seller: ChatParticipantSnapshot,
    postReference: ChatPostReferenceSnapshot,
  ) => Promise<ChatRoomMutationResult>;
  reloadChat: () => void;
  removeDraftImage: (roomId: string, assetId: string) => Promise<ChatMutationResult>;
  retryMessage: (messageId: string) => Promise<ChatMessageMutationResult>;
  rooms: ChatRoom[];
  searchQuery: string;
  sendDraft: (roomId: string) => Promise<ChatMessageMutationResult>;
  setSearchQuery: (query: string) => Promise<ChatMutationResult>;
  syncParticipant: (participant: ChatParticipantSnapshot) => Promise<ChatMutationResult>;
  syncPostReference: (reference: ChatPostReferenceSnapshot) => Promise<ChatMutationResult>;
  totalUnreadCount: number;
  updateDraftText: (roomId: string, text: string) => Promise<ChatMutationResult>;
};

const ChatStoreContext = createContext<ChatStoreContextValue | null>(null);
const EMPTY_DRAFT: ChatDraft = { images: [], text: '', updatedAt: '' };
const MAX_MESSAGE_LENGTH = 1000;
const MAX_IMAGE_COUNT = 5;

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createViewerState(): ChatViewerState {
  return { drafts: {}, lastReadMessageIds: {}, searchQuery: '' };
}

function getViewerState(state: StoredChatState, userId: string) {
  return state.viewerStates[userId] ?? createViewerState();
}

function getRoomMessages(state: StoredChatState, roomId: string) {
  return state.messages
    .filter((message) => message.roomId === roomId)
    .sort((first, second) =>
      first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id),
    );
}

function getVisibleRoomMessages(
  state: StoredChatState,
  roomId: string,
  userId: string,
) {
  return getRoomMessages(state, roomId).filter(
    (message) => message.status === 'sent' || message.senderId === userId,
  );
}

function getLastSentMessage(state: StoredChatState, roomId: string) {
  return (
    getRoomMessages(state, roomId)
      .filter((message) => message.status === 'sent')
      .at(-1) ?? null
  );
}

function getRetainedImageIds(state: StoredChatState) {
  return new Set(
    [
      ...state.messages.flatMap((message) => message.images ?? []),
      ...Object.values(state.viewerStates).flatMap((viewerState) =>
        Object.values(viewerState.drafts).flatMap((draft) => draft.images),
      ),
    ].map(getChatImageAssetKey),
  );
}

function hasParticipant(room: ChatRoom, userId: string) {
  return room.participants.some((participant) => participant.userId === userId);
}

function sameParticipant(
  first: ChatParticipantSnapshot,
  second: ChatParticipantSnapshot,
) {
  return (
    first.introduction === second.introduction &&
    first.location === second.location &&
    first.nickname === second.nickname &&
    first.petName === second.petName &&
    first.profileImageUri === second.profileImageUri &&
    first.userId === second.userId &&
    first.withdrawnAt === second.withdrawnAt
  );
}

function samePostReference(
  first: ChatPostReferenceSnapshot,
  second: ChatPostReferenceSnapshot,
) {
  return (
    first.authorId === second.authorId &&
    first.authorNickname === second.authorNickname &&
    first.commentCount === second.commentCount &&
    first.deletedAt === second.deletedAt &&
    first.kind === second.kind &&
    first.marketStatus === second.marketStatus &&
    first.postId === second.postId &&
    first.priceLabel === second.priceLabel &&
    first.thumbnailUri === second.thumbnailUri &&
    first.title === second.title &&
    first.tradeType === second.tradeType
  );
}

export function ChatProvider({ children }: PropsWithChildren) {
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const [state, setState] = useState<StoredChatState>(EMPTY_CHAT_STATE);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadRequest, setLoadRequest] = useState(0);
  const stateRef = useRef<StoredChatState>(EMPTY_CHAT_STATE);
  const readyRef = useRef(false);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const clearedScreenSessionUserIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (currentUserId) clearedScreenSessionUserIdsRef.current.delete(currentUserId);
  }, [currentUserId]);

  const applyState = useCallback((nextState: StoredChatState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const enqueueMutation = useCallback(<T,>(operation: () => Promise<T>) => {
    const result = mutationQueueRef.current.then(operation, operation);
    mutationQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  useEffect(() => {
    if (!sessionReady) return;

    let active = true;
    readyRef.current = false;
    setIsReady(false);
    setHasLoadError(false);

    void enqueueMutation(async () => {
      try {
        const loadedState = await chatRepository.loadState();
        if (!active) return;
        await flushQueuedChatImageRemovals(getRetainedImageIds(loadedState)).catch(
          () => undefined,
        );
        if (!active) return;
        readyRef.current = true;
        applyState(loadedState);
      } catch {
        if (active) setHasLoadError(true);
      } finally {
        if (active) setIsReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, [applyState, currentUserId, enqueueMutation, loadRequest, sessionReady]);

  const reloadChat = useCallback(() => setLoadRequest((current) => current + 1), []);

  const persist = useCallback(
    async (nextState: StoredChatState) => {
      await chatRepository.saveState(nextState);
      applyState(nextState);
    },
    [applyState],
  );

  const mutate = useCallback(
    (
      updater: (current: StoredChatState, userId: string) => StoredChatState | ChatMutationResult,
    ) =>
      enqueueMutation(async (): Promise<ChatMutationResult> => {
        const userId = currentUserId;
        if (
          !userId ||
          !readyRef.current ||
          clearedScreenSessionUserIdsRef.current.has(userId)
        ) {
          return { ok: false, reason: 'not-ready' };
        }
        const next = updater(stateRef.current, userId);
        if ('ok' in next) return next;
        try {
          await persist(next);
          return { ok: true };
        } catch {
          return { ok: false, reason: 'error' };
        }
      }),
    [currentUserId, enqueueMutation, persist],
  );

  const visibleRooms = useMemo(() => {
    if (!currentUserId) return [];
    return state.rooms
      .filter((room) => hasParticipant(room, currentUserId))
      .sort((first, second) => {
        const firstTime =
          getVisibleRoomMessages(state, first.id, currentUserId).at(-1)?.createdAt ??
          first.createdAt;
        const secondTime =
          getVisibleRoomMessages(state, second.id, currentUserId).at(-1)?.createdAt ??
          second.createdAt;
        return secondTime.localeCompare(firstTime);
      });
  }, [currentUserId, state]);

  const getRoomById = useCallback(
    (roomId: string) =>
      currentUserId
        ? stateRef.current.rooms.find(
            (room) => room.id === roomId && hasParticipant(room, currentUserId),
          ) ?? null
        : null,
    [currentUserId],
  );

  const getMessages = useCallback(
    (roomId: string) =>
      currentUserId && getRoomById(roomId)
        ? getVisibleRoomMessages(stateRef.current, roomId, currentUserId)
        : [],
    [currentUserId, getRoomById],
  );

  const getOtherParticipant = useCallback(
    (room: ChatRoom) =>
      currentUserId
        ? room.participants.find((participant) => participant.userId !== currentUserId) ?? null
        : null,
    [currentUserId],
  );

  const getDraft = useCallback(
    (roomId: string) => {
      if (!currentUserId || !getRoomById(roomId)) return EMPTY_DRAFT;
      return getViewerState(state, currentUserId).drafts[roomId] ?? EMPTY_DRAFT;
    },
    [currentUserId, getRoomById, state],
  );

  const getUnreadCount = useCallback(
    (roomId: string) => {
      if (!currentUserId || !getRoomById(roomId)) return 0;
      const messages = getRoomMessages(state, roomId);
      const lastReadMessageId = getViewerState(state, currentUserId).lastReadMessageIds[roomId];
      const lastReadIndex = lastReadMessageId
        ? messages.findIndex((message) => message.id === lastReadMessageId)
        : -1;
      return messages
        .slice(lastReadIndex + 1)
        .filter(
          (message) => message.senderId !== currentUserId && message.status === 'sent',
        ).length;
    },
    [currentUserId, getRoomById, state],
  );

  const totalUnreadCount = useMemo(
    () => visibleRooms.reduce((sum, room) => sum + getUnreadCount(room.id), 0),
    [getUnreadCount, visibleRooms],
  );

  const canSendMessage = useCallback(
    (roomId: string) => {
      const room = getRoomById(roomId);
      return Boolean(room && room.participants.every((participant) => !participant.withdrawnAt));
    },
    [getRoomById],
  );

  const openMarketRoom = useCallback(
    (
      buyer: ChatParticipantSnapshot,
      seller: ChatParticipantSnapshot,
      postReference: ChatPostReferenceSnapshot,
    ) =>
      enqueueMutation(async (): Promise<ChatRoomMutationResult> => {
        const userId = currentUserId;
        if (!userId || !readyRef.current) return { ok: false, reason: 'not-ready' };
        if (postReference.kind !== 'market' || buyer.userId !== userId) {
          return { ok: false, reason: 'invalid' };
        }
        if (seller.userId === userId) return { ok: false, reason: 'self' };
        const dedupeKey = getMarketChatRoomKey(postReference.postId, userId, seller.userId);
        const existing = stateRef.current.rooms.find((room) => room.dedupeKey === dedupeKey);
        if (existing) return { ok: true, roomId: existing.id };
        if (postReference.deletedAt) return { ok: false, reason: 'deleted-post' };
        if (postReference.marketStatus === '완료') {
          return { ok: false, reason: 'completed-post' };
        }
        if (seller.withdrawnAt) return { ok: false, reason: 'read-only' };

        const now = new Date().toISOString();
        const storedReference = { ...postReference, authorId: seller.userId };
        const room: ChatRoom = {
          createdAt: now,
          dedupeKey,
          id: createId('chat-room'),
          kind: 'market',
          participants: [buyer, seller],
          postReference: storedReference,
          updatedAt: now,
        };
        const referenceMessage: ChatMessage = {
          clientMessageId: createId('post-reference'),
          createdAt: now,
          id: createId('chat-message'),
          kind: 'post',
          postReference: storedReference,
          roomId: room.id,
          senderId: buyer.userId,
          status: 'sent',
          updatedAt: now,
        };
        try {
          await persist({
            ...stateRef.current,
            messages: [...stateRef.current.messages, referenceMessage],
            rooms: [...stateRef.current.rooms, room],
          });
          return { ok: true, roomId: room.id };
        } catch {
          return { ok: false, reason: 'error' };
        }
      }),
    [currentUserId, enqueueMutation, persist],
  );

  const bootstrapMockRooms = useCallback(
    (me: ChatParticipantSnapshot, seeds: ChatMockRoomSeed[]) =>
      enqueueMutation(async (): Promise<ChatMutationResult> => {
        const userId = currentUserId;
        if (!userId || !readyRef.current || me.userId !== userId) {
          return { ok: false, reason: 'not-ready' };
        }
        const current = stateRef.current;
        if (current.mockBootstrappedUserIds.includes(userId)) return { ok: true };

        const rooms = [...current.rooms];
        const messages = [...current.messages];
        const previousViewer = getViewerState(current, userId);
        const lastReadMessageIds = { ...previousViewer.lastReadMessageIds };

        for (const seed of seeds) {
          if (seed.otherParticipant.userId === userId || seed.otherParticipant.withdrawnAt) continue;
          const postReference = seed.postReference
            ? {
                ...seed.postReference,
                authorId: seed.postReference.authorId ?? seed.otherParticipant.userId,
              }
            : undefined;
          const dedupeKey = postReference?.kind === 'market'
            ? getMarketChatRoomKey(
                postReference.postId,
                userId,
                seed.otherParticipant.userId,
              )
            : getDirectChatRoomKey(userId, seed.otherParticipant.userId);
          if (rooms.some((room) => room.dedupeKey === dedupeKey)) continue;
          const firstCreatedAt = seed.messages[0]?.createdAt ?? new Date().toISOString();
          const room: ChatRoom = {
            createdAt: firstCreatedAt,
            dedupeKey,
            id: createId('chat-room'),
            kind: postReference?.kind === 'market' ? 'market' : 'direct',
            participants: [me, seed.otherParticipant],
            postReference,
            updatedAt: seed.messages.at(-1)?.createdAt ?? firstCreatedAt,
          };
          const seededMessages = seed.messages
            .filter((message) => Boolean(message.text.trim()))
            .map<ChatMessage>((message) => ({
              clientMessageId: createId('mock-client'),
              createdAt: message.createdAt,
              id: createId('mock-message'),
              kind: 'text',
              roomId: room.id,
              senderId: message.from === 'me' ? userId : seed.otherParticipant.userId,
              status: message.status ?? 'sent',
              text: message.text.trim().slice(0, MAX_MESSAGE_LENGTH),
              updatedAt: message.createdAt,
            }));
          rooms.push(room);
          messages.push(...seededMessages);

          if ((seed.unreadCount ?? 0) === 0) {
            const lastSentMessage = seededMessages
              .filter((message) => message.status === 'sent')
              .at(-1);
            if (lastSentMessage) lastReadMessageIds[room.id] = lastSentMessage.id;
          } else if ((seed.unreadCount ?? 0) > 0) {
            const unreadIncomingIds = seededMessages
              .filter((message) => message.senderId !== userId && message.status === 'sent')
              .slice(-(seed.unreadCount ?? 0))
              .map((message) => message.id);
            const firstUnreadIndex = seededMessages.findIndex(
              (message) => message.id === unreadIncomingIds[0],
            );
            if (firstUnreadIndex > 0) {
              lastReadMessageIds[room.id] = seededMessages[firstUnreadIndex - 1].id;
            }
          }
        }

        try {
          await persist({
            ...current,
            messages,
            mockBootstrappedUserIds: [...current.mockBootstrappedUserIds, userId],
            rooms,
            viewerStates: {
              ...current.viewerStates,
              [userId]: { ...previousViewer, lastReadMessageIds },
            },
          });
          return { ok: true };
        } catch {
          return { ok: false, reason: 'error' };
        }
      }),
    [currentUserId, enqueueMutation, persist],
  );

  const markRoomRead = useCallback(
    (roomId: string) =>
      mutate((current, userId) => {
        const room = current.rooms.find(
          (candidate) => candidate.id === roomId && hasParticipant(candidate, userId),
        );
        if (!room) return { ok: false, reason: 'not-found' };
        const lastMessage = getLastSentMessage(current, roomId);
        if (!lastMessage) return { ok: true };
        const previous = getViewerState(current, userId);
        if (previous.lastReadMessageIds[roomId] === lastMessage.id) return { ok: true };
        return {
          ...current,
          viewerStates: {
            ...current.viewerStates,
            [userId]: {
              ...previous,
              lastReadMessageIds: {
                ...previous.lastReadMessageIds,
                [roomId]: lastMessage.id,
              },
            },
          },
        };
      }),
    [mutate],
  );

  const setSearchQuery = useCallback(
    (query: string) =>
      mutate((current, userId) => {
        const previous = getViewerState(current, userId);
        const searchQuery = query.slice(0, 100);
        if (previous.searchQuery === searchQuery) return { ok: true };
        return {
          ...current,
          viewerStates: {
            ...current.viewerStates,
            [userId]: { ...previous, searchQuery },
          },
        };
      }),
    [mutate],
  );

  const updateDraftText = useCallback(
    (roomId: string, text: string) =>
      mutate((current, userId) => {
        const room = current.rooms.find(
          (candidate) => candidate.id === roomId && hasParticipant(candidate, userId),
        );
        if (!room) return { ok: false, reason: 'not-found' };
        if (room.participants.some((participant) => participant.withdrawnAt)) {
          return { ok: false, reason: 'read-only' };
        }
        const previous = getViewerState(current, userId);
        const currentDraft = previous.drafts[roomId] ?? EMPTY_DRAFT;
        const nextText = text.slice(0, MAX_MESSAGE_LENGTH);
        const nextDrafts = { ...previous.drafts };
        if (!nextText && !currentDraft.images.length) {
          delete nextDrafts[roomId];
        } else {
          nextDrafts[roomId] = {
            ...currentDraft,
            text: nextText,
            updatedAt: new Date().toISOString(),
          };
        }
        return {
          ...current,
          viewerStates: {
            ...current.viewerStates,
            [userId]: { ...previous, drafts: nextDrafts },
          },
        };
      }),
    [mutate],
  );

  const addDraftImages = useCallback(
    (roomId: string, sourceUris: string[]) =>
      enqueueMutation(async (): Promise<ChatMutationResult> => {
        const userId = currentUserId;
        if (!userId || !readyRef.current) return { ok: false, reason: 'not-ready' };
        const current = stateRef.current;
        const room = current.rooms.find(
          (candidate) => candidate.id === roomId && hasParticipant(candidate, userId),
        );
        if (!room) return { ok: false, reason: 'not-found' };
        if (room.participants.some((participant) => participant.withdrawnAt)) {
          return { ok: false, reason: 'read-only' };
        }
        const previous = getViewerState(current, userId);
        const draft = previous.drafts[roomId] ?? EMPTY_DRAFT;
        const uniqueSourceUris = [
          ...new Set(sourceUris.map((uri) => uri.trim()).filter(Boolean)),
        ];
        if (!uniqueSourceUris.length) return { ok: false, reason: 'invalid' };
        if (draft.images.length + uniqueSourceUris.length > MAX_IMAGE_COUNT) {
          return { ok: false, reason: 'limit' };
        }

        let images: ChatImageAsset[] = [];
        try {
          images = await persistChatImages(userId, uniqueSourceUris);
          await persist({
            ...current,
            viewerStates: {
              ...current.viewerStates,
              [userId]: {
                ...previous,
                drafts: {
                  ...previous.drafts,
                  [roomId]: {
                    images: [...draft.images, ...images],
                    text: draft.text,
                    updatedAt: new Date().toISOString(),
                  },
                },
              },
            },
          });
          return { ok: true };
        } catch {
          if (images.length) {
            await removeChatImages(images).catch(async () => {
              await queueChatImageRemovals(images).catch(() => undefined);
            });
          }
          return { ok: false, reason: 'error' };
        }
      }),
    [currentUserId, enqueueMutation, persist],
  );

  const removeDraftImage = useCallback(
    (roomId: string, assetId: string) =>
      enqueueMutation(async (): Promise<ChatMutationResult> => {
        const userId = currentUserId;
        if (!userId || !readyRef.current) return { ok: false, reason: 'not-ready' };
        const current = stateRef.current;
        const previous = getViewerState(current, userId);
        const draft = previous.drafts[roomId];
        const image = draft?.images.find((candidate) => candidate.assetId === assetId);
        if (!draft || !image) return { ok: false, reason: 'not-found' };
        const images = draft.images.filter((candidate) => candidate.assetId !== assetId);
        const drafts = { ...previous.drafts };
        if (!images.length && !draft.text) delete drafts[roomId];
        else drafts[roomId] = { ...draft, images, updatedAt: new Date().toISOString() };
        const nextState = {
          ...current,
          viewerStates: {
            ...current.viewerStates,
            [userId]: { ...previous, drafts },
          },
        };
        try {
          await queueChatImageRemovals([image]);
          await persist(nextState);
          await flushQueuedChatImageRemovals(getRetainedImageIds(nextState)).catch(
            () => undefined,
          );
          return { ok: true };
        } catch {
          return { ok: false, reason: 'error' };
        }
      }),
    [currentUserId, enqueueMutation, persist],
  );

  const sendDraft = useCallback(
    (roomId: string) =>
      enqueueMutation(async (): Promise<ChatMessageMutationResult> => {
        const userId = currentUserId;
        if (!userId || !readyRef.current) return { ok: false, reason: 'not-ready' };
        const room = stateRef.current.rooms.find(
          (candidate) => candidate.id === roomId && hasParticipant(candidate, userId),
        );
        if (!room) return { ok: false, reason: 'not-found' };
        if (room.participants.some((participant) => participant.withdrawnAt)) {
          return { ok: false, reason: 'read-only' };
        }
        const previousViewer = getViewerState(stateRef.current, userId);
        const draft = previousViewer.drafts[roomId] ?? EMPTY_DRAFT;
        const text = draft.text.trim();
        if (!text && !draft.images.length) return { ok: false, reason: 'empty' };

        const now = new Date().toISOString();
        const message: ChatMessage = {
          clientMessageId: createId(`client-${userId}`),
          createdAt: now,
          id: createId('chat-message'),
          images: draft.images.length ? draft.images : undefined,
          kind: draft.images.length ? 'images' : 'text',
          roomId,
          senderId: userId,
          status: 'sending',
          text: text || undefined,
          updatedAt: now,
        };
        const drafts = { ...previousViewer.drafts };
        delete drafts[roomId];
        const sendingState: StoredChatState = {
          ...stateRef.current,
          messages: [...stateRef.current.messages, message],
          rooms: stateRef.current.rooms.map((candidate) =>
            candidate.id === roomId ? { ...candidate, updatedAt: now } : candidate,
          ),
          viewerStates: {
            ...stateRef.current.viewerStates,
            [userId]: { ...previousViewer, drafts },
          },
        };

        let sendingPersisted = false;
        try {
          await persist(sendingState);
          sendingPersisted = true;
          const sentAt = new Date().toISOString();
          await persist({
            ...stateRef.current,
            messages: stateRef.current.messages.map((candidate) =>
              candidate.id === message.id
                ? { ...candidate, status: 'sent', updatedAt: sentAt }
                : candidate,
            ),
          });
          return { messageId: message.id, ok: true };
        } catch {
          if (!sendingPersisted) return { ok: false, reason: 'error' };
          const failedState = {
            ...stateRef.current,
            messages: stateRef.current.messages.map((candidate) =>
              candidate.id === message.id
                ? {
                    ...candidate,
                    status: 'failed' as const,
                    updatedAt: new Date().toISOString(),
                  }
                : candidate,
            ),
          };
          await chatRepository.saveState(failedState).catch(() => undefined);
          applyState(failedState);
          return { ok: false, reason: 'error' };
        }
      }),
    [applyState, currentUserId, enqueueMutation, persist],
  );

  const retryMessage = useCallback(
    (messageId: string) =>
      enqueueMutation(async (): Promise<ChatMessageMutationResult> => {
        const userId = currentUserId;
        if (!userId || !readyRef.current) return { ok: false, reason: 'not-ready' };
        const message = stateRef.current.messages.find((candidate) => candidate.id === messageId);
        if (!message || message.senderId !== userId || message.status !== 'failed') {
          return { ok: false, reason: 'not-found' };
        }
        if (!canSendMessage(message.roomId)) return { ok: false, reason: 'read-only' };

        try {
          await persist({
            ...stateRef.current,
            messages: stateRef.current.messages.map((candidate) =>
              candidate.id === messageId
                ? { ...candidate, status: 'sending', updatedAt: new Date().toISOString() }
                : candidate,
            ),
          });
          const sentAt = new Date().toISOString();
          await persist({
            ...stateRef.current,
            messages: stateRef.current.messages.map((candidate) =>
              candidate.id === messageId
                ? {
                    ...candidate,
                    createdAt: sentAt,
                    status: 'sent',
                    updatedAt: sentAt,
                  }
                : candidate,
            ),
            rooms: stateRef.current.rooms.map((room) =>
              room.id === message.roomId ? { ...room, updatedAt: sentAt } : room,
            ),
          });
          return { messageId, ok: true };
        } catch {
          const failedState = {
            ...stateRef.current,
            messages: stateRef.current.messages.map((candidate) =>
              candidate.id === messageId
                ? { ...candidate, status: 'failed' as const, updatedAt: new Date().toISOString() }
                : candidate,
            ),
          };
          await chatRepository.saveState(failedState).catch(() => undefined);
          applyState(failedState);
          return { ok: false, reason: 'error' };
        }
      }),
    [applyState, canSendMessage, currentUserId, enqueueMutation, persist],
  );

  const syncParticipant = useCallback(
    (participant: ChatParticipantSnapshot) =>
      mutate((current) => {
        let changed = false;
        const rooms = current.rooms.map((room) => ({
          ...room,
          participants: room.participants.map((candidate) => {
            if (candidate.userId !== participant.userId || candidate.withdrawnAt) return candidate;
            const nextParticipant = { ...participant, location: candidate.location };
            if (sameParticipant(candidate, nextParticipant)) return candidate;
            changed = true;
            return nextParticipant;
          }),
        }));
        return changed ? { ...current, rooms } : { ok: true };
      }),
    [mutate],
  );

  const syncPostReference = useCallback(
    (reference: ChatPostReferenceSnapshot) =>
      mutate((current) => {
        let changed = false;
        const mergeReference = (
          previous: ChatPostReferenceSnapshot,
          room: ChatRoom | undefined,
        ) => {
          const authorId = reference.authorId ?? previous.authorId;
          const authorWithdrawn = room?.participants.some(
            (participant) =>
              participant.userId === authorId && Boolean(participant.withdrawnAt),
          );
          return {
            ...reference,
            ...(authorId ? { authorId } : {}),
            ...(previous.deletedAt ? { deletedAt: previous.deletedAt } : {}),
            ...(authorWithdrawn ? { authorNickname: '탈퇴한 사용자' } : {}),
          };
        };
        const rooms = current.rooms.map((room) => {
          if (room.postReference?.postId !== reference.postId) return room;
          const nextReference = mergeReference(room.postReference, room);
          if (samePostReference(room.postReference, nextReference)) return room;
          changed = true;
          return { ...room, postReference: nextReference };
        });
        const messages = current.messages.map((message) => {
          if (message.postReference?.postId !== reference.postId) return message;
          const nextReference = mergeReference(
            message.postReference,
            current.rooms.find((room) => room.id === message.roomId),
          );
          if (samePostReference(message.postReference, nextReference)) return message;
          changed = true;
          return { ...message, postReference: nextReference };
        });
        return changed ? { ...current, messages, rooms } : { ok: true };
      }),
    [mutate],
  );

  const markPostDeleted = useCallback(
    (postId: string) =>
      mutate((current) => {
        const deletedAt = new Date().toISOString();
        let changed = false;
        const markDeleted = (reference: ChatPostReferenceSnapshot) => {
          if (reference.deletedAt) return reference;
          changed = true;
          return { ...reference, deletedAt };
        };
        const rooms = current.rooms.map((room) =>
          room.postReference?.postId === postId
            ? { ...room, postReference: markDeleted(room.postReference) }
            : room,
        );
        const messages = current.messages.map((message) =>
          message.postReference?.postId === postId
            ? { ...message, postReference: markDeleted(message.postReference) }
            : message,
        );
        return changed ? { ...current, messages, rooms } : { ok: true };
      }),
    [mutate],
  );

  const clearScreenSession = useCallback(
    () =>
      enqueueMutation(async () => {
        const userId = currentUserId;
        if (!userId) return;
        let current: StoredChatState;
        try {
          current = readyRef.current ? stateRef.current : await chatRepository.loadState();
        } catch {
          clearedScreenSessionUserIdsRef.current.add(userId);
          return;
        }
        const previous = getViewerState(current, userId);
        const draftImages = Object.values(previous.drafts).flatMap((draft) => draft.images);
        const nextState = {
          ...current,
          viewerStates: {
            ...current.viewerStates,
            [userId]: { ...previous, drafts: {}, searchQuery: '' },
          },
        };
        await queueChatImageRemovals(draftImages);
        await chatRepository.saveState(nextState);
        applyState(nextState);
        await flushQueuedChatImageRemovals(getRetainedImageIds(nextState));
        clearedScreenSessionUserIdsRef.current.add(userId);
      }),
    [applyState, currentUserId, enqueueMutation],
  );

  const deleteUserChatData = useCallback(
    (userId = currentUserId ?? undefined) =>
      enqueueMutation(async () => {
        if (!userId) return;
        const current = readyRef.current ? stateRef.current : await chatRepository.loadState();
        const affectedRoomIds = new Set(
          current.rooms
            .filter((room) => hasParticipant(room, userId))
            .map((room) => room.id),
        );
        const authoredRoomIds = new Set(
          current.rooms
            .filter(
              (room) =>
                room.postReference?.authorId === userId ||
                (room.kind === 'market' && room.participants[1]?.userId === userId),
            )
            .map((room) => room.id),
        );
        const draftImages = Object.values(current.viewerStates).flatMap((viewerState) =>
          Object.entries(viewerState.drafts).flatMap(([roomId, draft]) =>
            affectedRoomIds.has(roomId) ? draft.images : [],
          ),
        );
        const pendingMessages = current.messages.filter(
          (message) => affectedRoomIds.has(message.roomId) && message.status !== 'sent',
        );
        const removedImages = [
          ...draftImages,
          ...pendingMessages.flatMap((message) => message.images ?? []),
        ];
        const withdrawnAt = new Date().toISOString();
        const messages = current.messages
          .filter(
            (message) => !affectedRoomIds.has(message.roomId) || message.status === 'sent',
          )
          .map((message) =>
            message.postReference &&
            (message.postReference.authorId === userId ||
              authoredRoomIds.has(message.roomId))
              ? {
                  ...message,
                  postReference: {
                    ...message.postReference,
                    authorId: userId,
                    authorNickname: '탈퇴한 사용자',
                    deletedAt: message.postReference.deletedAt ?? withdrawnAt,
                  },
                }
              : message,
          );
        const viewerStates = Object.fromEntries(
          Object.entries(current.viewerStates).flatMap(([viewerId, viewerState]) => {
            if (viewerId === userId) return [];
            const drafts = Object.fromEntries(
              Object.entries(viewerState.drafts).filter(
                ([roomId]) => !affectedRoomIds.has(roomId),
              ),
            );
            const lastReadMessageIds = Object.fromEntries(
              Object.entries(viewerState.lastReadMessageIds).flatMap(
                ([roomId, messageId]) => {
                  if (
                    messages.some(
                      (message) => message.id === messageId && message.roomId === roomId,
                    )
                  ) {
                    return [[roomId, messageId]];
                  }
                  const lastMessage = messages
                    .filter(
                      (message) =>
                        message.roomId === roomId && message.status === 'sent',
                    )
                    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
                    .at(-1);
                  return lastMessage ? [[roomId, lastMessage.id]] : [];
                },
              ),
            );
            return [[viewerId, { ...viewerState, drafts, lastReadMessageIds }]];
          }),
        );
        const nextState: StoredChatState = {
          ...current,
          messages,
          mockBootstrappedUserIds: current.mockBootstrappedUserIds.filter(
            (candidate) => candidate !== userId,
          ),
          rooms: current.rooms.map((room) => ({
            ...room,
            participants: room.participants.map((participant) =>
              participant.userId === userId
                ? {
                    nickname: '탈퇴한 사용자',
                    profileImageUri: null,
                    userId,
                    withdrawnAt,
                  }
                : participant,
            ),
            ...(room.postReference && authoredRoomIds.has(room.id)
              ? {
                  postReference: {
                    ...room.postReference,
                    authorId: userId,
                    authorNickname: '탈퇴한 사용자',
                    deletedAt: room.postReference.deletedAt ?? withdrawnAt,
                  },
                }
              : {}),
          })),
          viewerStates,
        };
        await queueChatImageRemovals(removedImages);
        await chatRepository.saveState(nextState);
        applyState(nextState);
        await flushQueuedChatImageRemovals(getRetainedImageIds(nextState));
      }),
    [applyState, currentUserId, enqueueMutation],
  );

  const visibleViewer = currentUserId ? getViewerState(state, currentUserId) : createViewerState();
  const storeReady = sessionReady && isReady;

  const value = useMemo<ChatStoreContextValue>(
    () => ({
      addDraftImages,
      bootstrapMockRooms,
      canSendMessage,
      clearScreenSession,
      deleteUserChatData,
      getDraft,
      getMessages,
      getOtherParticipant,
      getRoomById,
      getUnreadCount,
      hasLoadError,
      isReady: storeReady,
      markPostDeleted,
      markRoomRead,
      openMarketRoom,
      reloadChat,
      removeDraftImage,
      retryMessage,
      rooms: visibleRooms,
      searchQuery: visibleViewer.searchQuery,
      sendDraft,
      setSearchQuery,
      syncParticipant,
      syncPostReference,
      totalUnreadCount,
      updateDraftText,
    }),
    [
      addDraftImages,
      bootstrapMockRooms,
      canSendMessage,
      clearScreenSession,
      deleteUserChatData,
      getDraft,
      getMessages,
      getOtherParticipant,
      getRoomById,
      getUnreadCount,
      hasLoadError,
      markPostDeleted,
      markRoomRead,
      openMarketRoom,
      reloadChat,
      removeDraftImage,
      retryMessage,
      sendDraft,
      setSearchQuery,
      storeReady,
      syncParticipant,
      syncPostReference,
      totalUnreadCount,
      updateDraftText,
      visibleRooms,
      visibleViewer.searchQuery,
    ],
  );

  return <ChatStoreContext.Provider value={value}>{children}</ChatStoreContext.Provider>;
}

export function useChatStore() {
  const context = useContext(ChatStoreContext);
  if (!context) throw new Error('useChatStore must be used inside ChatProvider.');
  return context;
}
