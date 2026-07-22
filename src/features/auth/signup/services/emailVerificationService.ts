import { API_BASE_URL, ApiError, apiRequest } from '@/src/services/apiClient';

type RequestEmailVerificationResponse = {
  expiresInSeconds: number;
  verificationId: string;
};

type ConfirmEmailVerificationResponse = {
  email: string;
  verificationToken: string;
};

type EmailVerificationError = {
  alreadyRegistered?: true;
  message: string;
};

const EMAIL_VERIFICATION_TIMEOUT_MS = 15000;
const TEMPORARY_EMAIL_VERIFICATION_ENABLED =
  __DEV__ || process.env.EXPO_PUBLIC_EMAIL_VERIFICATION_MOCK === 'true';

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

export function getTemporarySignupEmailVerification(email: string) {
  if (API_BASE_URL) return null;
  if (!TEMPORARY_EMAIL_VERIFICATION_ENABLED) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL이 설정되지 않았습니다.');
  }

  const normalizedEmail = normalizeSignupEmail(email);

  return {
    email: normalizedEmail,
    verificationToken: `temporary:${normalizedEmail}`,
  };
}

export async function requestSignupEmailVerification(email: string) {
  const response = await emailVerificationRequest<RequestEmailVerificationResponse>(
    '/auth/email-verifications/request',
    {
      email: normalizeSignupEmail(email),
      purpose: 'SIGNUP',
    },
  );

  if (
    typeof response.verificationId !== 'string' ||
    !response.verificationId ||
    !Number.isFinite(response.expiresInSeconds) ||
    response.expiresInSeconds <= 0
  ) {
    throw new Error('Invalid email verification response.');
  }

  return response;
}

export async function confirmSignupEmailVerification(verificationId: string, code: string) {
  const response = await emailVerificationRequest<ConfirmEmailVerificationResponse>(
    '/auth/email-verifications/confirm',
    {
      code,
      verificationId,
    },
  );

  if (
    typeof response.email !== 'string' ||
    !response.email ||
    typeof response.verificationToken !== 'string' ||
    !response.verificationToken
  ) {
    throw new Error('Invalid email verification response.');
  }

  return response;
}

export function resolveEmailVerificationError(
  error: unknown,
  phase: 'confirm' | 'request',
): EmailVerificationError {
  if (error instanceof ApiError) {
    const code = getErrorCode(error);

    if (code === 'EMAIL_ALREADY_REGISTERED') {
      return {
        alreadyRegistered: true,
        message: '이미 가입된 이메일이에요.',
      };
    }

    if (code === 'VERIFICATION_EXPIRED') {
      return {
        message: '인증번호가 만료되었어요. 다시 인증해주세요.',
      };
    }

    if (code === 'INVALID_VERIFICATION_CODE') {
      return {
        message: '인증번호가 올바르지 않아요.',
      };
    }

    if (error.status === 429 || code === 'TOO_MANY_REQUESTS') {
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
