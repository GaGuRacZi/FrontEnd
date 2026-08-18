const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export type KakaoSession = {
  accessToken: string;
  refreshToken: string;
  isNew: boolean;
  uid: string;
};

export type KakaoLinkChallenge = {
  linkToken: string;
  existingProvider: 'KAKAO' | 'LOCAL';
  email: string;
};

export type KakaoLoginOutcome =
  | { kind: 'authenticated'; session: KakaoSession }
  | { challenge: KakaoLinkChallenge; kind: 'link-required' };

export type KakaoOnboardingInput = {
  agreements: {
    AGE_OVER_14: boolean;
    LOCATION_SERVICE: boolean;
    MARKETING_PUSH: boolean;
    PRIVACY: boolean;
    PROFILE_EXTRA: boolean;
    TERMS_OF_SERVICE: boolean;
  };
  intro?: string | null;
  location: {
    latitude: number;
    longitude: number;
  };
  name: string;
  nickname: string;
};

export type KakaoOnboardingRequest = KakaoOnboardingInput & { intro: string | null };

export type RemoteUserProfile = {
  email: string;
  intro: string;
  isNew: boolean;
  name: string;
  nickname: string;
  profileUrl: string | null;
  regionName: string;
  uid: string;
};

export type RemoteUserIdentity = Pick<RemoteUserProfile, 'isNew' | 'uid'>;

const LOGIN_SESSION_CODES = new Set([
  'KAKAO_LOGIN_200_1',
  'KAKAO_LOGIN_200_2',
  'LOGIN_LINK_200',
  'LOCAL_LOGIN_200_1',
  'LOCAL_LOGIN_200_2',
  'LOCAL_SIGNUP_200_1',
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICKNAME_PATTERN = /^[A-Za-z0-9\uAC00-\uD7A3]+$/;

export class KakaoAuthContractError extends Error {
  constructor() {
    super('Invalid Kakao authentication response.');
    this.name = 'KakaoAuthContractError';
  }
}

export class KakaoAuthResponseError extends Error {
  readonly code: string;

  constructor(code: string) {
    super('Kakao authentication request was rejected.');
    this.name = 'KakaoAuthResponseError';
    this.code = code;
  }
}

function readRecord(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new KakaoAuthContractError();
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new KakaoAuthContractError();
  }

  return value;
}

function readEnvelope(value: unknown) {
  const envelope = readRecord(value);

  if (typeof envelope.isSuccess !== 'boolean' || typeof envelope.message !== 'string') {
    throw new KakaoAuthContractError();
  }

  const code = readString(envelope.code);

  if (!envelope.isSuccess) {
    throw new KakaoAuthResponseError(code);
  }

  return { code, result: envelope.result };
}

function readUuid(value: unknown) {
  const uuid = readString(value);

  if (!isUuid(uuid)) {
    throw new KakaoAuthContractError();
  }

  return uuid;
}

function readSession(value: unknown): KakaoSession {
  const session = readRecord(value);

  if (typeof session.isNew !== 'boolean') {
    throw new KakaoAuthContractError();
  }

  return {
    accessToken: readString(session.accessToken),
    refreshToken: readString(session.refreshToken),
    isNew: session.isNew,
    uid: readUuid(session.uid),
  };
}

function readProfileString(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new KakaoAuthContractError();
  return value.trim();
}

function readProfileIsNew(profile: Record<string, unknown>) {
  const isNew = profile.isNew;
  const legacyIsNew = profile.new;

  if (
    typeof isNew === 'boolean' &&
    typeof legacyIsNew === 'boolean' &&
    isNew !== legacyIsNew
  ) {
    throw new KakaoAuthContractError();
  }

  if (typeof isNew === 'boolean') return isNew;
  if (typeof legacyIsNew === 'boolean') return legacyIsNew;
  throw new KakaoAuthContractError();
}

function readChallenge(value: unknown): KakaoLinkChallenge {
  const challenge = readRecord(value);
  const existingProvider = readString(challenge.existingProvider);
  const email = readString(challenge.email);

  if (
    (existingProvider !== 'KAKAO' && existingProvider !== 'LOCAL') ||
    !EMAIL_PATTERN.test(email)
  ) {
    throw new KakaoAuthContractError();
  }

  return {
    email,
    existingProvider,
    linkToken: readUuid(challenge.linkToken),
  };
}

export function parseKakaoLoginEnvelope(value: unknown): KakaoLoginOutcome {
  const envelope = readEnvelope(value);

  if (LOGIN_SESSION_CODES.has(envelope.code)) {
    return { kind: 'authenticated', session: readSession(envelope.result) };
  }

  if (envelope.code === 'LOGIN_LINK_201') {
    return { challenge: readChallenge(envelope.result), kind: 'link-required' };
  }

  throw new KakaoAuthContractError();
}

export function parseKakaoSessionEnvelope(value: unknown) {
  const outcome = parseKakaoLoginEnvelope(value);

  if (outcome.kind !== 'authenticated') {
    throw new KakaoAuthContractError();
  }

  return outcome.session;
}

export function assertSuccessfulKakaoEnvelope(value: unknown) {
  const { code } = readEnvelope(value);

  if (code !== 'ONBOARDING_200') {
    throw new KakaoAuthContractError();
  }
}

export function assertSuccessfulEmailEnvelope(value: unknown, expectedCode: string) {
  const { code, result } = readEnvelope(value);

  if (code !== expectedCode || result !== null) {
    throw new KakaoAuthContractError();
  }
}

export function assertSuccessfulLogoutEnvelope(value: unknown) {
  const { code } = readEnvelope(value);

  if (code !== 'LOGOUT_200') {
    throw new KakaoAuthContractError();
  }
}

export function parseRemoteUserProfileEnvelope(
  value: unknown,
  expectedCode?: string,
): RemoteUserProfile {
  const { code, result } = readEnvelope(value);
  if (expectedCode && code !== expectedCode) throw new KakaoAuthContractError();
  const profile = readRecord(result);
  const profileUrl = profile.profileUrl;

  if (profileUrl !== null && profileUrl !== undefined && typeof profileUrl !== 'string') {
    throw new KakaoAuthContractError();
  }

  const uid = readUuid(profile.uid);
  const name = readProfileString(profile.name);
  const nickname = readProfileString(profile.nickname);
  const isNew = readProfileIsNew(profile);

  if (!name || !nickname) {
    throw new KakaoAuthContractError();
  }

  return {
    email: readProfileString(profile.email).toLowerCase(),
    intro: readProfileString(profile.intro),
    isNew,
    name,
    nickname,
    profileUrl: profileUrl?.trim() || null,
    regionName: readProfileString(profile.regionName),
    uid,
  };
}

export function parseRemoteUserIdentityEnvelope(value: unknown): RemoteUserIdentity {
  const { code, result } = readEnvelope(value);
  if (code !== 'USER_PROFILE_200') throw new KakaoAuthContractError();
  const profile = readRecord(result);

  return { isNew: readProfileIsNew(profile), uid: readUuid(profile.uid) };
}

export function normalizeKakaoOnboardingInput(
  input: KakaoOnboardingInput,
): KakaoOnboardingRequest {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const nickname = typeof input.nickname === 'string' ? input.nickname.trim() : '';
  const intro = typeof input.intro === 'string' ? input.intro.trim() || null : null;
  const { latitude, longitude } = input.location ?? {};
  const agreements = input.agreements ?? ({} as KakaoOnboardingInput['agreements']);

  if (
    !name ||
    name.length > 10 ||
    !nickname ||
    nickname.length > 15 ||
    !NICKNAME_PATTERN.test(nickname) ||
    (intro?.length ?? 0) > 30 ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof agreements.AGE_OVER_14 !== 'boolean' ||
    typeof agreements.TERMS_OF_SERVICE !== 'boolean' ||
    typeof agreements.PRIVACY !== 'boolean' ||
    typeof agreements.PROFILE_EXTRA !== 'boolean' ||
    typeof agreements.MARKETING_PUSH !== 'boolean' ||
    typeof agreements.LOCATION_SERVICE !== 'boolean' ||
    !agreements.AGE_OVER_14 ||
    !agreements.TERMS_OF_SERVICE ||
    !agreements.PRIVACY ||
    !agreements.PROFILE_EXTRA
  ) {
    throw new KakaoAuthContractError();
  }

  return {
    agreements: {
      AGE_OVER_14: agreements.AGE_OVER_14,
      LOCATION_SERVICE: agreements.LOCATION_SERVICE,
      MARKETING_PUSH: agreements.MARKETING_PUSH,
      PRIVACY: agreements.PRIVACY,
      PROFILE_EXTRA: agreements.PROFILE_EXTRA,
      TERMS_OF_SERVICE: agreements.TERMS_OF_SERVICE,
    },
    intro,
    location: { latitude, longitude },
    name,
    nickname,
  };
}
