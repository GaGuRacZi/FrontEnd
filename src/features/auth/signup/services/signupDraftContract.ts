export type SignupDraftMethod = 'kakao' | 'local';

export type PersistedSignupData = {
  birthDate: string;
  breed: string;
  email: string;
  introduction: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  neutered: boolean | null;
  nickname: string;
  petGender: 'female' | 'male' | null;
  petName: string;
  petType: 'cat' | 'dog' | null;
  profileImageUri: string | null;
  region: string;
  regionSource: 'current' | 'search' | null;
  weight: string;
};

export type StoredSignupDraft = {
  data: PersistedSignupData;
  method: SignupDraftMethod;
  remoteUserId: string | null;
  savedAt: string;
  schemaVersion: 1;
  sessionId: string;
};

type SignupDraftSource = PersistedSignupData & {
  emailVerificationCode?: string;
  emailVerificationId?: string | null;
  emailVerificationToken?: string | null;
  password?: string;
  passwordConfirm?: string;
};

const SIGNUP_DRAFT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SIGNUP_DRAFT_DATA_KEYS = [
  'birthDate',
  'breed',
  'email',
  'introduction',
  'latitude',
  'longitude',
  'name',
  'neutered',
  'nickname',
  'petGender',
  'petName',
  'petType',
  'profileImageUri',
  'region',
  'regionSource',
  'weight',
] as const;
const SIGNUP_DRAFT_KEYS = [
  'data',
  'method',
  'remoteUserId',
  'savedAt',
  'schemaVersion',
  'sessionId',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const valueKeys = Object.keys(value);
  return valueKeys.length === keys.length && valueKeys.every((key) => keys.includes(key));
}

function isNullableFiniteNumber(value: unknown) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isPersistedSignupData(value: unknown): value is PersistedSignupData {
  if (!isRecord(value) || !hasExactKeys(value, SIGNUP_DRAFT_DATA_KEYS)) return false;

  return (
    typeof value.birthDate === 'string' &&
    typeof value.breed === 'string' &&
    typeof value.email === 'string' &&
    typeof value.introduction === 'string' &&
    isNullableFiniteNumber(value.latitude) &&
    isNullableFiniteNumber(value.longitude) &&
    typeof value.name === 'string' &&
    (value.neutered === null || typeof value.neutered === 'boolean') &&
    typeof value.nickname === 'string' &&
    (value.petGender === null || value.petGender === 'female' || value.petGender === 'male') &&
    typeof value.petName === 'string' &&
    (value.petType === null || value.petType === 'cat' || value.petType === 'dog') &&
    (value.profileImageUri === null || typeof value.profileImageUri === 'string') &&
    typeof value.region === 'string' &&
    (value.regionSource === null ||
      value.regionSource === 'current' ||
      value.regionSource === 'search') &&
    typeof value.weight === 'string'
  );
}

function isStoredSignupDraft(value: unknown): value is StoredSignupDraft {
  if (!isRecord(value) || !hasExactKeys(value, SIGNUP_DRAFT_KEYS)) return false;

  return (
    value.schemaVersion === 1 &&
    typeof value.savedAt === 'string' &&
    Number.isFinite(Date.parse(value.savedAt)) &&
    typeof value.sessionId === 'string' &&
    Boolean(value.sessionId.trim()) &&
    value.sessionId === value.sessionId.trim() &&
    (value.method === 'kakao' || value.method === 'local') &&
    (value.remoteUserId === null ||
      (typeof value.remoteUserId === 'string' && Boolean(value.remoteUserId.trim()))) &&
    (value.method === 'kakao' ? value.remoteUserId !== null : value.remoteUserId === null) &&
    isPersistedSignupData(value.data)
  );
}

export function createSignupDraft(input: {
  data: SignupDraftSource;
  method: SignupDraftMethod;
  remoteUserId: string | null;
  savedAt?: string;
  sessionId: string;
}): StoredSignupDraft {
  const { data } = input;
  const draft: StoredSignupDraft = {
    data: {
      birthDate: data.birthDate,
      breed: data.breed,
      email: data.email,
      introduction: data.introduction,
      latitude: data.latitude,
      longitude: data.longitude,
      name: data.name,
      neutered: data.neutered,
      nickname: data.nickname,
      petGender: data.petGender,
      petName: data.petName,
      petType: data.petType,
      profileImageUri: data.profileImageUri,
      region: data.region,
      regionSource: data.regionSource,
      weight: data.weight,
    },
    method: input.method,
    remoteUserId: input.remoteUserId,
    savedAt: input.savedAt ?? new Date().toISOString(),
    schemaVersion: 1,
    sessionId: input.sessionId,
  };

  if (!isStoredSignupDraft(draft)) throw new Error('invalid-signup-draft');
  return draft;
}

export function isCurrentSignupDraft(draft: StoredSignupDraft, now = Date.now()) {
  const savedAt = Date.parse(draft.savedAt);
  return savedAt <= now + 60_000 && savedAt >= now - SIGNUP_DRAFT_RETENTION_MS;
}

export function parseStoredSignupDraft(value: string | null) {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return isStoredSignupDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
