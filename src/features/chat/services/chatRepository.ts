import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ChatDraft,
  ChatImageAsset,
  ChatMessage,
  ChatParticipantSnapshot,
  ChatPostReferenceSnapshot,
  ChatRoom,
  ChatViewerState,
  StoredChatState,
} from '../types';

const CHAT_STORAGE_KEY = 'paw:chat-store';

export const EMPTY_CHAT_STATE: StoredChatState = {
  messages: [],
  rooms: [],
  viewerStates: {},
};

let operationQueue = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>) {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function getDateString(value: unknown) {
  const date = getString(value);
  return date && Number.isFinite(Date.parse(date)) ? date : null;
}

export function getDirectChatRoomKey(firstUserId: string, secondUserId: string) {
  return `direct:${[firstUserId, secondUserId]
    .sort()
    .map(encodeURIComponent)
    .join(':')}`;
}

export function getMarketChatRoomKey(postId: string, buyerId: string, sellerId: string) {
  return `market:${[postId, buyerId, sellerId]
    .map(encodeURIComponent)
    .join(':')}`;
}

function normalizeParticipant(value: unknown): ChatParticipantSnapshot | null {
  if (!isRecord(value)) return null;
  const userId = getString(value.userId);
  const nickname = getString(value.nickname);
  if (!userId || !nickname) return null;
  const withdrawnAt = getDateString(value.withdrawnAt);

  return {
    userId,
    nickname,
    ...(typeof value.introduction === 'string'
      ? { introduction: value.introduction }
      : {}),
    ...(typeof value.location === 'string' ? { location: value.location } : {}),
    ...(typeof value.petName === 'string' ? { petName: value.petName } : {}),
    ...(value.profileImageUri === null || typeof value.profileImageUri === 'string'
      ? { profileImageUri: value.profileImageUri }
      : {}),
    ...(withdrawnAt ? { withdrawnAt } : {}),
  };
}

function normalizeImage(value: unknown): ChatImageAsset | null {
  if (!isRecord(value)) return null;
  const assetId = getString(value.assetId);
  const ownerId = getString(value.ownerId);
  const localUri = getOptionalString(value.localUri);
  const url = getOptionalString(value.url);
  if (!assetId || !ownerId || (!localUri && !url)) return null;

  return {
    assetId,
    ownerId,
    ...(localUri ? { localUri } : {}),
    ...(url ? { url } : {}),
  };
}

function normalizePostReference(value: unknown): ChatPostReferenceSnapshot | null {
  if (!isRecord(value)) return null;
  const postId = getString(value.postId);
  const title = getString(value.title);
  const authorNickname = getString(value.authorNickname);
  const authorId = getString(value.authorId);
  if (
    !postId ||
    !title ||
    !authorNickname ||
    (value.kind !== 'market' && value.kind !== 'talk')
  ) {
    return null;
  }

  const marketStatus =
    value.marketStatus === '진행 중' ||
    value.marketStatus === '예약 중' ||
    value.marketStatus === '완료'
      ? value.marketStatus
      : undefined;
  const deletedAt = getDateString(value.deletedAt);
  return {
    authorNickname,
    kind: value.kind,
    postId,
    title,
    ...(authorId ? { authorId } : {}),
    ...(Number.isInteger(value.commentCount) && Number(value.commentCount) >= 0
      ? { commentCount: Number(value.commentCount) }
      : {}),
    ...(deletedAt ? { deletedAt } : {}),
    ...(marketStatus ? { marketStatus } : {}),
    ...(typeof value.priceLabel === 'string' ? { priceLabel: value.priceLabel } : {}),
    ...(typeof value.thumbnailUri === 'string'
      ? { thumbnailUri: value.thumbnailUri }
      : {}),
    ...(typeof value.tradeType === 'string' ? { tradeType: value.tradeType } : {}),
  };
}

function normalizeRoom(value: unknown): ChatRoom | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const dedupeKey = getString(value.dedupeKey);
  const createdAt = getDateString(value.createdAt);
  const updatedAt = getDateString(value.updatedAt);
  const participants = Array.isArray(value.participants)
    ? value.participants
        .map(normalizeParticipant)
        .filter((participant): participant is ChatParticipantSnapshot => Boolean(participant))
    : [];
  if (
    !id ||
    !dedupeKey ||
    !createdAt ||
    !updatedAt ||
    (value.kind !== 'direct' && value.kind !== 'market') ||
    participants.length !== 2 ||
    participants[0].userId === participants[1].userId
  ) {
    return null;
  }

  const postReference = normalizePostReference(value.postReference);
  if (value.kind === 'market' && (!postReference || postReference.kind !== 'market')) {
    return null;
  }
  if (
    postReference?.authorId &&
    !participants.some((participant) => participant.userId === postReference.authorId)
  ) {
    return null;
  }
  const dedupeKeys =
    value.kind === 'direct'
      ? [
          {
            current: getDirectChatRoomKey(
              participants[0].userId,
              participants[1].userId,
            ),
            legacy: `direct:${[participants[0].userId, participants[1].userId]
              .sort()
              .join(':')}`,
          },
        ]
      : [
          [participants[0].userId, participants[1].userId],
          [participants[1].userId, participants[0].userId],
        ].map(([buyerId, sellerId]) => ({
          current: getMarketChatRoomKey(postReference!.postId, buyerId, sellerId),
          legacy: `market:${postReference!.postId}:${buyerId}:${sellerId}`,
        }));
  const normalizedDedupeKey = dedupeKeys.find(
    (candidate) => candidate.current === dedupeKey || candidate.legacy === dedupeKey,
  )?.current;
  if (!normalizedDedupeKey) return null;

  return {
    createdAt,
    dedupeKey: normalizedDedupeKey,
    id,
    kind: value.kind,
    ...(typeof value.lastMessagePreview === 'string'
      ? { lastMessagePreview: value.lastMessagePreview }
      : {}),
    participants,
    updatedAt,
    ...(Number.isSafeInteger(value.unreadCount) && Number(value.unreadCount) >= 0
      ? { unreadCount: Number(value.unreadCount) }
      : {}),
    ...(postReference ? { postReference } : {}),
  };
}

function normalizeMessage(value: unknown, room: ChatRoom): ChatMessage | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const clientMessageId = getString(value.clientMessageId);
  const roomId = getString(value.roomId);
  const senderId = getString(value.senderId);
  const createdAt = getDateString(value.createdAt);
  const updatedAt = getDateString(value.updatedAt);
  if (
    !id ||
    !clientMessageId ||
    roomId !== room.id ||
    !senderId ||
    !room.participants.some((participant) => participant.userId === senderId) ||
    !createdAt ||
    !updatedAt ||
    (value.kind !== 'images' && value.kind !== 'post' && value.kind !== 'text') ||
    (value.status !== 'failed' && value.status !== 'sending' && value.status !== 'sent')
  ) {
    return null;
  }

  const text = typeof value.text === 'string' ? value.text : undefined;
  const images = Array.isArray(value.images)
    ? value.images
        .map(normalizeImage)
        .filter(
          (image): image is ChatImageAsset =>
            Boolean(image && image.ownerId === senderId),
        )
        .slice(0, 5)
    : [];
  const postReference = normalizePostReference(value.postReference);
  if (
    (value.kind === 'text' && (!text?.trim() || text.length > 1000)) ||
    (value.kind === 'images' && !images.length) ||
    (value.kind === 'post' && !postReference)
  ) {
    return null;
  }

  return {
    clientMessageId,
    createdAt,
    id,
    kind: value.kind,
    roomId,
    senderId,
    status: value.status === 'sending' ? 'failed' : value.status,
    updatedAt,
    ...(images.length ? { images } : {}),
    ...(postReference ? { postReference } : {}),
    ...(text ? { text } : {}),
  };
}

function normalizeDraft(value: unknown, userId: string): ChatDraft | null {
  if (!isRecord(value)) return null;
  const text = typeof value.text === 'string' ? value.text.slice(0, 1000) : '';
  const images = Array.isArray(value.images)
    ? value.images
        .map(normalizeImage)
        .filter(
          (image): image is ChatImageAsset => Boolean(image && image.ownerId === userId),
        )
        .slice(0, 5)
    : [];
  const updatedAt = getDateString(value.updatedAt);
  if (!updatedAt || (!text && !images.length)) return null;
  return { images, text, updatedAt };
}

function normalizeViewerState(
  value: unknown,
  userId: string,
  rooms: ChatRoom[],
  messages: ChatMessage[],
): ChatViewerState {
  if (!isRecord(value)) return { drafts: {}, lastReadMessageIds: {}, searchQuery: '' };
  const roomIds = new Set(
    rooms
      .filter((room) => room.participants.some((participant) => participant.userId === userId))
      .map((room) => room.id),
  );
  const messageRoomIds = new Map(messages.map((message) => [message.id, message.roomId]));
  const drafts = isRecord(value.drafts)
    ? Object.fromEntries(
        Object.entries(value.drafts).flatMap(([roomId, draft]) => {
          const normalized = roomIds.has(roomId) ? normalizeDraft(draft, userId) : null;
          return normalized ? [[roomId, normalized]] : [];
        }),
      )
    : {};
  const lastReadMessageIds = isRecord(value.lastReadMessageIds)
    ? Object.fromEntries(
        Object.entries(value.lastReadMessageIds).flatMap(([roomId, messageId]) =>
          roomIds.has(roomId) &&
          typeof messageId === 'string' &&
          messageRoomIds.get(messageId) === roomId
            ? [[roomId, messageId] as const]
            : [],
        ),
      )
    : {};

  return {
    drafts,
    lastReadMessageIds,
    searchQuery:
      typeof value.searchQuery === 'string' ? value.searchQuery.slice(0, 100) : '',
  };
}

export function normalizeStoredChatState(value: unknown): StoredChatState {
  if (!isRecord(value)) return EMPTY_CHAT_STATE;

  const seenRoomIds = new Set<string>();
  const seenDedupeKeys = new Set<string>();
  const rooms = Array.isArray(value.rooms)
    ? value.rooms.reduce<ChatRoom[]>((result, candidate) => {
        const room = normalizeRoom(candidate);
        if (
          !room ||
          seenRoomIds.has(room.id) ||
          seenDedupeKeys.has(room.dedupeKey)
        ) {
          return result;
        }
        seenRoomIds.add(room.id);
        seenDedupeKeys.add(room.dedupeKey);
        result.push(room);
        return result;
      }, [])
    : [];
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const seenMessageIds = new Set<string>();
  const seenClientMessageIds = new Set<string>();
  const messages = Array.isArray(value.messages)
    ? value.messages.reduce<ChatMessage[]>((result, candidate) => {
        const roomId = isRecord(candidate) ? getString(candidate.roomId) : null;
        const room = roomId ? roomById.get(roomId) : null;
        const message = room ? normalizeMessage(candidate, room) : null;
        if (
          !message ||
          seenMessageIds.has(message.id) ||
          seenClientMessageIds.has(message.clientMessageId)
        ) {
          return result;
        }
        seenMessageIds.add(message.id);
        seenClientMessageIds.add(message.clientMessageId);
        result.push(message);
        return result;
      }, [])
    : [];
  const viewerStates = isRecord(value.viewerStates)
    ? Object.fromEntries(
        Object.entries(value.viewerStates)
          .filter(([userId]) => Boolean(userId.trim()))
          .map(([rawUserId, viewerState]) => [
            rawUserId.trim(),
            normalizeViewerState(viewerState, rawUserId.trim(), rooms, messages),
          ]),
      )
    : {};
  return { messages, rooms, viewerStates };
}

export const chatRepository = {
  loadState() {
    return enqueue(async () => {
      const stored = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
      if (!stored) return EMPTY_CHAT_STATE;

      const parsed: unknown = JSON.parse(stored);
      if (
        !isRecord(parsed) ||
        !Array.isArray(parsed.messages) ||
        !Array.isArray(parsed.rooms) ||
        !isRecord(parsed.viewerStates)
      ) {
        throw new Error('invalid-chat-state');
      }

      const state = normalizeStoredChatState(parsed);
      const serialized = JSON.stringify(state);
      if (serialized !== stored) {
        await AsyncStorage.setItem(CHAT_STORAGE_KEY, serialized);
      }
      return state;
    });
  },

  saveState(state: StoredChatState) {
    return enqueue(() =>
      AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(state)),
    );
  },
};
