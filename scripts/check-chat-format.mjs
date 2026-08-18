import assert from 'node:assert/strict';

import {
  formatChatDate,
  formatChatTime,
  normalizeChatSearch,
} from '../src/features/chat/chatFormat.ts';
import {
  getDirectChatRoomKey,
  getMarketChatRoomKey,
  normalizeStoredChatState,
} from '../src/features/chat/services/chatRepository.ts';
import { getMultipartImageFile } from '../src/utils/file.ts';

process.env.TZ = 'Asia/Seoul';

assert.equal(normalizeChatSearch('  아리   병원  '), '아리 병원');
assert.equal(formatChatTime('2026-08-03T04:05:00+09:00'), '오전 4:05');
assert.equal(formatChatDate('2026-08-03T04:05:00+09:00'), '2026년 8월 3일');
assert.notEqual(
  getDirectChatRoomKey('a:b', 'c'),
  getDirectChatRoomKey('a', 'b:c'),
);
assert.notEqual(
  getMarketChatRoomKey('post:a', 'b', 'c'),
  getMarketChatRoomKey('post', 'a:b', 'c'),
);
assert.deepEqual(
  getMultipartImageFile('file:///cache/IMG_0001.HEIC'),
  {
    name: 'IMG_0001.heic',
    type: 'image/heic',
    uri: 'file:///cache/IMG_0001.HEIC',
  },
);
assert.deepEqual(
  getMultipartImageFile('file:///cache/picker-result.jpeg'),
  {
    name: 'picker-result.jpg',
    type: 'image/jpeg',
    uri: 'file:///cache/picker-result.jpeg',
  },
);
assert.deepEqual(
  getMultipartImageFile('file:///cache/IMG_0002.HEIF'),
  {
    name: 'IMG_0002.heif',
    type: 'image/heif',
    uri: 'file:///cache/IMG_0002.HEIF',
  },
);
assert.throws(
  () => getMultipartImageFile('file:///cache/image.raw'),
  /unsupported-image-format/,
);
assert.throws(
  () => getMultipartImageFile('content://media/external/images/42'),
  /unsupported-image-format/,
);

const participants = [
  { nickname: '아영', userId: 'user-a' },
  { nickname: '몽이맘', userId: 'user-b' },
];
const room = {
  createdAt: '2026-08-03T04:05:00+09:00',
  dedupeKey: getDirectChatRoomKey('user-a', 'user-b'),
  id: 'room-1',
  kind: 'direct',
  participants,
  updatedAt: '2026-08-03T04:05:00+09:00',
};
const storedState = normalizeStoredChatState({
  messages: [
    {
      clientMessageId: 'client-1',
      createdAt: room.createdAt,
      id: 'message-1',
      kind: 'text',
      roomId: room.id,
      senderId: 'user-a',
      status: 'sending',
      text: '전송 중이던 메시지',
      updatedAt: room.updatedAt,
    },
  ],
  mockBootstrappedUserIds: [],
  rooms: [room, { ...room, id: 'room-2' }],
  viewerStates: {
    'user-a': {
      drafts: {
        [room.id]: {
          images: [{ assetId: 'other-image', localUri: 'file:///other.jpg', ownerId: 'user-b' }],
          text: '작성 중',
          updatedAt: room.updatedAt,
        },
      },
      lastReadMessageIds: { [room.id]: 'message-1' },
      searchQuery: '몽이',
    },
    'user-b': { drafts: {}, lastReadMessageIds: {}, searchQuery: '아영' },
  },
});
assert.equal(storedState.rooms.length, 1);
assert.equal(storedState.messages[0]?.status, 'failed');
assert.equal(storedState.viewerStates['user-a']?.drafts[room.id]?.images.length, 0);
assert.equal(storedState.viewerStates['user-a']?.searchQuery, '몽이');
assert.equal(storedState.viewerStates['user-b']?.searchQuery, '아영');
