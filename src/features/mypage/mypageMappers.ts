import type {
  NotificationSettings,
  PaymentHistoryItem,
  StoredMyPageState,
  SubscriptionState,
  UserProfile,
} from './types';
import type { RemoteUserProfile } from '../auth/services/kakaoAuthContract';
import type { AuthMethod } from '../auth/session/AuthSessionStore';
import type { RemoteMyPageProfile } from './services/mypageApi';

function nowIso() {
  return new Date().toISOString();
}

export function createDefaultNotificationSettings(): NotificationSettings {
  return {
    aiAnalysis: true,
    benefit: false,
    chat: false,
    community: true,
    doNotDisturbEnabled: true,
    doNotDisturbEnd: '07:00',
    doNotDisturbStart: '22:00',
    healthAlert: true,
    schedule: true,
  };
}

export function disablePushNotifications(
  settings: NotificationSettings,
): NotificationSettings {
  if (
    !settings.aiAnalysis &&
    !settings.benefit &&
    !settings.chat &&
    !settings.community &&
    !settings.doNotDisturbEnabled &&
    !settings.healthAlert &&
    !settings.schedule
  ) {
    return settings;
  }

  return {
    ...settings,
    aiAnalysis: false,
    benefit: false,
    chat: false,
    community: false,
    doNotDisturbEnabled: false,
    healthAlert: false,
    schedule: false,
  };
}

export function createDefaultSubscription(): SubscriptionState {
  return {
    currentPlanId: 'baby-jelly',
    nextBillingDate: null,
    pendingPlanId: null,
    pendingType: null,
  };
}

export function createDefaultPaymentHistory(): PaymentHistoryItem[] {
  return [];
}

export function createFallbackProfile(userId: string): UserProfile {
  const now = nowIso();

  return {
    createdAt: now,
    id: userId,
    introduction: '',
    location: '',
    regionCode: null,
    loginConnections: [{ email: '', method: 'local' }],
    name: '',
    nickname: 'PAW 보호자',
    profileImageUri: null,
    updatedAt: now,
  };
}

export function createDefaultMyPageState(userId: string): StoredMyPageState {
  return {
    notificationSettings: createDefaultNotificationSettings(),
    paymentHistory: createDefaultPaymentHistory(),
    profile: createFallbackProfile(userId),
    subscription: createDefaultSubscription(),
  };
}

export function mergeRemoteUserProfile(
  current: UserProfile,
  remote: RemoteUserProfile,
  method?: AuthMethod,
): UserProfile {
  const connections = method && !current.loginConnections.some(({ method: currentMethod }) => currentMethod === method)
    ? [...current.loginConnections, { email: remote.email, method }]
    : current.loginConnections;
  const now = nowIso();

  return {
    ...current,
    createdAt: current.createdAt || now,
    id: remote.uid,
    introduction: remote.intro,
    location: remote.regionName || current.location,
    regionCode: current.regionCode,
    loginConnections: connections.length ? connections : [{ email: remote.email, method: method ?? 'local' }],
    name: remote.name,
    nickname: remote.nickname,
    profileImageUri: remote.profileUrl,
    updatedAt: now,
  };
}

export function mergeRemoteMyPageProfile(
  current: UserProfile,
  remote: RemoteMyPageProfile,
): UserProfile {
  const now = nowIso();

  return {
    ...current,
    createdAt: current.createdAt || now,
    id: remote.uid,
    introduction: remote.intro,
    location: remote.regionName || current.location,
    loginConnections: remote.linkedAccounts,
    name: remote.name,
    nickname: remote.nickname,
    profileImageUri: remote.profileUrl,
    regionCode: remote.regionCode,
    updatedAt: now,
  };
}
