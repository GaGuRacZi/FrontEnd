import { apiRequest } from '@/src/services/apiClient';
import { appendMultipartImage, appendMultipartJson } from '@/src/utils/file';

export type RemoteChatOpponent = {
  nickname: string;
  profileUrl: string | null;
  userId: string;
};

export type RemoteChatPost = {
  deleted: boolean;
  marketStatus: 'COMPLETED' | 'IN_PROGRESS' | 'RESERVED' | null;
  postId: string;
  price: number | null;
  priceNegotiable: boolean | null;
  thumbnailUrl: string | null;
  title: string | null;
};

export type RemoteChatRoom = {
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  opponent: RemoteChatOpponent;
  post: RemoteChatPost;
  roomId: string;
  unreadCount: number;
};

export type RemoteChatMessage = {
  content: string | null;
  imageUrl: string | null;
  messageId: string;
  mine: boolean;
  senderId: string;
  sentAt: string;
  type: 'IMAGE' | 'TEXT';
};

export class ChatApiContractError extends Error {
  constructor() {
    super('Invalid chat API response.');
    this.name = 'ChatApiContractError';
  }
}

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ChatApiContractError();
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new ChatApiContractError();
  return value.trim();
}

function readOptionalString(value: unknown) {
  if (value === null || value === undefined) return null;
  return readString(value);
}

function readId(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value) && Number(value) > 0) return value;
  throw new ChatApiContractError();
}

function readDate(value: unknown) {
  const date = readString(value);
  if (!Number.isFinite(Date.parse(date))) throw new ChatApiContractError();
  return date;
}

function readCount(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ChatApiContractError();
  }
  return value;
}

function readEnvelope(value: unknown, expectedCode: string) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true || envelope.code !== expectedCode) {
    throw new ChatApiContractError();
  }
  return envelope.result;
}

function readOpponent(value: unknown): RemoteChatOpponent {
  const opponent = readRecord(value);
  const profileUrl = readOptionalString(opponent.profileUrl);
  return {
    nickname: readString(opponent.nickname),
    profileUrl,
    userId: readString(opponent.uid),
  };
}

function readMarketStatus(value: unknown): RemoteChatPost['marketStatus'] {
  if (value === null || value === undefined) return null;
  if (value === 'COMPLETED' || value === 'IN_PROGRESS' || value === 'RESERVED') return value;
  throw new ChatApiContractError();
}

function readPost(value: unknown): RemoteChatPost {
  const post = readRecord(value);
  const price = post.price;
  if (price !== null && price !== undefined && (typeof price !== 'number' || !Number.isSafeInteger(price) || price < 0)) {
    throw new ChatApiContractError();
  }
  if (post.priceNegotiable !== null && post.priceNegotiable !== undefined && typeof post.priceNegotiable !== 'boolean') {
    throw new ChatApiContractError();
  }
  if (typeof post.deleted !== 'boolean') throw new ChatApiContractError();
  return {
    deleted: post.deleted,
    marketStatus: readMarketStatus(post.marketStatus),
    postId: readId(post.postId),
    price: typeof price === 'number' ? price : null,
    priceNegotiable: typeof post.priceNegotiable === 'boolean' ? post.priceNegotiable : null,
    thumbnailUrl: readOptionalString(post.thumbnailUrl),
    title: readOptionalString(post.title),
  };
}

function readRoom(value: unknown): RemoteChatRoom {
  const room = readRecord(value);
  const lastMessageAt = readOptionalString(room.lastMessageAt);
  if (lastMessageAt && !Number.isFinite(Date.parse(lastMessageAt))) {
    throw new ChatApiContractError();
  }
  return {
    lastMessageAt,
    lastMessagePreview: readOptionalString(room.lastMessagePreview),
    opponent: readOpponent(room.opponent),
    post: readPost(room.post),
    roomId: readId(room.roomId),
    unreadCount: room.unreadCount === undefined ? 0 : readCount(room.unreadCount),
  };
}

function readMessage(value: unknown): RemoteChatMessage {
  const message = readRecord(value);
  if (message.type !== 'TEXT' && message.type !== 'IMAGE') throw new ChatApiContractError();
  const content = readOptionalString(message.content);
  const imageUrl = readOptionalString(message.imageUrl);
  if ((message.type === 'TEXT' && !content) || (message.type === 'IMAGE' && !imageUrl)) {
    throw new ChatApiContractError();
  }
  if (typeof message.mine !== 'boolean') throw new ChatApiContractError();
  return {
    content,
    imageUrl,
    messageId: readId(message.messageId),
    mine: message.mine,
    senderId: readString(message.senderId),
    sentAt: readDate(message.sentAt),
    type: message.type,
  };
}

function getRoomPath(roomId: string) {
  return `/chat/rooms/${encodeURIComponent(readId(roomId))}`;
}

export async function getRemoteChatRooms() {
  const result = readRecord(
    readEnvelope(await apiRequest<unknown>('/chat/rooms?size=100'), 'CHAT_ROOM_LIST_200'),
  );
  if (!Array.isArray(result.content)) throw new ChatApiContractError();
  return result.content.map(readRoom);
}

export async function getRemoteChatRoom(roomId: string) {
  return readRoom(
    readEnvelope(await apiRequest<unknown>(getRoomPath(roomId)), 'CHAT_ROOM_DETAIL_200'),
  );
}

export async function getRemoteChatMessages(roomId: string) {
  const result = readRecord(
    readEnvelope(
      await apiRequest<unknown>(`${getRoomPath(roomId)}/messages?size=100`),
      'CHAT_MESSAGE_LIST_200',
    ),
  );
  if (!Array.isArray(result.content)) throw new ChatApiContractError();
  return result.content.map(readMessage);
}

export async function createRemoteChatRoom(postId: string) {
  const result = readRecord(
    readEnvelope(
      await apiRequest<unknown>('/chat/rooms', { json: { postId: readId(postId) }, method: 'POST' }),
      'CHAT_ROOM_CREATE_200',
    ),
  );
  return readId(result.roomId);
}

export async function sendRemoteChatMessage(
  roomId: string,
  message: { imageUri?: string; text?: string },
) {
  const text = message.text?.trim();
  const imageUri = message.imageUri?.trim();
  if (Boolean(text) === Boolean(imageUri)) throw new ChatApiContractError();

  const formData = new FormData();
  appendMultipartJson(formData, imageUri ? { type: 'IMAGE' } : { content: text, type: 'TEXT' });
  if (imageUri) appendMultipartImage(formData, 'image', imageUri);
  return readMessage(
    readEnvelope(
      await apiRequest<unknown>(`${getRoomPath(roomId)}/messages`, {
        body: formData,
        method: 'POST',
      }),
      'CHAT_MESSAGE_SEND_200',
    ),
  );
}

export async function markRemoteChatRoomRead(roomId: string, lastReadMessageId: string) {
  readEnvelope(
    await apiRequest<unknown>(`${getRoomPath(roomId)}/read`, {
      json: { lastReadMessageId: readId(lastReadMessageId) },
      method: 'PATCH',
    }),
    'CHAT_ROOM_READ_200',
  );
}
