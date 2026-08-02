import AsyncStorage from '@react-native-async-storage/async-storage';

import { isValidClockTime, normalizePaymentMethods } from '../mypageData';
import { createDefaultMyPageState } from '../mypageMappers';
import type {
  LoginConnection,
  NotificationSettings,
  PaymentHistoryItem,
  PaymentMethod,
  PlanId,
  StoredMyPageState,
  SubscriptionState,
  UserProfile,
} from '../types';

const STORAGE_PREFIX = 'paw:mypage:';
const PLAN_IDS: PlanId[] = ['adult-jelly', 'baby-jelly', 'little-jelly'];
const PAYMENT_STATUSES = ['canceled', 'failed', 'paid'];

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return true;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isLoginConnection(value: unknown): value is LoginConnection {
  if (!isRecord(value)) return false;
  return (
    isString(value.email) &&
    (value.method === 'kakao' || value.method === 'local')
  );
}

function isUserProfile(value: unknown, userId: string): value is UserProfile {
  if (!isRecord(value)) return false;
  return (
    value.id === userId &&
    isString(value.createdAt) &&
    isString(value.introduction) &&
    isString(value.location) &&
    Array.isArray(value.loginConnections) &&
    value.loginConnections.every(isLoginConnection) &&
    isString(value.name) &&
    isString(value.nickname) &&
    isNullableString(value.profileImageUri) &&
    isString(value.updatedAt)
  );
}

function isSubscriptionState(value: unknown): value is SubscriptionState {
  if (!isRecord(value)) return false;
  return (
    PLAN_IDS.includes(value.currentPlanId as PlanId) &&
    isNullableString(value.nextBillingDate) &&
    (value.pendingPlanId === null || PLAN_IDS.includes(value.pendingPlanId as PlanId)) &&
    (value.pendingType === null || value.pendingType === 'cancel' || value.pendingType === 'downgrade')
  );
}

function isNotificationSettings(value: unknown): value is Partial<NotificationSettings> {
  if (!isRecord(value)) return false;
  return (
    (value.aiAnalysis === undefined || isBoolean(value.aiAnalysis)) &&
    (value.chat === undefined || isBoolean(value.chat)) &&
    (value.community === undefined || isBoolean(value.community)) &&
    (value.doNotDisturbEnabled === undefined || isBoolean(value.doNotDisturbEnabled)) &&
    (value.doNotDisturbEnd === undefined ||
      (isString(value.doNotDisturbEnd) && isValidClockTime(value.doNotDisturbEnd))) &&
    (value.doNotDisturbStart === undefined ||
      (isString(value.doNotDisturbStart) && isValidClockTime(value.doNotDisturbStart))) &&
    (value.doNotDisturbStart === undefined ||
      value.doNotDisturbEnd === undefined ||
      value.doNotDisturbStart !== value.doNotDisturbEnd) &&
    (value.healthAlert === undefined || isBoolean(value.healthAlert)) &&
    (value.schedule === undefined || isBoolean(value.schedule))
  );
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  if (!isRecord(value)) return false;
  return (
    isString(value.brand) &&
    isString(value.id) &&
    isBoolean(value.isDefault) &&
    isString(value.label) &&
    isString(value.last4)
  );
}

function isPaymentHistoryItem(value: unknown): value is PaymentHistoryItem {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.amount) &&
    isString(value.date) &&
    isString(value.id) &&
    isString(value.methodLabel) &&
    PAYMENT_STATUSES.includes(String(value.status)) &&
    isString(value.title)
  );
}

function createStateFromStoredValue(userId: string, value: unknown): StoredMyPageState {
  const defaults = createDefaultMyPageState(userId);
  if (!isRecord(value)) return defaults;
  const storedNotifications = value.notificationSettings;

  return {
    notificationSettings: isNotificationSettings(storedNotifications)
      ? {
          aiAnalysis: storedNotifications.aiAnalysis ?? defaults.notificationSettings.aiAnalysis,
          chat: storedNotifications.chat ?? defaults.notificationSettings.chat,
          community: storedNotifications.community ?? defaults.notificationSettings.community,
          doNotDisturbEnabled:
            storedNotifications.doNotDisturbEnabled ??
            defaults.notificationSettings.doNotDisturbEnabled,
          doNotDisturbEnd:
            storedNotifications.doNotDisturbEnd ??
            defaults.notificationSettings.doNotDisturbEnd,
          doNotDisturbStart:
            storedNotifications.doNotDisturbStart ??
            defaults.notificationSettings.doNotDisturbStart,
          healthAlert: storedNotifications.healthAlert ?? defaults.notificationSettings.healthAlert,
          schedule: storedNotifications.schedule ?? defaults.notificationSettings.schedule,
        }
      : defaults.notificationSettings,
    paymentHistory:
      Array.isArray(value.paymentHistory) && value.paymentHistory.every(isPaymentHistoryItem)
        ? value.paymentHistory
        : defaults.paymentHistory,
    paymentMethods:
      Array.isArray(value.paymentMethods) && value.paymentMethods.every(isPaymentMethod)
        ? normalizePaymentMethods(value.paymentMethods)
        : defaults.paymentMethods,
    profile: isUserProfile(value.profile, userId) ? value.profile : defaults.profile,
    subscription: isSubscriptionState(value.subscription)
      ? value.subscription
      : defaults.subscription,
  };
}

export const mypageRepository = {
  async deleteUser(userId: string) {
    await AsyncStorage.removeItem(getStorageKey(userId));
  },

  async hasStoredState(userId: string) {
    const stored = await AsyncStorage.getItem(getStorageKey(userId));
    if (!stored) return false;

    try {
      const parsed: unknown = JSON.parse(stored);
      return isRecord(parsed) && isUserProfile(parsed.profile, userId);
    } catch {
      return false;
    }
  },

  async loadState(userId: string): Promise<StoredMyPageState> {
    const stored = await AsyncStorage.getItem(getStorageKey(userId));

    if (!stored) return createDefaultMyPageState(userId);

    try {
      const parsed: unknown = JSON.parse(stored);
      return createStateFromStoredValue(userId, parsed);
    } catch {
      return createDefaultMyPageState(userId);
    }
  },

  async saveState(userId: string, state: StoredMyPageState) {
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  },
};
