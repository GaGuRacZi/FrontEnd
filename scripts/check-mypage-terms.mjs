import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  formatTermDecisionDate,
  isValidConsentRecord,
  TERM_IDS,
} from '../src/features/auth/terms/types.ts';

const localBoundary = '2026-08-13T15:30:00.000Z';

assert.equal(formatTermDecisionDate(localBoundary), '2026.08.14');
assert.equal(formatTermDecisionDate('invalid'), '');

const decisionAt = '2026-08-15T09:00:00.000Z';
const consentRecord = {
  agreed: true,
  agreedAt: decisionAt,
  decidedAt: decisionAt,
  id: 'consent-1',
  termId: TERM_IDS.marketing,
  termVersion: '1.0.0',
  userId: 'user-1',
  withdrawnAt: null,
};

assert.equal(isValidConsentRecord(consentRecord, 'user-1'), true);
assert.equal(isValidConsentRecord(consentRecord, 'user-2'), false);
assert.equal(isValidConsentRecord({ ...consentRecord, decidedAt: 'invalid' }, 'user-1'), false);
assert.equal(isValidConsentRecord({ ...consentRecord, agreedAt: null }, 'user-1'), false);

const legalDocuments = readFileSync(
  new URL('../src/features/auth/terms/legalDocuments.ts', import.meta.url),
  'utf8',
);

assert.match(
  legalDocuments,
  /activeTermMeta\('1\.2\.0', '2026-08-15'\)[\s\S]*?id: TERM_IDS\.service,[\s\S]*?title: '서비스 이용약관'/,
);
assert.match(
  legalDocuments,
  /activeTermMeta\('1\.1\.0', '2026-08-15'\)[\s\S]*?id: TERM_IDS\.privacy,[\s\S]*?title: '개인정보 수집·이용 동의'/,
);
assert.match(legalDocuments, /카카오 신규 가입 지역 확인: 선택한 지역의 위도·경도/);
