import { PermissionsAndroid, Platform } from 'react-native';

export type ForegroundPushData = Readonly<Record<string, string>>;
export type PushTarget =
  | { id: string; type: 'chat_room' | 'map' | 'post' | 'todo' | 'visit' }
  | null;

const foregroundPushListeners = new Set<(data: ForegroundPushData) => void>();
const PUSH_NOTIFICATION_CHANNEL_ID = 'paw_notifications_v2';
const PUSH_TARGET_TYPES: Readonly<
  Partial<Record<string, Exclude<PushTarget, null>['type']>>
> = {
  CHAT_ROOM: 'chat_room',
  MAP: 'map',
  POST: 'post',
  TODO: 'todo',
  VISIT: 'visit',
};

async function getMessagingModule() {
  return import('@react-native-firebase/messaging');
}

async function getNotifeeModule() {
  return import('@notifee/react-native');
}

export async function configurePushNotifications() {
  if (Platform.OS !== 'android') return;
  try {
    const { AndroidImportance, default: notifee } = await getNotifeeModule();
    await notifee.createChannel({
      id: PUSH_NOTIFICATION_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      name: 'PAW 알림',
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 300],
    });
  } catch {
    return;
  }
}

async function displayForegroundPushNotification(
  notification: { body?: string; title?: string } | undefined,
  data: ForegroundPushData,
) {
  if (!notification?.title && !notification?.body) return;
  try {
    const { AndroidImportance, default: notifee } = await getNotifeeModule();
    await configurePushNotifications();
    await notifee.displayNotification({
      android: {
        channelId: PUSH_NOTIFICATION_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        sound: 'default',
      },
      body: notification.body,
      data,
      ios: { sound: 'default' },
      title: notification.title ?? 'PAW',
    });
  } catch {
    return;
  }
}

function readForegroundPushData(data: unknown): ForegroundPushData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return Object.fromEntries(
    Object.entries(data).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  );
}

export function subscribeForegroundPush(listener: (data: ForegroundPushData) => void) {
  foregroundPushListeners.add(listener);
  return () => {
    foregroundPushListeners.delete(listener);
  };
}

export function getChatRoomIdFromPush(data: ForegroundPushData) {
  const roomId = data.roomId;
  return data.type === 'CHAT_MESSAGE' && data.category === 'CHAT' && /^\d+$/.test(roomId ?? '')
    ? roomId
    : null;
}

export function getPushTargetFromPush(data: ForegroundPushData): PushTarget {
  if (data.type === 'CHAT_MESSAGE' && data.category === 'CHAT' && /^\d+$/.test(data.roomId ?? '')) {
    return { id: data.roomId, type: 'chat_room' };
  }
  if (data.type === 'TODO_REMINDER' && /^\d+$/.test(data.todoId ?? '')) {
    return { id: data.todoId, type: 'todo' };
  }
  if ((data.type === 'VISIT_READY' || data.type === 'VISIT_FAILED') && /^\d+$/.test(data.visitId ?? '')) {
    return { id: data.visitId, type: 'visit' };
  }
  if (data.type === 'COMMUNITY_COMMENT' && /^\d+$/.test(data.postId ?? '')) {
    return { id: data.postId, type: 'post' };
  }

  if (/^\d+$/.test(data.targetId ?? '')) {
    const type = PUSH_TARGET_TYPES[data.targetType];
    if (type) return { id: data.targetId, type };
  }
  return null;
}

export function listenForForegroundPushes(
  shouldDisplayNotification: (data: ForegroundPushData) => boolean = () => true,
) {
  let active = true;
  let unsubscribe: (() => void) | undefined;
  void getMessagingModule()
    .then(({ getMessaging, onMessage }) => {
      if (!active) return;
      unsubscribe = onMessage(getMessaging(), (message) => {
        const data = readForegroundPushData(message.data);
        foregroundPushListeners.forEach((listener) => listener(data));
        if (shouldDisplayNotification(data)) {
          void displayForegroundPushNotification(message.notification, data);
        }
      });
    })
    .catch(() => undefined);

  return () => {
    active = false;
    unsubscribe?.();
  };
}

export function listenForNotificationOpens(listener: (data: ForegroundPushData) => void) {
  let active = true;
  let unsubscribeMessaging: (() => void) | undefined;
  let unsubscribeNotifee: (() => void) | undefined;
  const emit = (data: unknown) => listener(readForegroundPushData(data));
  void getMessagingModule()
    .then(({ getInitialNotification, getMessaging, onNotificationOpenedApp }) => {
      if (!active) return;
      const messaging = getMessaging();
      unsubscribeMessaging = onNotificationOpenedApp(messaging, (message) => emit(message.data));
      void getInitialNotification(messaging)
        .then((message) => {
          if (active && message) emit(message.data);
        })
        .catch(() => undefined);
    })
    .catch(() => undefined);
  void getNotifeeModule()
    .then(({ default: notifee, EventType }) => {
      if (!active) return;
      unsubscribeNotifee = notifee.onForegroundEvent(({ detail, type }) => {
        if (type === EventType.PRESS) emit(detail.notification?.data);
      });
      void notifee.getInitialNotification()
        .then((initialNotification) => {
          if (active && initialNotification) emit(initialNotification.notification.data);
        })
        .catch(() => undefined);
    })
    .catch(() => undefined);

  return () => {
    active = false;
    unsubscribeMessaging?.();
    unsubscribeNotifee?.();
  };
}

export function listenForPushTokenRefresh(listener: (pushToken: string) => void) {
  let active = true;
  let unsubscribe: (() => void) | undefined;
  void getMessagingModule()
    .then(({ getMessaging, onTokenRefresh }) => {
      if (!active) return;
      unsubscribe = onTokenRefresh(getMessaging(), (pushToken) => {
        if (active && pushToken) listener(pushToken);
      });
    })
    .catch(() => undefined);

  return () => {
    active = false;
    unsubscribe?.();
  };
}

export async function hasPushPermission() {
  try {
    if (Platform.OS === 'android') {
      if (Platform.Version < 33) return true;
      return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }

    const { AuthorizationStatus, getMessaging, hasPermission } = await getMessagingModule();
    const status = await hasPermission(getMessaging());
    return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

export async function requestPushPermission() {
  try {
    if (Platform.OS === 'android') {
      await configurePushNotifications();
      if (Platform.Version < 33) return true;
      return (
        (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) ===
        PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const { AuthorizationStatus, getMessaging, requestPermission } = await getMessagingModule();
    const status = await requestPermission(getMessaging());
    return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

export async function getPushToken() {
  try {
    const { getMessaging, getToken } = await getMessagingModule();
    return (await getToken(getMessaging())) || null;
  } catch {
    return null;
  }
}

export async function requestPushToken() {
  return (await requestPushPermission()) ? getPushToken() : null;
}
