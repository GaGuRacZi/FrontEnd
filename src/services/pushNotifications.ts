import { PermissionsAndroid, Platform } from 'react-native';

export type ForegroundPushData = Readonly<Record<string, string>>;

const foregroundPushListeners = new Set<(data: ForegroundPushData) => void>();

async function getMessagingModule() {
  return import('@react-native-firebase/messaging');
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

export function listenForForegroundPushes() {
  let active = true;
  let unsubscribe: (() => void) | undefined;
  void getMessagingModule()
    .then(({ getMessaging, onMessage }) => {
      if (!active) return;
      unsubscribe = onMessage(getMessaging(), (message) => {
        const data = readForegroundPushData(message.data);
        foregroundPushListeners.forEach((listener) => listener(data));
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
