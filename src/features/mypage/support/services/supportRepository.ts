import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiRequest } from '@/src/services/apiClient';
import { appendMultipartImage, appendMultipartJson } from '@/src/utils/file';

import { createEmptyInquiryDraft, normalizeStoredSupportState } from '../supportValidation';
import type { Inquiry, InquiryDraft, InquiryImage, InquiryType, Notice, StoredSupportState } from '../types';

const SUPPORT_STORAGE_PREFIX = 'paw:mypage-support:';

function storageKey(userId: string) {
  return `${SUPPORT_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

const REMOTE_INQUIRY_TYPES: Record<string, InquiryType> = {
  ACCOUNT: 'account',
  COMMUNITY: 'community',
  ETC: 'other',
  PAYMENT: 'billing',
  PET: 'pet',
};

const INQUIRY_TYPES: Record<InquiryType, string> = {
  account: 'ACCOUNT',
  billing: 'PAYMENT',
  community: 'COMMUNITY',
  other: 'ETC',
  pet: 'PET',
};

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid-support-response');
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('invalid-support-response');
  return value.trim();
}

function readDateTime(value: unknown) {
  const dateTime = readString(value);
  if (Number.isNaN(Date.parse(dateTime))) throw new Error('invalid-support-response');
  return dateTime;
}

function readEnvelope(value: unknown, expectedCode: string) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true || envelope.code !== expectedCode) {
    throw new Error('invalid-support-response');
  }
  return envelope.result;
}

function readImages(value: unknown): InquiryImage[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('invalid-support-response');
  }
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))].map((localUri) => ({
    assetId: localUri,
    localUri,
  }));
}

function readInquiry(value: unknown, userId: string): Inquiry {
  const inquiry = readRecord(value);
  const remoteType = readString(inquiry.inquiryType);
  const type = REMOTE_INQUIRY_TYPES[remoteType];
  const status = readString(inquiry.status);
  if (!type || !['RECEIVED', 'IN_PROGRESS', 'ANSWERED'].includes(status)) {
    throw new Error('invalid-support-response');
  }
  const answer = inquiry.answer;
  if (answer !== null && answer !== undefined && typeof answer !== 'string') {
    throw new Error('invalid-support-response');
  }

  return {
    answer: status === 'ANSWERED' ? readString(answer) : null,
    answeredAt: null,
    body: readString(inquiry.content),
    createdAt: readDateTime(inquiry.createdAt),
    id: String(inquiry.inquiryId),
    images: readImages(inquiry.attachmentUrls ?? []),
    status: status === 'ANSWERED' ? 'answered' : 'waiting',
    type,
    userId,
  };
}

function readNotice(value: unknown): Notice {
  const notice = readRecord(value);
  return {
    body: typeof notice.content === 'string' ? notice.content : '',
    createdAt: readDateTime(notice.createdAt),
    id: String(notice.noticeId),
    important: false,
    isNew: typeof notice.isNew === 'boolean' ? notice.isNew : false,
    title: readString(notice.title),
  };
}

function readPage(value: unknown, expectedCode: string) {
  const page = readRecord(readEnvelope(value, expectedCode));
  if (!Array.isArray(page.content)) throw new Error('invalid-support-response');
  if (
    typeof page.hasNext !== 'boolean' ||
    (page.nextCursor !== null && typeof page.nextCursor !== 'string') ||
    (page.hasNext && !page.nextCursor?.trim())
  ) {
    throw new Error('invalid-support-response');
  }
  return { content: page.content, hasNext: page.hasNext, nextCursor: page.nextCursor };
}

async function getAllPageContent(
  expectedCode: string,
  getPath: (cursor: string | null) => string,
  authenticated = true,
) {
  const content: unknown[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page = readPage(
      await apiRequest<unknown>(getPath(cursor), authenticated ? undefined : { authenticated: false }),
      expectedCode,
    );
    content.push(...page.content);
    if (!page.hasNext) return content;
    cursor = page.nextCursor;
    if (!cursor || cursors.has(cursor)) throw new Error('invalid-support-response');
    cursors.add(cursor);
  } while (cursor);

  return content;
}

export const supportRepository = {
  async deleteUser(userId: string) {
    await AsyncStorage.removeItem(storageKey(userId));
  },

  async getInquiry(inquiryId: string, userId: string) {
    return readInquiry(
      readEnvelope(
        await apiRequest<unknown>(`/mypage/inquiries/${encodeURIComponent(inquiryId)}`),
        'MYPAGE_INQUIRY_DETAIL_200',
      ),
      userId,
    );
  },

  async getInquiries(userId: string) {
    return getAllPageContent(
      'MYPAGE_INQUIRY_LIST_200',
      (cursor) => {
        const params = new URLSearchParams({ size: '50' });
        if (cursor) params.set('cursor', cursor);
        return `/mypage/inquiries?${params.toString()}`;
      },
    ).then((inquiries) =>
      inquiries
        .map((inquiry) => readInquiry(inquiry, userId))
        .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt)),
    );
  },

  async getNotice(noticeId: string) {
    return readNotice(
      readEnvelope(
        await apiRequest<unknown>(`/mypage/notices/${encodeURIComponent(noticeId)}`, {
          authenticated: false,
        }),
        'MYPAGE_NOTICE_DETAIL_200',
      ),
    );
  },

  async getNotices(keyword = '') {
    return getAllPageContent(
      'MYPAGE_NOTICE_LIST_200',
      (cursor) => {
        const params = new URLSearchParams({ size: '50' });
        if (cursor) params.set('cursor', cursor);
        if (keyword.trim()) params.set('keyword', keyword.trim());
        return `/mypage/notices?${params.toString()}`;
      },
      false,
    ).then((notices) => notices.map(readNotice));
  },

  async loadState(userId: string): Promise<StoredSupportState> {
    const fallback = { draft: createEmptyInquiryDraft(userId), inquiries: [] };
    const stored = await AsyncStorage.getItem(storageKey(userId));
    if (!stored) return fallback;

    try {
      return normalizeStoredSupportState(JSON.parse(stored) as unknown, userId, fallback);
    } catch {
      await AsyncStorage.removeItem(storageKey(userId)).catch(() => undefined);
      return fallback;
    }
  },

  async saveState(userId: string, state: StoredSupportState) {
    const normalized = normalizeStoredSupportState(
      state,
      userId,
      { draft: createEmptyInquiryDraft(userId), inquiries: [] },
    );
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(normalized));
  },

  async submitInquiry(draft: InquiryDraft, userId: string) {
    if (!draft.type) throw new Error('invalid-inquiry-draft');

    const formData = new FormData();
    appendMultipartJson(formData, {
      content: draft.body.trim(),
      inquiryType: INQUIRY_TYPES[draft.type],
    });
    draft.images.forEach(({ localUri }) => appendMultipartImage(formData, 'files', localUri));

    return readInquiry(
      readEnvelope(
        await apiRequest<unknown>('/mypage/inquiries', { body: formData, method: 'POST' }),
        'MYPAGE_INQUIRY_CREATE_200',
      ),
      userId,
    );
  },
};
