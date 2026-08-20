export type ChatRoomKind = 'direct' | 'market';

export type ChatMessageKind = 'images' | 'post' | 'text';

export type ChatMessageStatus = 'failed' | 'sending' | 'sent';

export type ChatParticipantSnapshot = {
  introduction?: string;
  location?: string;
  nickname: string;
  petName?: string;
  profileImageUri?: string | null;
  userId: string;
  withdrawnAt?: string;
};

export type ChatImageAsset = {
  assetId: string;
  localUri?: string;
  ownerId: string;
  url?: string;
};

export type ChatPostReferenceSnapshot = {
  authorId?: string;
  authorNickname: string;
  commentCount?: number;
  deletedAt?: string;
  kind: 'market' | 'talk';
  marketStatus?: '예약 중' | '완료' | '진행 중';
  postId: string;
  priceLabel?: string;
  thumbnailUri?: string;
  title: string;
  tradeType?: string;
};

export type ChatRoom = {
  createdAt: string;
  dedupeKey: string;
  id: string;
  kind: ChatRoomKind;
  lastMessagePreview?: string;
  participants: ChatParticipantSnapshot[];
  postReference?: ChatPostReferenceSnapshot;
  unreadCount?: number;
  updatedAt: string;
};

export type ChatMessage = {
  clientMessageId: string;
  createdAt: string;
  id: string;
  images?: ChatImageAsset[];
  kind: ChatMessageKind;
  postReference?: ChatPostReferenceSnapshot;
  roomId: string;
  senderId: string;
  status: ChatMessageStatus;
  text?: string;
  updatedAt: string;
};

export type ChatDraft = {
  images: ChatImageAsset[];
  text: string;
  updatedAt: string;
};

export type ChatViewerState = {
  drafts: Record<string, ChatDraft>;
  lastReadMessageIds: Record<string, string>;
  searchQuery: string;
};

export type StoredChatState = {
  messages: ChatMessage[];
  rooms: ChatRoom[];
  viewerStates: Record<string, ChatViewerState>;
};

export type ChatMutationFailureReason =
  | 'completed-post'
  | 'deleted-post'
  | 'empty'
  | 'error'
  | 'invalid'
  | 'limit'
  | 'not-found'
  | 'not-ready'
  | 'read-only'
  | 'self';

export type ChatMutationResult =
  | { ok: true }
  | { ok: false; reason: ChatMutationFailureReason };

export type ChatRoomMutationResult =
  | { ok: true; roomId: string }
  | { ok: false; reason: ChatMutationFailureReason };

export type ChatMessageMutationResult =
  | { messageId: string; ok: true }
  | { messageId?: string; ok: false; reason: ChatMutationFailureReason };
