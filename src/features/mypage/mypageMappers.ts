import type {
  NotificationSettings,
  PaymentHistoryItem,
  PaymentMethod,
  StoredMyPageState,
  SubscriptionState,
  UserProfile,
} from './types';
import type { RemoteUserProfile } from '../auth/services/kakaoAuthContract';
import type { AuthMethod } from '../auth/session/AuthSessionStore';

function nowIso() {
  return new Date().toISOString();
}

export function createDefaultNotificationSettings(): NotificationSettings {
  return {
    aiAnalysis: true,
    chat: true,
    community: true,
    doNotDisturbEnabled: false,
    doNotDisturbEnd: '07:00',
    doNotDisturbStart: '22:00',
    healthAlert: true,
    schedule: true,
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

export function createDefaultPaymentMethods(): PaymentMethod[] {
  return [];
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
    paymentMethods: createDefaultPaymentMethods(),
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

  return {
    ...current,
    createdAt: current.createdAt || new Date().toISOString(),
    id: remote.uid,
    introduction: remote.intro,
    location: remote.regionName,
    loginConnections: connections.length ? connections : [{ email: remote.email, method: method ?? 'local' }],
    name: remote.name,
    nickname: remote.nickname,
    profileImageUri: remote.profileUrl,
    updatedAt: new Date().toISOString(),
  };
}
