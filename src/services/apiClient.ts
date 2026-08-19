import {
  getTokens,
  invalidateTokensIfRefreshTokenMatches,
  saveTokensIfTokensMatch,
  type AuthTokens,
} from './tokenStorage';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://issueissyu-ai.cloud'
).replace(/\/+$/, '');

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  authenticated?: boolean;
  body?: RequestInit['body'];
  json?: unknown;
};

export class ApiError extends Error {
  readonly data: unknown;
  readonly status?: number;

  constructor(message: string, status?: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let reissueRequest: { promise: Promise<AuthTokens | null>; source: AuthTokens } | null = null;
let lastReissue: { source: AuthTokens; target: AuthTokens } | null = null;
let reissuePauseCount = 0;
const REISSUE_TIMEOUT_MS = 15000;

function sameTokens(left: AuthTokens | null, right: AuthTokens) {
  return (
    left?.accessToken === right.accessToken &&
    left.refreshToken === right.refreshToken
  );
}

function buildApiUrl(path: string) {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL이 설정되지 않았습니다.');
  }

  return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;
}

async function readResponse(response: Response) {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();

  if (!text) {
    return undefined;
  }

  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}

function getErrorMessage(data: unknown, status: number) {
  if (typeof data === 'object' && data !== null) {
    const message = 'message' in data ? data.message : undefined;

    if (typeof message === 'string' && message) {
      return message;
    }
  }

  return `요청에 실패했습니다. (${status})`;
}

function getResponseCode(data: unknown) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const code = 'code' in data ? data.code : null;
  return typeof code === 'string' ? code : null;
}

function readReissuedTokens(data: unknown) {
  if (
    typeof data !== 'object' ||
    data === null ||
    Array.isArray(data) ||
    !('isSuccess' in data) ||
    data.isSuccess !== true ||
    getResponseCode(data) !== 'REFRESH_200' ||
    !('result' in data) ||
    typeof data.result !== 'object' ||
    data.result === null ||
    Array.isArray(data.result)
  ) {
    throw new ApiError('로그인 세션을 갱신하지 못했습니다.', undefined, data);
  }

  const { accessToken, refreshToken } = data.result as Record<string, unknown>;

  if (
    typeof accessToken !== 'string' ||
    !accessToken ||
    accessToken !== accessToken.trim() ||
    typeof refreshToken !== 'string' ||
    !refreshToken ||
    refreshToken !== refreshToken.trim()
  ) {
    throw new ApiError('로그인 세션을 갱신하지 못했습니다.', undefined, data);
  }

  return { accessToken, refreshToken };
}

async function reissueTokens(source: AuthTokens) {
  if (!sameTokens(await getTokens(), source)) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REISSUE_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(buildApiUrl('/auth/reissue'), {
      body: JSON.stringify({ refreshToken: source.refreshToken }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('네트워크 연결을 확인해 주세요.');
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await readResponse(response);

  if (['REFRESH_401', 'REFRESH_INVALID'].includes(getResponseCode(data) ?? '')) {
    await invalidateTokensIfRefreshTokenMatches(source.refreshToken);
    throw new ApiError(getErrorMessage(data, response.status), response.status, data);
  }

  if (!response.ok) {
    throw new ApiError(getErrorMessage(data, response.status), response.status, data);
  }

  const tokens = readReissuedTokens(data);

  if (!(await saveTokensIfTokensMatch(source, tokens))) return null;
  lastReissue = { source, target: tokens };
  return tokens;
}

async function getRetryAccessToken(source: AuthTokens) {
  const current = await getTokens();

  if (
    current &&
    lastReissue &&
    sameTokens(lastReissue.source, source) &&
    sameTokens(current, lastReissue.target)
  ) {
    return current.accessToken;
  }

  if (reissuePauseCount > 0 || !sameTokens(current, source)) return null;

  if (!reissueRequest) {
    const request = reissueTokens(source);
    reissueRequest = { promise: request, source };
    void request.then(
      () => {
        reissueRequest = null;
      },
      () => {
        reissueRequest = null;
      },
    );
  }

  if (!sameTokens(reissueRequest.source, source)) return null;
  return (await reissueRequest.promise)?.accessToken ?? null;
}

export async function withTokenRefreshPaused<T>(operation: () => Promise<T>) {
  reissuePauseCount += 1;
  try {
    await reissueRequest?.promise.catch(() => null);
    return await operation();
  } finally {
    reissuePauseCount -= 1;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const {
    authenticated = true,
    headers: initialHeaders,
    json,
    ...requestOptions
  } = options;

  if (json !== undefined && requestOptions.body !== undefined) {
    throw new Error('body와 json은 동시에 사용할 수 없습니다.');
  }

  const headers = new Headers(initialHeaders);
  headers.set('Accept', 'application/json');

  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const url = buildApiUrl(path);
  const body = json === undefined ? requestOptions.body : JSON.stringify(json);
  const tokens = authenticated ? await getTokens() : null;

  async function send(currentAccessToken: string | null) {
    const requestHeaders = new Headers(headers);

    if (authenticated && currentAccessToken) {
      requestHeaders.set('Authorization', `Bearer ${currentAccessToken}`);
    }

    try {
      return await fetch(url, {
        ...requestOptions,
        body,
        headers: requestHeaders,
      });
    } catch {
      throw new ApiError('네트워크 연결을 확인해 주세요.');
    }
  }

  let responseAccessToken = tokens?.accessToken ?? null;
  let response = await send(responseAccessToken);

  if (authenticated && tokens && response.status === 401) {
    const retryAccessToken = await getRetryAccessToken(tokens);

    if (retryAccessToken) {
      responseAccessToken = retryAccessToken;
      response = await send(retryAccessToken);
    }
  }

  const data = await readResponse(response);

  if (
    authenticated &&
    response.status === 403 &&
    getResponseCode(data) === 'JWT_403_2'
  ) {
    const currentTokens = await getTokens();

    if (currentTokens?.accessToken === responseAccessToken) {
      await invalidateTokensIfRefreshTokenMatches(currentTokens.refreshToken);
    }
  }

  if (!response.ok) {
    throw new ApiError(getErrorMessage(data, response.status), response.status, data);
  }

  return data as T;
}
