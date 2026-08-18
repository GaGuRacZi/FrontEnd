export const TERM_IDS = {
  age: 'age-confirmation',
  communityPolicy: 'community-policy',
  location: 'location-service',
  marketing: 'marketing-communications',
  paidServicePolicy: 'paid-service-policy',
  privacy: 'privacy-collection',
  privacyPolicy: 'privacy-policy',
  profilePrivacy: 'profile-privacy-collection',
  recordingAi: 'recording-ai-consent',
  service: 'service-terms',
} as const;

export const REQUIRED_SIGNUP_TERM_IDS = [
  TERM_IDS.age,
  TERM_IDS.service,
  TERM_IDS.privacy,
  TERM_IDS.profilePrivacy,
] as const;

export type TermId = (typeof TERM_IDS)[keyof typeof TERM_IDS];
export type TermKind =
  | 'age'
  | 'communityPolicy'
  | 'location'
  | 'marketing'
  | 'paidServicePolicy'
  | 'privacy'
  | 'privacyPolicy'
  | 'profilePrivacy'
  | 'recordingAi'
  | 'service';
export type TermScope = 'location' | 'policy' | 'recording' | 'signup';
export type TermStatus = 'active' | 'draft';

export type TermDefinition = {
  body: string;
  effectiveDate: string;
  id: TermId;
  kind: TermKind;
  required: boolean;
  scope: TermScope;
  status: TermStatus;
  title: string;
  version: string;
};

export type ConsentRecord = {
  agreed: boolean;
  agreedAt: string | null;
  decidedAt: string;
  id: string;
  termId: TermId;
  termVersion: string;
  userId: string;
  withdrawnAt: string | null;
};

export type ConsentDecisionInput = {
  agreed: boolean;
  occurredAt?: string;
  termId: TermId;
  termVersion: string;
  userId: string;
};

export function isTermId(value: string): value is TermId {
  return Object.values(TERM_IDS).some((termId) => termId === value);
}

export function isValidConsentRecord(value: unknown, userId: string): value is ConsentRecord {
  if (!value || typeof value !== 'object') return false;

  const record = value as Partial<ConsentRecord>;
  if (
    typeof record.agreed !== 'boolean' ||
    typeof record.decidedAt !== 'string' ||
    Number.isNaN(Date.parse(record.decidedAt)) ||
    typeof record.id !== 'string' ||
    !record.id.trim() ||
    typeof record.termId !== 'string' ||
    !isTermId(record.termId) ||
    typeof record.termVersion !== 'string' ||
    !record.termVersion.trim() ||
    record.userId !== userId
  ) {
    return false;
  }

  if (record.agreed) {
    return (
      typeof record.agreedAt === 'string' &&
      !Number.isNaN(Date.parse(record.agreedAt)) &&
      record.withdrawnAt === null
    );
  }

  return (
    record.agreedAt === null &&
    (record.withdrawnAt === null ||
      (typeof record.withdrawnAt === 'string' && !Number.isNaN(Date.parse(record.withdrawnAt))))
  );
}

export function isConfirmationOnlyTerm(term: Pick<TermDefinition, 'id'>) {
  return term.id === TERM_IDS.age || term.id === TERM_IDS.profilePrivacy;
}

export function getTermLabel(term: TermDefinition) {
  if (term.scope === 'policy') return '안내 문서';
  if (term.id === TERM_IDS.age || term.id === TERM_IDS.profilePrivacy) return '필수 확인';
  if (term.id === TERM_IDS.location || term.scope === 'recording') return '기능 이용 동의';
  return term.required ? '필수 약관' : '선택 동의';
}

export function getTermDateLabel(term: TermDefinition) {
  return term.status === 'draft'
    ? `${term.version} · ${term.effectiveDate} 검토 기준`
    : `${term.version} · ${term.effectiveDate} 시행`;
}

export function formatTermDecisionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
