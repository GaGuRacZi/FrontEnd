import { ApiError, apiRequest } from '@/src/services/apiClient';
import { assertSuccessfulEmailEnvelope } from '../../services/kakaoAuthContract';

type EmailVerificationError = {
  alreadyRegistered?: true;
  message: string;
};

const EMAIL_VERIFICATION_TIMEOUT_MS = 15000;

function getErrorCode(error: ApiError) {
  if (typeof error.data !== 'object' || error.data === null) return undefined;

  const code = 'code' in error.data ? error.data.code : undefined;

  return typeof code === 'string' ? code : undefined;
}

async function emailVerificationRequest<ResponseData>(path: string, json: unknown) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EMAIL_VERIFICATION_TIMEOUT_MS);

  try {
    return await apiRequest<ResponseData>(path, {
      authenticated: false,
      json,
      method: 'POST',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function normalizeSignupEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function requestSignupEmailVerification(email: string) {
  const normalizedEmail = normalizeSignupEmail(email);
  const response = await emailVerificationRequest<unknown>('/auth/email/send', {
    email: normalizedEmail,
  });

  assertSuccessfulEmailEnvelope(response, 'EMAIL_SEND_200');
  return normalizedEmail;
}

export async function confirmSignupEmailVerification(email: string, code: string) {
  const normalizedEmail = normalizeSignupEmail(email);
  const response = await emailVerificationRequest<unknown>('/auth/email/verify', {
    code,
    email: normalizedEmail,
  });

  assertSuccessfulEmailEnvelope(response, 'EMAIL_VERIFY_200');
  return normalizedEmail;
}

export function resolveEmailVerificationError(
  error: unknown,
  phase: 'confirm' | 'request',
): EmailVerificationError {
  if (error instanceof ApiError) {
    const code = getErrorCode(error);

    if (code === 'LOCAL_SIGNUP_409_1') {
      return {
        alreadyRegistered: true,
        message: '이미 가입된 이메일이에요.',
      };
    }

    if (code === 'EMAIL_CODE_400') {
      return {
        message: '인증번호가 만료되었어요. 다시 인증해주세요.',
      };
    }

    if (code === 'INVALID_VERIFICATION_CODE') {
      return {
        message: '인증번호가 올바르지 않아요.',
      };
    }

    if (error.status === 429 || code === 'EMAIL_SEND_429') {
      return {
        message: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
      };
    }
  }

  return {
    message:
      phase === 'request'
        ? '인증 메일을 보내지 못했어요. 잠시 후 다시 시도해주세요.'
        : '이메일 인증을 완료하지 못했어요. 잠시 후 다시 시도해주세요.',
  };
}
