import { apiRequest } from '@/src/services/apiClient';
import {
  formatKoreanChatListTime,
  formatKoreanRelativeTime,
  parseKoreanServerDate,
} from '@/src/utils/koreanDateTime';

import type {
  NotificationCategory,
  NotificationItem,
  NotificationTarget,
} from '../types';

type RemoteNotificationCategory = 'AI' | 'COMMUNITY' | 'EMERGENCY' | 'TODO';

type NotificationPage = {
  hasNext: boolean;
  nextCursor: string | null;
  notifications: NotificationItem[];
};

const CATEGORY_META: Record<RemoteNotificationCategory, Pick<NotificationItem, 'category' | 'categoryLabel'>> = {
  AI: { category: 'ai', categoryLabel: 'AI 분석' },
  COMMUNITY: { category: 'community', categoryLabel: '커뮤니티' },
  EMERGENCY: { category: 'emergency', categoryLabel: '건강 알림' },
  TODO: { category: 'schedule', categoryLabel: '할 일' },
};

const REMOTE_CATEGORY: Record<NotificationCategory, RemoteNotificationCategory> = {
  ai: 'AI',
  community: 'COMMUNITY',
  emergency: 'EMERGENCY',
  schedule: 'TODO',
};

export class NotificationApiContractError extends Error {
  constructor() {
    super('Invalid notification API response.');
    this.name = 'NotificationApiContractError';
  }
}

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NotificationApiContractError();
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new NotificationApiContractError();
  return value.trim();
}

function readId(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value) && Number(value) > 0) {
    return value;
  }
  throw new NotificationApiContractError();
}

function readEnvelope(value: unknown, expectedCode: string) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true || envelope.code !== expectedCode) {
    throw new NotificationApiContractError();
  }
  return envelope.result;
}

function readTarget(value: Record<string, unknown>): NotificationTarget {
  const type = value.targetType;
  const id = value.targetId;
  if (type === undefined || type === null || id === undefined || id === null) return null;
  if (type !== 'TODO' && type !== 'VISIT' && type !== 'POST' && type !== 'MAP') {
    throw new NotificationApiContractError();
  }

  return { id: readId(id), type: type.toLowerCase() as NonNullable<NotificationTarget>['type'] };
}

function getDateGroupLabel(createdAt: string) {
  const label = formatKoreanChatListTime(createdAt);
  return /^(오전|오후)/.test(label) ? '오늘' : label;
}

function parseRemoteNotification(value: unknown): NotificationItem {
  const notification = readRecord(value);
  const remoteCategory = readString(notification.category) as RemoteNotificationCategory;
  const category = CATEGORY_META[remoteCategory];
  const createdAt = readString(notification.createdAt);
  if (!category || !parseKoreanServerDate(createdAt) || typeof notification.isRead !== 'boolean') {
    throw new NotificationApiContractError();
  }

  return {
    ...category,
    dateGroupLabel: getDateGroupLabel(createdAt),
    description: readString(notification.body),
    id: readId(notification.id),
    isRead: notification.isRead,
    target: readTarget(notification),
    timeLabel: formatKoreanRelativeTime(createdAt),
    title: readString(notification.title),
  };
}

export function parseRemoteNotificationPage(value: unknown): NotificationPage {
  const page = readRecord(readEnvelope(value, 'NOTI_LIST_200'));
  if (!Array.isArray(page.content) || typeof page.hasNext !== 'boolean') {
    throw new NotificationApiContractError();
  }

  const nextCursor = page.nextCursor === null || page.nextCursor === undefined
    ? null
    : readString(page.nextCursor);
  if (page.hasNext && !nextCursor) throw new NotificationApiContractError();

  return {
    hasNext: page.hasNext,
    nextCursor,
    notifications: page.content.map(parseRemoteNotification),
  };
}

export async function getRemoteNotifications(options: {
  category?: NotificationCategory;
  cursor?: string | null;
} = {}) {
  const query = new URLSearchParams({ size: '50' });
  if (options.category) query.set('category', REMOTE_CATEGORY[options.category]);
  if (options.cursor) query.set('cursor', options.cursor);

  return parseRemoteNotificationPage(
    await apiRequest<unknown>(`/notifications?${query.toString()}`),
  );
}

export async function markRemoteNotificationRead(notificationId: string) {
  readEnvelope(
    await apiRequest<unknown>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
    }),
    'NOTI_READ_200',
  );
}

export async function markAllRemoteNotificationsRead() {
  readEnvelope(
    await apiRequest<unknown>('/notifications/read-all', { method: 'PATCH' }),
    'NOTI_READ_ALL_200',
  );
}

export async function getRemoteUnreadNotificationCount() {
  const result = readRecord(
    readEnvelope(
      await apiRequest<unknown>('/notifications/unread-count'),
      'NOTI_UNREAD_200',
    ),
  );
  if (typeof result.count !== 'number' || !Number.isSafeInteger(result.count) || result.count < 0) {
    throw new NotificationApiContractError();
  }
  return result.count;
}
