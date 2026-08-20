import { PermissionsAndroid, Platform } from 'react-native';

async function getMessagingModule() {
  return import('@react-native-firebase/messaging');
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
