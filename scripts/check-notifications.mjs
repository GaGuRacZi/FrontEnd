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

const koreanDateTime = loadModule('../src/utils/koreanDateTime.ts', {});
const requests = [];
const notificationApi = loadModule('../src/features/home/services/notificationApi.ts', {
  '@/src/services/apiClient': {
    apiRequest: async (path, options) => {
      requests.push([path, options]);
      return {
        code: path.startsWith('/notifications?')
          ? 'NOTI_LIST_200'
          : path === '/notifications/unread-count'
            ? 'NOTI_UNREAD_200'
            : path === '/notifications/read-all'
              ? 'NOTI_READ_ALL_200'
              : 'NOTI_READ_200',
        isSuccess: true,
        message: 'ok',
        result: path.startsWith('/notifications?')
          ? {
              content: [
                {
                  body: '오늘 09:00 · 미완료 상태예요',
                  category: 'TODO',
                  createdAt: '2026-08-20T09:00:00',
                  id: 101,
                  isRead: false,
                  targetId: 15,
                  targetType: 'TODO',
                  title: '영양제 체크가 필요해요',
                },
                {
                  body: '진료 녹음 분석 결과를 확인할 수 있어요',
                  category: 'AI',
                  createdAt: '2026-08-19T18:10:00+09:00',
                  id: 100,
                  isRead: true,
                  targetId: 7,
                  targetType: 'VISIT',
                  title: 'AI 진료 요약이 완료됐어요',
                },
                {
                  body: '새 댓글을 확인해보세요',
                  category: 'COMMUNITY',
                  createdAt: '2026-08-19T12:00:00+09:00',
                  id: 99,
                  isRead: false,
                  targetId: 10,
                  targetType: 'POST',
                  title: '내 게시글에 댓글이 달렸어요',
                },
                {
                  body: '건강 상태를 확인해주세요',
                  category: 'EMERGENCY',
                  createdAt: '2026-08-19T10:00:00+09:00',
                  id: 98,
                  isRead: false,
                  targetId: 3,
                  targetType: 'MAP',
                  title: '건강 알림',
                },
              ],
              hasNext: true,
              nextCursor: 'next-cursor',
            }
          : path === '/notifications/unread-count'
            ? { count: 3 }
          : null,
      };
    },
  },
  '@/src/utils/koreanDateTime': koreanDateTime,
});

const page = await notificationApi.getRemoteNotifications({ category: 'community' });
assert.equal(page.hasNext, true);
assert.equal(page.nextCursor, 'next-cursor');
assert.deepEqual(
  page.notifications.map(({ category, target }) => [category, target?.type]),
  [
    ['schedule', 'todo'],
    ['ai', 'visit'],
    ['community', 'post'],
    ['emergency', 'map'],
  ],
);
assert.equal(page.notifications[0].dateGroupLabel, '오늘');
assert.equal(requests[0][0], '/notifications?size=50&category=COMMUNITY');
assert.equal(await notificationApi.getRemoteUnreadNotificationCount(), 3);

await notificationApi.markRemoteNotificationRead('101');
await notificationApi.markAllRemoteNotificationsRead();
assert.deepEqual(requests.slice(1), [
  ['/notifications/unread-count', undefined],
  ['/notifications/101/read', { method: 'PATCH' }],
  ['/notifications/read-all', { method: 'PATCH' }],
]);
assert.throws(() => notificationApi.parseRemoteNotificationPage({
  code: 'NOTI_LIST_200',
  isSuccess: true,
  result: { content: [], hasNext: true, nextCursor: null },
}));
