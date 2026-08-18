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

const termsRepository = readFileSync(
  new URL('../src/features/auth/terms/TermsRepository.ts', import.meta.url),
  'utf8',
);

assert.match(
  termsRepository,
  /apiRequest<unknown>\('\/terms', \{ authenticated: false \}\)/,
);
assert.match(
  termsRepository,
  /apiRequest<unknown>\(`\/terms\/\$\{type\}`, \{ authenticated: false \}\)/,
);
assert.match(termsRepository, /TERMS_LIST_200/);
assert.match(termsRepository, /TERMS_DETAIL_200/);
