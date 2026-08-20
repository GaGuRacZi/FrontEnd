import { apiRequest } from '@/src/services/apiClient';

import type { LoginConnection, NotificationSettings } from '../types';

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

export function parseRemoteNotificationSettingsEnvelope(
  value: unknown,
  expectedCode: 'MYPAGE_NOTI_200' | 'MYPAGE_NOTI_UPDATE_200',
): NotificationSettings {
  const settings = readRecord(readEnvelope(value, expectedCode));
  const booleanKeys = [
    ['aiAnalysis', 'aiAnalysisAlarm'],
    ['benefit', 'benefitAlarm'],
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
    'aiAnalysis' | 'benefit' | 'chat' | 'community' | 'doNotDisturbEnabled' | 'healthAlert' | 'schedule'
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
    ...(settings.benefit === undefined ? {} : { benefitAlarm: settings.benefit }),
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
