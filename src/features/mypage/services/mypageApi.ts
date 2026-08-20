import { apiRequest } from '@/src/services/apiClient';

import type {
  LoginConnection,
  NotificationSettings,
  PaymentHistoryItem,
  PlanId,
  SubscriptionState,
} from '../types';

export type RemoteMyPageProfile = {
  email: string;
  intro: string;
  isNew: boolean;
  linkedAccounts: LoginConnection[];
  name: string;
  nickname: string;
  profileUrl: string | null;
  regionCode: string | null;
  regionName: string;
  uid: string;
};

export type RemoteMyPageHome = {
  subscription: {
    active: boolean;
    displayName: string;
    plan: string;
  };
};

type WithdrawalPreview = {
  hasOngoingMarketTrade: boolean;
  subscribePlan: string;
  subscribing: boolean;
};

export class MyPageApiContractError extends Error {
  constructor() {
    super('Invalid my page API response.');
    this.name = 'MyPageApiContractError';
  }
}

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MyPageApiContractError();
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new MyPageApiContractError();
  return value.trim();
}

function readNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  return readString(value);
}

function readId(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value) && Number(value) > 0) {
    return value;
  }
  throw new MyPageApiContractError();
}

function readPlanId(value: unknown): PlanId {
  if (value === 'BASIC') return 'baby-jelly';
  if (value === 'PRO') return 'little-jelly';
  if (value === 'ULTIMATE') return 'adult-jelly';
  throw new MyPageApiContractError();
}

function readPlanCatalog(value: unknown) {
  if (!Array.isArray(value)) throw new MyPageApiContractError();
  return value.map((item) => {
    const plan = readRecord(item);
    const monthlyPrice = plan.priceWon;
    if (typeof monthlyPrice !== 'number' || !Number.isSafeInteger(monthlyPrice) || monthlyPrice < 0) {
      throw new MyPageApiContractError();
    }
    return {
      id: readPlanId(plan.plan),
      monthlyPrice,
      name: readString(plan.displayName),
    };
  });
}

function readDate(value: unknown) {
  const dateTime = readString(value);
  const date = dateTime.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new MyPageApiContractError();
  return date;
}

function readNullableDate(value: unknown) {
  return value === null || value === undefined ? null : readDate(value);
}

function getRemotePlan(planId: PlanId) {
  if (planId === 'baby-jelly') return 'BASIC';
  if (planId === 'little-jelly') return 'PRO';
  return 'ULTIMATE';
}

function readEnvelope(value: unknown, expectedCode: string) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true || envelope.code !== expectedCode) {
    throw new MyPageApiContractError();
  }
  return envelope.result;
}

function readTime(value: unknown) {
  const time = readString(value);
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) throw new MyPageApiContractError();
  const [hour, minute] = time.split(':').map(Number);
  if (hour > 23 || minute > 59) throw new MyPageApiContractError();
  return time.slice(0, 5);
}

function readLinkedAccounts(value: unknown, email: string): LoginConnection[] {
  if (!Array.isArray(value)) throw new MyPageApiContractError();

  const methods = value.map((item) => {
    const socialType = readString(readRecord(item).socialType);
    if (socialType === 'KAKAO') return 'kakao' as const;
    if (socialType === 'LOCAL') return 'local' as const;
    throw new MyPageApiContractError();
  });

  return [...new Set(methods)].map((method) => ({ email, method }));
}

export function parseRemoteMyPageProfileEnvelope(value: unknown): RemoteMyPageProfile {
  const profile = readRecord(readEnvelope(value, 'MYPAGE_PROFILE_200'));
  const email = readString(profile.email).toLowerCase();

  return {
    email,
    intro: typeof profile.intro === 'string' ? profile.intro.trim() : '',
    isNew: typeof profile.isNew === 'boolean' ? profile.isNew : false,
    linkedAccounts: readLinkedAccounts(profile.linkedAccounts, email),
    name: readString(profile.name),
    nickname: readString(profile.nickname),
    profileUrl: readNullableString(profile.profileUrl),
    regionCode: readNullableString(profile.regionCode),
    regionName: typeof profile.regionName === 'string' ? profile.regionName.trim() : '',
    uid: readString(profile.uid),
  };
}

export function parseRemoteMyPageHomeEnvelope(value: unknown): RemoteMyPageHome {
  const home = readRecord(readEnvelope(value, 'MYPAGE_HOME_200'));
  const subscription = readRecord(home.subscribe);
  if (typeof subscription.active !== 'boolean') throw new MyPageApiContractError();

  return {
    subscription: {
      active: subscription.active,
      displayName: readString(subscription.displayName),
      plan: readString(subscription.plan),
    },
  };
}

export function parseRemoteSubscriptionEnvelope(
  value: unknown,
  expectedCode: 'BILLING_PLAN_200' | 'BILLING_PLAN_CHANGE_200',
): SubscriptionState {
  const subscription = readRecord(readEnvelope(value, expectedCode));
  const currentPlanId = readPlanId(subscription.plan);
  const pendingPlanId = subscription.pendingPlan === null || subscription.pendingPlan === undefined
    ? null
    : readPlanId(subscription.pendingPlan);
  if (subscription.status !== 'ACTIVE' && subscription.status !== 'PENDING_CHANGE') {
    throw new MyPageApiContractError();
  }

  return {
    currentPlanId,
    nextBillingDate: readNullableDate(subscription.periodEnd),
    pendingPlanId,
    pendingType: pendingPlanId === null
      ? null
      : pendingPlanId === 'baby-jelly'
        ? 'cancel'
        : 'downgrade',
    plans: readPlanCatalog(subscription.plans),
  };
}

function readPayment(value: unknown): PaymentHistoryItem {
  const payment = readRecord(value);
  const type = payment.type;
  const status = payment.status;
  if (type !== 'PURCHASE' && type !== 'RENEWAL') throw new MyPageApiContractError();
  if (status !== 'SUCCESS') throw new MyPageApiContractError();
  const displayName = readString(payment.displayName);
  const amount = payment.amount;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0) {
    throw new MyPageApiContractError();
  }

  return {
    amount,
    date: readDate(payment.paidAt),
    id: readId(payment.paymentId),
    status: 'paid',
    title: type === 'RENEWAL' ? `${displayName} 정기 결제` : `${displayName} 결제`,
  };
}

export function parseRemotePaymentPageEnvelope(value: unknown) {
  const page = readRecord(readEnvelope(value, 'BILLING_PAYMENT_LIST_200'));
  if (!Array.isArray(page.content) || typeof page.hasNext !== 'boolean') {
    throw new MyPageApiContractError();
  }
  const nextCursor = page.nextCursor === null || page.nextCursor === undefined
    ? null
    : readString(page.nextCursor);
  if (page.hasNext && !nextCursor) throw new MyPageApiContractError();

  return {
    hasNext: page.hasNext,
    items: page.content.map(readPayment),
    nextCursor,
  };
}

export function parseRemotePaymentDetailEnvelope(value: unknown) {
  return readPayment(readEnvelope(value, 'BILLING_PAYMENT_DETAIL_200'));
}

export function parseRemoteNotificationSettingsEnvelope(
  value: unknown,
  expectedCode: 'MYPAGE_NOTI_200' | 'MYPAGE_NOTI_UPDATE_200',
): NotificationSettings {
  const settings = readRecord(readEnvelope(value, expectedCode));
  const booleanKeys = [
    ['aiAnalysis', 'aiAnalysisAlarm'],
    ['chat', 'chatAlarm'],
    ['community', 'communityAlarm'],
    ['doNotDisturbEnabled', 'dndEnabled'],
    ['healthAlert', 'healthAlarm'],
    ['schedule', 'todoAlarm'],
  ] as const;

  const values = Object.fromEntries(
    booleanKeys.map(([localKey, remoteKey]) => {
      const setting = settings[remoteKey];
      if (typeof setting !== 'boolean') throw new MyPageApiContractError();
      return [localKey, setting];
    }),
  ) as Pick<
    NotificationSettings,
    'aiAnalysis' | 'chat' | 'community' | 'doNotDisturbEnabled' | 'healthAlert' | 'schedule'
  >;

  const doNotDisturbStart = readTime(settings.dndStart);
  const doNotDisturbEnd = readTime(settings.dndEnd);
  if (doNotDisturbStart === doNotDisturbEnd) throw new MyPageApiContractError();

  return { ...values, doNotDisturbEnd, doNotDisturbStart };
}

export function parseWithdrawalPreviewEnvelope(value: unknown): WithdrawalPreview {
  const preview = readRecord(readEnvelope(value, 'MYPAGE_WITHDRAWAL_PREVIEW_200'));
  if (
    typeof preview.subscribing !== 'boolean' ||
    typeof preview.hasOngoingMarketTrade !== 'boolean'
  ) {
    throw new MyPageApiContractError();
  }

  return {
    hasOngoingMarketTrade: preview.hasOngoingMarketTrade,
    subscribePlan: readString(preview.subscribePlan),
    subscribing: preview.subscribing,
  };
}

export async function getRemoteMyPageProfile() {
  return parseRemoteMyPageProfileEnvelope(await apiRequest<unknown>('/mypage/profile'));
}

export async function getRemoteMyPageHome() {
  return parseRemoteMyPageHomeEnvelope(await apiRequest<unknown>('/mypage/home'));
}

export async function getRemoteSubscription() {
  return parseRemoteSubscriptionEnvelope(
    await apiRequest<unknown>('/mypage/subscription'),
    'BILLING_PLAN_200',
  );
}

export async function changeRemoteSubscription(planId: PlanId) {
  return parseRemoteSubscriptionEnvelope(
    await apiRequest<unknown>('/mypage/subscription', {
      json: { plan: getRemotePlan(planId) },
      method: 'POST',
    }),
    'BILLING_PLAN_CHANGE_200',
  );
}

export async function getRemotePaymentHistory() {
  const payments: PaymentHistoryItem[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const query = new URLSearchParams({ size: '50' });
    if (cursor) query.set('cursor', cursor);
    const page = parseRemotePaymentPageEnvelope(
      await apiRequest<unknown>(`/mypage/payments?${query.toString()}`),
    );
    payments.push(...page.items);
    if (!page.hasNext || !page.nextCursor || seenCursors.has(page.nextCursor)) break;
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (cursor);

  return payments;
}

export async function getRemotePayment(paymentId: string) {
  const id = Number(paymentId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new MyPageApiContractError();
  return parseRemotePaymentDetailEnvelope(
    await apiRequest<unknown>(`/mypage/payments/${id}`),
  );
}

export async function getRemoteNotificationSettings() {
  return parseRemoteNotificationSettingsEnvelope(
    await apiRequest<unknown>('/mypage/notifications/settings'),
    'MYPAGE_NOTI_200',
  );
}

export async function updateRemoteNotificationSettings(settings: Partial<NotificationSettings>) {
  if (
    (settings.doNotDisturbStart === undefined) !==
    (settings.doNotDisturbEnd === undefined)
  ) {
    throw new MyPageApiContractError();
  }

  const payload = {
    ...(settings.aiAnalysis === undefined ? {} : { aiAnalysisAlarm: settings.aiAnalysis }),
    ...(settings.chat === undefined ? {} : { chatAlarm: settings.chat }),
    ...(settings.community === undefined ? {} : { communityAlarm: settings.community }),
    ...(settings.doNotDisturbEnabled === undefined
      ? {}
      : { dndEnabled: settings.doNotDisturbEnabled }),
    ...(settings.doNotDisturbStart === undefined || settings.doNotDisturbEnd === undefined
      ? {}
      : {
          dndEnd: settings.doNotDisturbEnd,
          dndStart: settings.doNotDisturbStart,
        }),
    ...(settings.healthAlert === undefined ? {} : { healthAlarm: settings.healthAlert }),
    ...(settings.schedule === undefined ? {} : { todoAlarm: settings.schedule }),
  };

  return parseRemoteNotificationSettingsEnvelope(
    await apiRequest<unknown>('/mypage/notifications/settings', {
      json: payload,
      method: 'PATCH',
    }),
    'MYPAGE_NOTI_UPDATE_200',
  );
}

export async function updateRemoteMyPageRegion(regionCode: string) {
  readEnvelope(
    await apiRequest<unknown>('/mypage/region', {
      json: { regionCode: readString(regionCode) },
      method: 'PATCH',
    }),
    'MYPAGE_REGION_UPDATE_200',
  );
}

export async function registerRemotePushToken(pushToken: string | null) {
  readEnvelope(
    await apiRequest<unknown>('/users/me/push-token', {
      json: { pushToken: pushToken?.trim() || '' },
      method: 'PUT',
    }),
    'USER_PUSH_TOKEN_200',
  );
}

export async function deleteRemoteProfileImage() {
  readEnvelope(
    await apiRequest<unknown>('/mypage/profile/image', { method: 'DELETE' }),
    'MYPAGE_PROFILE_IMAGE_DELETE_200',
  );
}

export async function getRemoteWithdrawalPreview() {
  return parseWithdrawalPreviewEnvelope(await apiRequest<unknown>('/mypage/withdrawal/preview'));
}

export async function deleteRemoteAccount() {
  readEnvelope(
    await apiRequest<unknown>('/mypage/withdrawal', { method: 'DELETE' }),
    'MYPAGE_WITHDRAWAL_200',
  );
}
