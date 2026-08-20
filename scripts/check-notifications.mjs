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
const pushNotifications = loadModule('../src/services/pushNotifications.ts', {
  'react-native': {
    PermissionsAndroid: { PERMISSIONS: {}, RESULTS: {} },
    Platform: { OS: 'android', Version: 35 },
  },
});
const pushNotificationsSource = readFileSync(
  new URL('../src/services/pushNotifications.ts', import.meta.url),
  'utf8',
);
const firebaseConfig = JSON.parse(
  readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'),
);
const { retryOperation } = loadModule('../src/utils/retry.ts', {});
const todayInKorea = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
                  body: '나눔 가능할까요?',
                  category: 'CHAT',
                  ctaLabel: '채팅 보기',
                  createdAt: '2026-08-20T09:30:00+09:00',
                  id: 102,
                  isRead: false,
                  targetId: 12,
                  targetType: 'CHAT_ROOM',
                  title: '초코님의 메시지',
                },
                {
                  body: '오늘 09:00 · 미완료 상태예요',
                  category: 'TODO',
                  ctaLabel: '할 일 보기',
                  createdAt: `${todayInKorea}T09:00:00`,
                  id: 101,
                  isRead: false,
                  targetId: 15,
                  targetType: 'TODO',
                  title: '영양제 체크가 필요해요',
                },
                {
                  body: '진료 녹음 분석 결과를 확인할 수 있어요',
                  category: 'AI',
                  ctaLabel: '요약 보기',
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
                  ctaLabel: '글 보기',
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
                  ctaLabel: '지도 보기',
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
assert.equal(
  pushNotifications.getChatRoomIdFromPush({
    category: 'CHAT',
    roomId: '12',
    type: 'CHAT_MESSAGE',
  }),
  '12',
);
assert.equal(
  pushNotifications.getChatRoomIdFromPush({
    category: 'COMMUNITY',
    roomId: '12',
    type: 'CHAT_MESSAGE',
  }),
  null,
);
assert.deepEqual(pushNotifications.getPushTargetFromPush({
  category: 'CHAT',
  roomId: '12',
  type: 'CHAT_MESSAGE',
}), { id: '12', type: 'chat_room' });
assert.deepEqual(pushNotifications.getPushTargetFromPush({
  todoId: '15',
  type: 'TODO_REMINDER',
}), { id: '15', type: 'todo' });
assert.deepEqual(pushNotifications.getPushTargetFromPush({
  type: 'VISIT_READY',
  visitId: '7',
}), { id: '7', type: 'visit' });
assert.deepEqual(pushNotifications.getPushTargetFromPush({
  postId: '10',
  type: 'COMMUNITY_COMMENT',
}), { id: '10', type: 'post' });
assert.deepEqual(pushNotifications.getPushTargetFromPush({
  category: 'EMERGENCY',
  targetId: '3',
  targetType: 'MAP',
}), { id: '3', type: 'map' });
assert.match(pushNotificationsSource, /createChannel\(\{/);
assert.match(pushNotificationsSource, /sound: 'default'/);
assert.match(pushNotificationsSource, /displayForegroundPushNotification/);
assert.equal(
  firebaseConfig['react-native'].messaging_android_notification_channel_id,
  'paw_notifications_v2',
);
assert.match(pushNotificationsSource, /PUSH_NOTIFICATION_CHANNEL_ID = 'paw_notifications_v2'/);
const appProvidersSource = readFileSync(
  new URL('../src/providers/AppProviders.tsx', import.meta.url),
  'utf8',
);
assert.match(appProvidersSource, /listenForNotificationOpens/);
assert.match(appProvidersSource, /if \(roomResult\.ok\) pendingRoomIdsRef\.current\.delete\(roomId\)/);
assert.match(appProvidersSource, /새 채팅 메시지가 도착했어요/);
assert.match(appProvidersSource, /target\.type === 'map'/);
const notificationScreenSource = readFileSync(
  new URL('../src/features/home/screens/NotificationScreen.tsx', import.meta.url),
  'utf8',
);
assert.match(notificationScreenSource, /case 'map':\s+return '\/health-summary'/);
const notificationSettingsSource = readFileSync(
  new URL('../src/features/mypage/screens/MyPageNotificationsScreen.tsx', import.meta.url),
  'utf8',
);
assert.match(notificationSettingsSource, /건강 이상을 제외한 휴대폰 알림이 울리지 않아요/);
assert.equal(typeof pushNotifications.listenForPushTokenRefresh, 'function');
let retryAttempts = 0;
assert.equal(
  await retryOperation(async () => {
    retryAttempts += 1;
    if (retryAttempts < 3) throw new Error('temporary-failure');
    return 'registered';
  }),
  'registered',
);
assert.equal(retryAttempts, 3);
assert.equal(page.hasNext, true);
assert.equal(page.nextCursor, 'next-cursor');
assert.deepEqual(
  page.notifications.map(({ category, target }) => [category, target?.type]),
  [
    ['chat', 'chat_room'],
    ['schedule', 'todo'],
    ['ai', 'visit'],
    ['community', 'post'],
    ['emergency', 'map'],
  ],
);
assert.equal(page.notifications[1].dateGroupLabel, '오늘');
assert.equal(page.notifications[1].actionLabel, '할 일 보기');
assert.equal(requests[0][0], '/notifications?size=50&category=COMMUNITY');
await notificationApi.getRemoteNotifications({ category: 'chat' });
assert.equal(requests[1][0], '/notifications?size=50&category=CHAT');
assert.equal(await notificationApi.getRemoteUnreadNotificationCount(), 3);

await notificationApi.markRemoteNotificationRead('101');
await notificationApi.markAllRemoteNotificationsRead();
assert.deepEqual(requests.slice(2), [
  ['/notifications/unread-count', undefined],
  ['/notifications/101/read', { method: 'PATCH' }],
  ['/notifications/read-all', { method: 'PATCH' }],
]);
assert.throws(() => notificationApi.parseRemoteNotificationPage({
  code: 'NOTI_LIST_200',
  isSuccess: true,
  result: { content: [], hasNext: true, nextCursor: null },
}));
