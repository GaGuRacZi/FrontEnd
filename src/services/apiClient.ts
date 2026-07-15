import { getAccessToken } from './tokenStorage';

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');

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

  if (authenticated) {
    const accessToken = await getAccessToken();

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  const url = buildApiUrl(path);
  let response: Response;

  try {
    response = await fetch(url, {
      ...requestOptions,
      body: json === undefined ? requestOptions.body : JSON.stringify(json),
      headers,
    });
  } catch {
    throw new ApiError('네트워크 연결을 확인해 주세요.');
  }

  const data = await readResponse(response);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(data, response.status), response.status, data);
  }

  return data as T;
}
