import { apiRequest } from '@/src/services/apiClient';

import { TERM_IDS, type TermDefinition, type TermId } from './types';

export interface TermsRepository {
  getTerm(termId: TermId): Promise<TermDefinition | null>;
  getTerms(): Promise<TermDefinition[]>;
}

const TERM_METADATA = {
  AGE_OVER_14: { id: TERM_IDS.age, kind: 'age', scope: 'signup' },
  LOCATION_SERVICE: { id: TERM_IDS.location, kind: 'location', scope: 'location' },
  MARKETING_PUSH: { id: TERM_IDS.marketing, kind: 'marketing', scope: 'signup' },
  PRIVACY: { id: TERM_IDS.privacy, kind: 'privacy', scope: 'signup' },
  PROFILE_EXTRA: { id: TERM_IDS.profilePrivacy, kind: 'profilePrivacy', scope: 'signup' },
  TERMS_OF_SERVICE: { id: TERM_IDS.service, kind: 'service', scope: 'signup' },
} as const satisfies Record<
  string,
  Pick<TermDefinition, 'id' | 'kind' | 'scope'>
>;

type RemoteTermsType = keyof typeof TERM_METADATA;

export type RemoteMyPageTerm = {
  agreed: boolean;
  id: TermId;
  version: string;
};

export class TermsApiContractError extends Error {
  constructor() {
    super('Invalid terms API response.');
    this.name = 'TermsApiContractError';
  }
}

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TermsApiContractError();
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new TermsApiContractError();
  return value.trim();
}

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function readEnvelope(value: unknown, expectedCode: string) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true || envelope.code !== expectedCode) {
    throw new TermsApiContractError();
  }
  return envelope.result;
}

function readRemoteTerm(value: unknown): TermDefinition {
  const term = readRecord(value);
  const type = readString(term.type);
  const metadata = TERM_METADATA[type as RemoteTermsType];
  const effectiveDate = readString(term.effectiveAt);

  if (
    !metadata ||
    typeof term.required !== 'boolean' ||
    !isDateOnly(effectiveDate)
  ) {
    throw new TermsApiContractError();
  }

  return {
    body: readString(term.content),
    effectiveDate,
    id: metadata.id,
    kind: metadata.kind,
    required: term.required,
    scope: metadata.scope,
    status: 'active',
    title: readString(term.title),
    version: readString(term.version),
  };
}

export function getTermIdFromRemoteType(value: string): TermId | null {
  return TERM_METADATA[value as RemoteTermsType]?.id ?? null;
}

function readRemoteTermSummary(value: unknown): TermDefinition {
  const term = readRecord(value);
  const type = readString(term.type);
  const metadata = TERM_METADATA[type as RemoteTermsType];
  const effectiveDate = readString(term.effectiveAt);

  if (!metadata || typeof term.required !== 'boolean' || !isDateOnly(effectiveDate)) {
    throw new TermsApiContractError();
  }

  return {
    body: '',
    effectiveDate,
    id: metadata.id,
    kind: metadata.kind,
    required: term.required,
    scope: metadata.scope,
    status: 'active',
    title: readString(term.title),
    version: readString(term.version),
  };
}

async function getRemoteTerm(type: RemoteTermsType) {
  const response = await apiRequest<unknown>(`/terms/${type}`, { authenticated: false });
  return readRemoteTerm(readEnvelope(response, 'TERMS_DETAIL_200'));
}

export function parseTermsListEnvelope(value: unknown) {
  const result = readEnvelope(value, 'TERMS_LIST_200');
  if (!Array.isArray(result)) throw new TermsApiContractError();

  return result.map((term) => {
    const type = readString(readRecord(term).type);
    if (!(type in TERM_METADATA)) throw new TermsApiContractError();
    return type as RemoteTermsType;
  });
}

export function parseTermsListDefinitionsEnvelope(value: unknown) {
  const result = readEnvelope(value, 'TERMS_LIST_200');
  if (!Array.isArray(result)) throw new TermsApiContractError();

  return result.map(readRemoteTermSummary);
}

export function parseTermDetailEnvelope(value: unknown) {
  return readRemoteTerm(readEnvelope(value, 'TERMS_DETAIL_200'));
}

export function parseMyPageTermsEnvelope(value: unknown): RemoteMyPageTerm[] {
  const result = readEnvelope(value, 'MYPAGE_TERMS_200');
  if (!Array.isArray(result)) throw new TermsApiContractError();

  return result.map((item) => {
    const term = readRecord(item);
    const id = getTermIdFromRemoteType(readString(term.type));
    if (!id || typeof term.agreed !== 'boolean') throw new TermsApiContractError();
    return { agreed: term.agreed, id, version: readString(term.version) };
  });
}

export async function getRemoteMyPageTerms() {
  return parseMyPageTermsEnvelope(await apiRequest<unknown>('/mypage/terms'));
}

export class RemoteTermsRepository implements TermsRepository {
  async getTerm(termId: TermId) {
    const entry = Object.entries(TERM_METADATA).find(([, metadata]) => metadata.id === termId);
    return entry ? getRemoteTerm(entry[0] as RemoteTermsType) : null;
  }

  async getTerms() {
    const response = await apiRequest<unknown>('/terms', { authenticated: false });
    return parseTermsListDefinitionsEnvelope(response);
  }
}

export const termsRepository: TermsRepository = new RemoteTermsRepository();
