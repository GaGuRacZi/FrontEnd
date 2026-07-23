import type { SignupData } from '@/src/features/auth/signup/SignupContext';

import type {
  NotificationSettings,
  PaymentHistoryItem,
  PaymentMethod,
  StoredMyPageState,
  SubscriptionState,
  UserProfile,
} from './types';

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
    marketing: false,
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
  return [
    {
      brand: '간편페이',
      id: 'easy-pay',
      isDefault: true,
      label: '간편페이',
      last4: '등록 대기',
    },
  ];
}

export function createDefaultPaymentHistory(): PaymentHistoryItem[] {
  return [];
}

export function signupDataToProfile(data: SignupData, userId: string): UserProfile {
  const now = nowIso();
  const nickname = data.nickname.trim() || data.name.trim() || 'PAW 보호자';

  return {
    createdAt: now,
    id: userId,
    introduction: data.introduction.trim(),
    location: data.region.trim(),
    loginConnections: [
      {
        email: data.email.trim().toLowerCase(),
        method: data.method,
      },
    ],
    name: data.name.trim(),
    nickname,
    profileImageUri: data.profileImageUri,
    updatedAt: now,
  };
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
