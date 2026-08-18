import { login, logout } from '@react-native-seoul/kakao-login';

import {
  ApiError,
  apiRequest,
  type ApiRequestOptions,
  withTokenRefreshPaused,
} from '@/src/services/apiClient';
import { getTokens } from '@/src/services/tokenStorage';
import { getMultipartImageFile } from '@/src/utils/file';

import {
  assertSuccessfulKakaoEnvelope,
  assertSuccessfulLogoutEnvelope,
  KakaoAuthContractError,
  KakaoAuthResponseError,
  type KakaoLoginOutcome,
  type KakaoOnboardingInput,
  normalizeKakaoOnboardingInput,
  parseKakaoLoginEnvelope,
  parseRemoteUserIdentityEnvelope,
  parseRemoteUserProfileEnvelope,
  parseKakaoSessionEnvelope,
} from './kakaoAuthContract';

export type KakaoAuthErrorKind =
  | 'cancelled'
  | 'conflict'
  | 'invalid-kakao-token'
  | 'invalid-nickname'
  | 'invalid-password'
  | 'invalid-response'
  | 'network'
  | 'service-unavailable';

export class KakaoAuthError extends Error {
  constructor(
    readonly kind: KakaoAuthErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'KakaoAuthError';
  }
}

const KAKAO_AUTH_TIMEOUT_MS = 15000;

async function kakaoApiRequest<T>(path: string, options?: ApiRequestOptions) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), KAKAO_AUTH_TIMEOUT_MS);

  try {
    return await apiRequest<T>(path, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function getErrorText(error: unknown) {
  if (typeof error === 'string') return error;
  if (typeof error !== 'object' || error === null) return '';

  const record = error as Record<string, unknown>;

  return [record.code, record.name, record.message]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

export function isKakaoLoginCancelled(error: unknown) {
  return /E_CANCELLED_OPERATION|\bcancel(?:led|ed)\b/i.test(getErrorText(error));
}

function getResponseCode(error: unknown) {
  if (error instanceof KakaoAuthResponseError) return error.code;
  if (!(error instanceof ApiError)) return undefined;

  const data = error.data;

  if (typeof data !== 'object' || data === null) return undefined;

  const code = 'code' in data ? data.code : undefined;
  return typeof code === 'string' ? code : undefined;
}

function toKakaoAuthError(
  error: unknown,
  phase: 'confirm-kakao' | 'confirm-local' | 'login' | 'logout' | 'onboarding',
) {
  if (error instanceof KakaoAuthError) return error;

  const code = getResponseCode(error);
  const status = error instanceof ApiError ? error.status : undefined;

  if (phase === 'confirm-local' && (status === 401 || code === 'LOCAL_LOGIN_401_2')) {
    return new KakaoAuthError('invalid-password', '비밀번호가 올바르지 않아요.');
  }

  if (
    (phase === 'confirm-local' || phase === 'confirm-kakao') &&
    code === 'LOGIN_LINK_400'
  ) {
    return new KakaoAuthError(
      'service-unavailable',
      '계정 연결 시간이 만료됐어요. 카카오 로그인을 다시 시도해 주세요.',
    );
  }

  if (
    code === 'KAKAO_LOGIN_401' ||
    ((phase === 'login' || phase === 'confirm-kakao') && status === 401)
  ) {
    return new KakaoAuthError(
      'invalid-kakao-token',
      '카카오 로그인 정보가 만료됐어요. 다시 시도해 주세요.',
    );
  }

  if (['JWT_403_2', 'REFRESH_401', 'REFRESH_INVALID', 'USER_404_1'].includes(code ?? '')) {
    return new KakaoAuthError(
      'invalid-kakao-token',
      '로그인 정보가 유효하지 않아요. 다시 로그인해주세요.',
    );
  }

  if (phase === 'onboarding' && code === 'NICKNAME_409') {
    return new KakaoAuthError(
      'invalid-nickname',
      '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요.',
    );
  }

  if (phase === 'onboarding' && code === 'NICKNAME_400') {
    return new KakaoAuthError(
      'invalid-nickname',
      '닉네임은 15자 이내의 한글, 영문, 숫자만 사용할 수 있어요.',
    );
  }

  if (
    code === 'LOGIN_LINK_400_3' ||
    code === 'LOCAL_SIGNUP_409_1' ||
    status === 409
  ) {
    return new KakaoAuthError('conflict', '이미 다른 계정에 연결된 카카오 계정이에요.');
  }

  if (error instanceof ApiError && status === undefined) {
    return new KakaoAuthError('network', '네트워크 연결을 확인해 주세요.');
  }

  if (code === 'KAKAO_502_1' || (status !== undefined && status >= 500)) {
    return new KakaoAuthError(
      'service-unavailable',
      '카카오 로그인에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요.',
    );
  }

  if (error instanceof KakaoAuthContractError) {
    return new KakaoAuthError(
      'invalid-response',
      '로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
  }

  return new KakaoAuthError(
    'service-unavailable',
    phase === 'onboarding'
      ? '회원 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
      : phase === 'logout'
        ? '로그아웃을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'
      : '카카오 로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
  );
}

function requireNonBlank(value: unknown) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    throw new KakaoAuthContractError();
  }

  return value;
}

function requirePassword(value: unknown) {
  if (typeof value !== 'string' || !value) {
    throw new KakaoAuthContractError();
  }

  return value;
}

function createImageFormData(uri: string, fieldName: string) {
  const formData = new FormData();
  formData.append(
    fieldName,
    getMultipartImageFile(requireNonBlank(uri)) as unknown as Blob,
  );
  return formData;
}

export async function exchangeKakaoAccessToken(accessToken: string): Promise<KakaoLoginOutcome> {
  try {
    const token = requireNonBlank(accessToken);
    const response = await kakaoApiRequest<unknown>('/auth/login/kakao', {
      authenticated: false,
      json: { accessToken: token },
      method: 'POST',
    });

    return parseKakaoLoginEnvelope(response);
  } catch (error) {
    throw toKakaoAuthError(error, 'login');
  }
}

export async function startKakaoLogin() {
  return exchangeKakaoAccessToken(await getKakaoAccessToken());
}

export async function getKakaoAccessToken() {
  let accessToken: string;

  try {
    const token = await login();
    accessToken = requireNonBlank(token.accessToken);
  } catch (error) {
    if (isKakaoLoginCancelled(error)) {
      throw new KakaoAuthError('cancelled', '카카오 로그인이 취소됐어요.');
    }

    throw toKakaoAuthError(error, 'login');
  }

  return accessToken;
}

export async function confirmKakaoLinkWithLocalPassword(linkToken: string, password: string) {
  try {
    const response = await kakaoApiRequest<unknown>('/auth/link/confirm/local', {
      authenticated: false,
      json: {
        linkToken: requireNonBlank(linkToken),
        password: requirePassword(password),
      },
      method: 'POST',
    });

    return parseKakaoSessionEnvelope(response);
  } catch (error) {
    throw toKakaoAuthError(error, 'confirm-local');
  }
}

export async function confirmKakaoLinkWithKakaoAccessToken(
  linkToken: string,
  accessToken: string,
) {
  try {
    const response = await kakaoApiRequest<unknown>('/auth/link/confirm/kakao', {
      authenticated: false,
      json: {
        accessToken: requireNonBlank(accessToken),
        linkToken: requireNonBlank(linkToken),
      },
      method: 'POST',
    });

    return parseKakaoSessionEnvelope(response);
  } catch (error) {
    throw toKakaoAuthError(error, 'confirm-kakao');
  }
}

export async function completeKakaoOnboarding(input: KakaoOnboardingInput) {
  const request = normalizeKakaoOnboardingInput(input);

  try {
    const response = await kakaoApiRequest<unknown>('/auth/onboarding', {
      json: request,
      method: 'POST',
    });

    assertSuccessfulKakaoEnvelope(response);
  } catch (error) {
    if (['NICKNAME_400', 'NICKNAME_409'].includes(getResponseCode(error) ?? '')) {
      throw toKakaoAuthError(error, 'onboarding');
    }

    const status = error instanceof ApiError ? error.status : undefined;
    if (status !== undefined && status < 500) {
      throw toKakaoAuthError(error, 'onboarding');
    }

    const profile = await loadRemoteUserProfile().catch(() => null);
    if (
      profile &&
      !profile.isNew &&
      profile.name === request.name &&
      profile.nickname === request.nickname &&
      profile.intro === (request.intro ?? '')
    ) {
      return;
    }

    throw toKakaoAuthError(error, 'onboarding');
  }
}

export async function uploadRemoteProfileImage(uri: string) {
  try {
    const response = await kakaoApiRequest<unknown>('/auth/profile-image', {
      body: createImageFormData(uri, 'image'),
      method: 'POST',
    });
    return parseRemoteUserProfileEnvelope(response, 'PROFILE_IMAGE_200');
  } catch (error) {
    throw toKakaoAuthError(error, 'onboarding');
  }
}

export async function loadRemoteUserProfile(accessToken?: string) {
  try {
    const response = await kakaoApiRequest<unknown>('/users/me',
      accessToken
        ? {
            authenticated: false,
            headers: { Authorization: `Bearer ${requireNonBlank(accessToken)}` },
          }
        : undefined,
    );
    return parseRemoteUserProfileEnvelope(response, 'USER_PROFILE_200');
  } catch (error) {
    throw toKakaoAuthError(error, 'login');
  }
}

export async function loadRemoteUserIdentity() {
  try {
    const response = await kakaoApiRequest<unknown>('/users/me');
    return parseRemoteUserIdentityEnvelope(response);
  } catch (error) {
    throw toKakaoAuthError(error, 'login');
  }
}

export async function logoutRemoteSession() {
  let serverError: unknown;

  try {
    await withTokenRefreshPaused(async () => {
      const tokens = await getTokens();
      if (!tokens) return;

      try {
        const response = await kakaoApiRequest<unknown>('/auth/logout', {
          authenticated: false,
          json: { refreshToken: requireNonBlank(tokens.refreshToken) },
          method: 'POST',
        });
        assertSuccessfulLogoutEnvelope(response);
      } catch (error) {
        if (['LOGOUT_401', 'LOGOUT_INVALID'].includes(getResponseCode(error) ?? '')) return;
        throw toKakaoAuthError(error, 'logout');
      }
    });
  } catch (error) {
    serverError = error;
  }

  await logout().catch(() => undefined);
  if (serverError) throw serverError;
}
