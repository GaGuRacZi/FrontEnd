import type {
  Inquiry,
  InquiryDraft,
  InquiryImage,
  InquiryType,
  StoredSupportState,
} from './types';

export const MAX_INQUIRY_BODY_LENGTH = 1000;
export const MAX_INQUIRY_IMAGES = 3;

export type SupportBadgeKind = 'answered' | 'important' | 'new' | 'waiting';

const SUPPORT_BADGE_LABELS: Record<SupportBadgeKind, string> = {
  answered: '답변 완료',
  important: '중요',
  new: 'NEW',
  waiting: '답변 대기',
};

export const INQUIRY_TYPE_OPTIONS: readonly { label: string; value: InquiryType }[] = [
  { label: '서비스 이용', value: 'service' },
  { label: '계정', value: 'account' },
  { label: '결제·구독', value: 'billing' },
  { label: '커뮤니티', value: 'community' },
  { label: '기타', value: 'other' },
];

const INQUIRY_TYPES = new Set<string>(INQUIRY_TYPE_OPTIONS.map(({ value }) => value));

export function createEmptyInquiryDraft(userId: string): InquiryDraft {
  return {
    body: '',
    images: [],
    type: null,
    updatedAt: new Date(0).toISOString(),
    userId,
  };
}

export function getInquiryTypeLabel(type: InquiryType) {
  return INQUIRY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? '기타';
}

export function getSupportBadgeLabel(kind: SupportBadgeKind) {
  return SUPPORT_BADGE_LABELS[kind];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isInquiryType(value: unknown): value is InquiryType {
  return typeof value === 'string' && INQUIRY_TYPES.has(value);
}

function normalizeImage(value: unknown): InquiryImage | null {
  if (!isRecord(value)) return null;
  if (typeof value.assetId !== 'string' || !value.assetId.trim()) return null;
  if (typeof value.localUri !== 'string' || !value.localUri.trim()) return null;
  return { assetId: value.assetId, localUri: value.localUri };
}

function normalizeImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    const image = normalizeImage(item);
    if (!image || seen.has(image.assetId)) return [];
    seen.add(image.assetId);
    return [image];
  }).slice(0, MAX_INQUIRY_IMAGES);
}

function normalizeInquiry(value: unknown, userId: string): Inquiry | null {
  if (!isRecord(value) || value.userId !== userId) return null;
  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    !isInquiryType(value.type) ||
    typeof value.body !== 'string' ||
    !value.body.trim() ||
    value.body.length > MAX_INQUIRY_BODY_LENGTH ||
    typeof value.createdAt !== 'string' ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    (value.status !== 'waiting' && value.status !== 'answered')
  ) {
    return null;
  }

  if (value.status === 'answered') {
    if (
      typeof value.answer !== 'string' ||
      !value.answer.trim() ||
      typeof value.answeredAt !== 'string' ||
      Number.isNaN(Date.parse(value.answeredAt))
    ) {
      return null;
    }
  }

  return {
    answer: value.status === 'answered' ? value.answer as string : null,
    answeredAt: value.status === 'answered' ? value.answeredAt as string : null,
    body: value.body,
    createdAt: value.createdAt,
    id: value.id,
    images: normalizeImages(value.images),
    status: value.status,
    type: value.type,
    userId,
  };
}

function normalizeDraft(value: unknown, userId: string): InquiryDraft {
  const empty = createEmptyInquiryDraft(userId);
  if (!isRecord(value) || value.userId !== userId) return empty;

  return {
    body: typeof value.body === 'string'
      ? value.body.slice(0, MAX_INQUIRY_BODY_LENGTH)
      : '',
    images: normalizeImages(value.images),
    type: value.type === null || isInquiryType(value.type) ? value.type : null,
    updatedAt:
      typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))
        ? value.updatedAt
        : empty.updatedAt,
    userId,
  };
}

export function normalizeStoredSupportState(
  value: unknown,
  userId: string,
  fallback: StoredSupportState,
): StoredSupportState {
  if (!isRecord(value) || !Array.isArray(value.inquiries)) return fallback;

  const seen = new Set<string>();
  const inquiries = value.inquiries.flatMap((item) => {
    const inquiry = normalizeInquiry(item, userId);
    if (!inquiry || seen.has(inquiry.id)) return [];
    seen.add(inquiry.id);
    return [inquiry];
  });

  return {
    draft: normalizeDraft(value.draft, userId),
    inquiries: inquiries.sort(
      (first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt),
    ),
  };
}

export function normalizeSupportSearch(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getInquiryImageAssetKey(image: InquiryImage) {
  return `${image.assetId}:${image.localUri}`;
}

export function getRetainedInquiryImageAssetKeys(state: StoredSupportState) {
  return new Set(
    [state.draft.images, ...state.inquiries.map(({ images }) => images)]
      .flat()
      .map(getInquiryImageAssetKey),
  );
}

export function getInquiryDraftError(draft: InquiryDraft) {
  if (!draft.type) return '문의 유형을 선택해주세요.';
  if (!draft.body.trim()) return '문의 내용을 입력해주세요.';
  if (draft.body.length > MAX_INQUIRY_BODY_LENGTH) {
    return `문의 내용은 최대 ${MAX_INQUIRY_BODY_LENGTH}자까지 입력할 수 있어요.`;
  }
  if (draft.images.length > MAX_INQUIRY_IMAGES) {
    return `사진은 최대 ${MAX_INQUIRY_IMAGES}장까지 첨부할 수 있어요.`;
  }
  return null;
}

export function createInquiryFromDraft(
  draft: InquiryDraft,
  id: string,
  createdAt: string,
  images: InquiryImage[],
): Inquiry {
  const error = getInquiryDraftError(draft);
  if (error || !draft.type) throw new Error(error ?? 'invalid-inquiry-draft');
  const normalizedImages = normalizeImages(images);

  return {
    answer: null,
    answeredAt: null,
    body: draft.body.trim(),
    createdAt,
    id,
    images: normalizedImages,
    status: 'waiting',
    type: draft.type,
    userId: draft.userId,
  };
}

export function formatSupportDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
