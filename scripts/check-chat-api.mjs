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
      if (path === '/chat/rooms?size=100') {
        return envelope('CHAT_ROOM_LIST_200', {
          content: [{ ...room, lastMessageAt: '2026-08-20T11:30:00+09:00', lastMessagePreview: '나눔 가능할까요?', unreadCount: 2 }],
        });
      }
      if (path === '/chat/rooms/12') return envelope('CHAT_ROOM_DETAIL_200', room);
      if (path === '/chat/rooms/12/messages?size=100') {
        return envelope('CHAT_MESSAGE_LIST_200', {
          content: [{ content: '나눔 가능할까요?', imageUrl: null, messageId: 501, mine: false, senderId: 'other-user', sentAt: '2026-08-20T11:30:00+09:00', type: 'TEXT' }],
        });
      }
      if (path === '/chat/rooms' && options?.method === 'POST') {
        return envelope('CHAT_ROOM_CREATE_200', { roomId: 12 });
      }
      if (path === '/chat/rooms/12/messages' && options?.method === 'POST') {
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

const [room] = await chatApi.getRemoteChatRooms();
assert.equal(room.roomId, '12');
assert.equal(room.unreadCount, 2);
assert.equal((await chatApi.getRemoteChatRoom('12')).opponent.nickname, '초코');
assert.equal((await chatApi.getRemoteChatMessages('12'))[0].messageId, '501');
assert.equal(await chatApi.createRemoteChatRoom('33'), '12');
assert.equal((await chatApi.sendRemoteChatMessage('12', { text: '네 가능해요' })).messageId, '502');
await chatApi.markRemoteChatRoomRead('12', '502');
assert.equal(requests[3][1].json.postId, '33');
assert.equal(requests[4][1].body.get('data'), JSON.stringify({ content: '네 가능해요', type: 'TEXT' }));
assert.deepEqual(requests.map(([path]) => path), [
  '/chat/rooms?size=100',
  '/chat/rooms/12',
  '/chat/rooms/12/messages?size=100',
  '/chat/rooms',
  '/chat/rooms/12/messages',
  '/chat/rooms/12/read',
]);
