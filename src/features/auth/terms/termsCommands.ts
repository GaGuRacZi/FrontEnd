import type { ConsentStore } from './ConsentStore';
import type { ConsentRecord, TermDefinition, TermId } from './types';
import { REQUIRED_SIGNUP_TERM_IDS } from './types';

function getLatestConsent(
  history: readonly ConsentRecord[],
  termId: TermId,
  termVersion?: string,
) {
  return [...history]
    .reverse()
    .find(
      (record) =>
        record.termId === termId &&
        (termVersion === undefined || record.termVersion === termVersion),
    );
}

export function hasCurrentTermConsent(
  history: readonly ConsentRecord[],
  term: TermDefinition,
) {
  return getLatestConsent(history, term.id, term.version)?.agreed === true;
}

export function hasCurrentRequiredSignupConsents(
  history: readonly ConsentRecord[],
  terms: readonly TermDefinition[],
) {
  const requiredTerms = terms.filter(
    (term) => term.required && term.scope === 'signup',
  );
  const hasRequiredDefinitions = REQUIRED_SIGNUP_TERM_IDS.every((termId) =>
    requiredTerms.some((term) => term.id === termId),
  );
  return (
    hasRequiredDefinitions &&
    requiredTerms.every((term) => hasCurrentTermConsent(history, term))
  );
}

type RecordTermDecisionOptions = {
  agreed: boolean;
  consentStore: ConsentStore;
  occurredAt?: string;
  term: TermDefinition;
  userId: string;
};

export async function recordTermDecision({
  agreed,
  consentStore,
  occurredAt,
  term,
  userId,
}: RecordTermDecisionOptions) {
  return consentStore.recordDecision({
    agreed,
    occurredAt,
    termId: term.id,
    termVersion: term.version,
    userId,
  });
}
