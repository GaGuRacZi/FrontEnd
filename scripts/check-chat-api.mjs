import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadModule(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(module, module.exports, (id) => {
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected import: ${id}`);
  });
  return module.exports;
}

const requests = [];
const communityAdapter = loadModule('../src/features/chat/communityAdapter.ts', {
  '@/src/features/community/services/communityImageStorage': {
    getCommunityImageUris: () => [],
  },
});
const chatApi = loadModule('../src/features/chat/services/chatApi.ts', {
  '@/src/services/apiClient': {
    apiRequest: async (path, options) => {
      requests.push([path, options]);
      const envelope = (code, result) => ({ code, isSuccess: true, message: 'ok', result });
      const room = {
        opponent: { nickname: '초코', profileUrl: null, uid: 'other-user' },
        post: {
          deleted: false,
          marketStatus: 'IN_PROGRESS',
          postId: 33,
          price: 0,
          priceNegotiable: false,
          thumbnailUrl: 'https://cdn.example.com/posts/33.jpg',
          title: '사료 나눔합니다',
        },
        roomId: 12,
      };
      if (path === '/chat/rooms/14') {
        return envelope('CHAT_ROOM_DETAIL_200', {
          ...room,
          post: {
            deleted: true,
            marketStatus: null,
            postId: 34,
            price: null,
            priceNegotiable: null,
            thumbnailUrl: null,
            title: null,
          },
          roomId: 14,
        });
      }
      if (path === '/chat/rooms?size=50') {
        return envelope('CHAT_ROOM_LIST_200', {
          content: [{ ...room, lastMessageAt: '2026-08-20T11:30:00+09:00', lastMessagePreview: '나눔 가능할까요?', unreadCount: 2 }],
          hasNext: true,
          nextCursor: 'rooms-next',
        });
      }
      if (path === '/chat/rooms?cursor=rooms-next&size=50') {
        return envelope('CHAT_ROOM_LIST_200', {
          content: [{ ...room, roomId: 13, lastMessageAt: '2026-08-19T11:30:00+09:00', lastMessagePreview: '안녕하세요', unreadCount: 0 }],
          hasNext: false,
          nextCursor: null,
        });
      }
      if (path === '/chat/rooms/12') return envelope('CHAT_ROOM_DETAIL_200', room);
      if (path === '/chat/rooms/12/messages?size=50') {
        return envelope('CHAT_MESSAGE_LIST_200', {
          content: [{ content: '네 가능합니다', imageUrl: null, messageId: 502, mine: true, senderId: 'me', sentAt: '2026-08-20T11:31:00+09:00', type: 'TEXT' }],
          hasNext: true,
          nextCursor: 'messages-next',
        });
      }
      if (path === '/chat/rooms/12/messages?cursor=messages-next&size=50') {
        return envelope('CHAT_MESSAGE_LIST_200', {
          content: [{ content: '나눔 가능할까요?', imageUrl: null, messageId: 501, mine: false, senderId: 'other-user', sentAt: '2026-08-20T11:30:00+09:00', type: 'TEXT' }],
          hasNext: false,
          nextCursor: null,
        });
      }
      if (path === '/chat/rooms' && options?.method === 'POST') {
        return envelope('CHAT_ROOM_CREATE_200', { roomId: 12 });
      }
      if (path === '/chat/rooms/12/messages' && options?.method === 'POST') {
        if (JSON.parse(options.body.get('data')).type === 'IMAGE') {
          return envelope('CHAT_MESSAGE_SEND_200', { content: null, imageUrl: 'https://cdn.example.com/chat/503.png', messageId: 503, mine: true, senderId: 'me', sentAt: '2026-08-20T11:32:00+09:00', type: 'IMAGE' });
        }
        return envelope('CHAT_MESSAGE_SEND_200', { content: '네 가능해요', imageUrl: null, messageId: 502, mine: true, senderId: 'me', sentAt: '2026-08-20T11:31:00+09:00', type: 'TEXT' });
      }
      if (path === '/chat/rooms/12/read') return envelope('CHAT_ROOM_READ_200', null);
      throw new Error(`Unexpected request: ${path}`);
    },
  },
  '@/src/utils/file': {
    appendMultipartImage: (formData, name, uri) => formData.append(name, uri),
    appendMultipartJson: (formData, data) => formData.append('data', JSON.stringify(data)),
  },
});

assert.equal(
  communityAdapter.toChatPostReference({
    author: { nickname: '판매자', userId: 'seller-user' },
    id: '33',
    kind: 'market',
    priceLabel: '무료',
    status: '진행 중',
    title: '사료 나눔합니다',
    tradeType: '나눔',
  }).authorId,
  'seller-user',
);
assert.doesNotMatch(
  readFileSync(new URL('../src/features/chat/ChatDataBridge.tsx', import.meta.url), 'utf8'),
  /markPostDeleted/,
);

const rooms = await chatApi.getRemoteChatRooms();
const [room] = rooms;
assert.equal(room.roomId, '12');
assert.equal(room.unreadCount, 2);
assert.equal(rooms[1].roomId, '13');
assert.equal((await chatApi.getRemoteChatRoom('12')).opponent.nickname, '초코');
assert.equal((await chatApi.getRemoteChatRoom('14')).post.deleted, true);
assert.deepEqual(
  (await chatApi.getRemoteChatMessages('12')).map(({ messageId }) => messageId),
  ['502', '501'],
);
assert.equal(await chatApi.createRemoteChatRoom('33'), '12');
assert.equal((await chatApi.sendRemoteChatMessage('12', { text: '네 가능해요' })).messageId, '502');
assert.equal((await chatApi.sendRemoteChatMessage('12', { imageUri: 'file:///cache/chat.png' })).type, 'IMAGE');
await assert.rejects(
  () => chatApi.sendRemoteChatMessage('12', { imageUri: 'file:///cache/chat.bmp' }),
  /Invalid chat API response/,
);
await chatApi.markRemoteChatRoomRead('12', '502');
assert.equal(requests[6][1].json.postId, 33);
assert.equal(requests[7][1].body.get('data'), JSON.stringify({ content: '네 가능해요', type: 'TEXT' }));
assert.equal(requests[8][1].body.get('data'), JSON.stringify({ type: 'IMAGE' }));
assert.equal(requests[8][1].body.get('image'), 'file:///cache/chat.png');
assert.equal(requests[9][1].json.lastReadMessageId, 502);
assert.deepEqual(requests.map(([path]) => path), [
  '/chat/rooms?size=50',
  '/chat/rooms?cursor=rooms-next&size=50',
  '/chat/rooms/12',
  '/chat/rooms/14',
  '/chat/rooms/12/messages?size=50',
  '/chat/rooms/12/messages?cursor=messages-next&size=50',
  '/chat/rooms',
  '/chat/rooms/12/messages',
  '/chat/rooms/12/messages',
  '/chat/rooms/12/read',
]);
assert.match(
  readFileSync(new URL('../src/features/chat/ChatStore.tsx', import.meta.url), 'utf8'),
  /chatRepository\.clearState\(\)/,
);
const roomScreenSource = readFileSync(
  new URL('../src/features/chat/screens/ChatRoomScreen.tsx', import.meta.url),
  'utf8',
);
assert.match(roomScreenSource, /onScrollEndDrag/);
assert.doesNotMatch(roomScreenSource, /refreshControl=/);
