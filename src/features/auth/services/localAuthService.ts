import { ApiError, apiRequest, type ApiRequestOptions } from '@/src/services/apiClient';

import {
  KakaoAuthContractError,
  KakaoAuthResponseError,
  parseKakaoLoginEnvelope,
  type KakaoLoginOutcome,
} from './kakaoAuthContract';

export type LocalAuthErrorKind =
  | 'conflict'
  | 'email-not-verified'
  | 'invalid-credentials'
  | 'invalid-response'
  | 'network'
  | 'service-unavailable';

export class LocalAuthError extends Error {
  constructor(
    readonly kind: LocalAuthErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'LocalAuthError';
  }
}

const LOCAL_AUTH_TIMEOUT_MS = 15000;

function requireNonBlank(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new LocalAuthError('invalid-response', '입력한 정보를 확인해주세요.');
  }

  return normalized;
}

function requirePassword(value: string) {
  if (!value.trim()) {
    throw new LocalAuthError('invalid-response', '입력한 정보를 확인해주세요.');
  }

  return value;
}

function getResponseCode(error: unknown) {
  if (error instanceof KakaoAuthResponseError) return error.code;
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== 'object') {
    return undefined;
  }

  const code = 'code' in error.data ? error.data.code : undefined;
  return typeof code === 'string' ? code : undefined;
}

function toLocalAuthError(error: unknown, phase: 'login' | 'signup') {
  if (error instanceof LocalAuthError) return error;

  const code = getResponseCode(error);
  const status = error instanceof ApiError ? error.status : undefined;

  if (phase === 'login' && (code === 'LOCAL_LOGIN_401_2' || status === 401)) {
    return new LocalAuthError('invalid-credentials', '이메일 또는 비밀번호가 일치하지 않아요.');
  }

  if (phase === 'signup' && code === 'EMAIL_NOT_VERIFIED') {
    return new LocalAuthError('email-not-verified', '이메일 인증을 완료해주세요.');
  }

  if (code === 'LOCAL_SIGNUP_409_1' || status === 409) {
    return new LocalAuthError('conflict', '이미 가입된 이메일이에요. 로그인해주세요.');
  }

  if (error instanceof KakaoAuthContractError) {
    return new LocalAuthError('invalid-response', '로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  if (error instanceof ApiError && status === undefined) {
    return new LocalAuthError('network', '네트워크 연결을 확인해 주세요.');
  }

  return new LocalAuthError(
    'service-unavailable',
    phase === 'signup'
      ? '회원가입을 시작하지 못했어요. 잠시 후 다시 시도해주세요.'
      : '로그인하지 못했어요. 잠시 후 다시 시도해주세요.',
  );
}

async function requestLocalAuth(path: string, options: ApiRequestOptions) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOCAL_AUTH_TIMEOUT_MS);

  try {
    return await apiRequest<unknown>(path, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function signInWithLocalCredentials(
  email: string,
  password: string,
): Promise<KakaoLoginOutcome> {
  try {
    const response = await requestLocalAuth('/auth/login/local', {
      authenticated: false,
      json: {
        email: requireNonBlank(email).toLowerCase(),
        password: requirePassword(password),
      },
      method: 'POST',
    });

    return parseKakaoLoginEnvelope(response);
  } catch (error) {
    throw toLocalAuthError(error, 'login');
  }
}

export async function signUpWithLocalCredentials(
  email: string,
  password: string,
): Promise<KakaoLoginOutcome> {
  try {
    const response = await requestLocalAuth('/auth/signup/local', {
      authenticated: false,
      json: {
        email: requireNonBlank(email).toLowerCase(),
        password: requirePassword(password),
      },
      method: 'POST',
    });

    return parseKakaoLoginEnvelope(response);
  } catch (error) {
    throw toLocalAuthError(error, 'signup');
  }
}
