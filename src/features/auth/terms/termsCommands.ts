import type { ConsentStore } from './ConsentStore';
import type { TermsRepository } from './TermsRepository';
import type { ConsentRecord, TermDefinition, TermId } from './types';
import { TERM_IDS } from './types';

export function getLatestConsent(
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

type ChangeMarketingConsentOptions = {
  agreed: boolean;
  consentStore: ConsentStore;
  repository: TermsRepository;
  userId: string;
};

export async function changeMarketingConsent({
  agreed,
  consentStore,
  repository,
  userId,
}: ChangeMarketingConsentOptions) {
  const term = await repository.getTerm(TERM_IDS.marketing);

  if (!term) {
    throw new Error('마케팅 정보 수신 약관을 찾을 수 없습니다.');
  }

  return recordTermDecision({ agreed, consentStore, term, userId });
}
