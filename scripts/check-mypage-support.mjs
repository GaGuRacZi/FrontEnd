import assert from 'node:assert/strict';

import {
  createEmptyInquiryDraft,
  createInquiryFromDraft,
  getInquiryImageAssetKey,
  getInquiryDraftError,
  getRetainedInquiryImageAssetKeys,
  getSupportBadgeLabel,
  normalizeStoredSupportState,
  normalizeSupportSearch,
} from '../src/features/mypage/support/supportValidation.ts';

const userId = 'user-support-check';
const validInquiry = {
  answer: null,
  answeredAt: null,
  body: '문의 내용',
  createdAt: '2026-08-14T09:00:00+09:00',
  id: 'inquiry-valid',
  images: [],
  status: 'waiting',
  type: 'pet',
  userId,
};
const fallback = { draft: createEmptyInquiryDraft(userId), inquiries: [] };
const normalized = normalizeStoredSupportState(
  {
    draft: {
      body: 'a'.repeat(1002),
      images: [
        { assetId: 'image-1', localUri: 'file:///draft/1.jpg' },
        { assetId: 'image-1', localUri: 'file:///draft/duplicate.jpg' },
        { assetId: 'image-2', localUri: 'file:///draft/2.jpg' },
        { assetId: 'image-3', localUri: 'file:///draft/3.jpg' },
        { assetId: 'image-4', localUri: 'file:///draft/4.jpg' },
      ],
      type: 'pet',
      updatedAt: '2026-08-14T09:00:00+09:00',
      userId,
    },
    inquiries: [
      validInquiry,
      validInquiry,
      { ...validInquiry, id: 'other-inquiry', userId: 'another-user' },
    ],
  },
  userId,
  fallback,
);

assert.equal(normalized.draft.body.length, 1000);
assert.equal(normalized.draft.images.length, 3);
assert.equal(normalized.inquiries.length, 1);
assert.equal(normalizeSupportSearch('  결제   문의  '), '결제 문의');
assert.equal(getSupportBadgeLabel('waiting'), '답변 대기');
assert.equal(getSupportBadgeLabel('answered'), '답변 완료');

const offsetNormalized = normalizeStoredSupportState(
  {
    draft: createEmptyInquiryDraft(userId),
    inquiries: [
      { ...validInquiry, createdAt: '2026-08-11T01:00:00+09:00', id: 'offset-older' },
      { ...validInquiry, createdAt: '2026-08-10T23:30:00Z', id: 'offset-newer' },
    ],
  },
  userId,
  fallback,
);
assert.deepEqual(
  offsetNormalized.inquiries.map(({ id }) => id),
  ['offset-newer', 'offset-older'],
);

const draftImage = { assetId: 'shared-id', localUri: 'file:///draft/shared.jpg' };
const committedImage = { assetId: 'shared-id', localUri: 'file:///inquiries/shared.jpg' };
const retainedImageKeys = getRetainedInquiryImageAssetKeys({
  draft: { ...createEmptyInquiryDraft(userId), images: [draftImage] },
  inquiries: [{ ...validInquiry, images: [committedImage] }],
});
assert.notEqual(getInquiryImageAssetKey(draftImage), getInquiryImageAssetKey(committedImage));
assert.equal(retainedImageKeys.has(getInquiryImageAssetKey(draftImage)), true);
assert.equal(retainedImageKeys.has(getInquiryImageAssetKey(committedImage)), true);
assert.equal(
  retainedImageKeys.has(getInquiryImageAssetKey({ assetId: 'removed', localUri: 'file:///removed' })),
  false,
);

const emptyDraft = createEmptyInquiryDraft(userId);
assert.equal(getInquiryDraftError(emptyDraft), '문의 유형을 선택해주세요.');
assert.equal(
  getInquiryDraftError({ ...emptyDraft, type: 'pet' }),
  '문의 내용을 입력해주세요.',
);

const validDraft = {
  ...emptyDraft,
  body: '  문의 내용입니다.  ',
  type: 'pet',
};
const inquiry = createInquiryFromDraft(
  validDraft,
  'inquiry-check',
  '2026-08-14T10:00:00+09:00',
  [],
);
assert.equal(inquiry.body, '문의 내용입니다.');
assert.equal(inquiry.status, 'waiting');
assert.equal(inquiry.answer, null);
assert.throws(
  () => createInquiryFromDraft(emptyDraft, 'invalid', new Date().toISOString(), []),
  /문의 유형/,
);
