import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.test';

let tokens = { accessToken: 'access-a', refreshToken: 'refresh-a' };
const storage = {
  getTokens: async () => (tokens ? { ...tokens } : null),
  invalidateTokensIfRefreshTokenMatches: async (expected) => {
    if (tokens?.refreshToken !== expected) return false;
    tokens = null;
    return true;
  },
  saveTokensIfTokensMatch: async (expected, nextTokens) => {
    if (
      tokens?.accessToken !== expected.accessToken ||
      tokens.refreshToken !== expected.refreshToken
    ) {
      return false;
    }
    tokens = nextTokens;
    return true;
  },
};

let fetchHandler;
const source = readFileSync(new URL('../src/services/apiClient.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadedModule = { exports: {} };
new Function('module', 'exports', 'require', 'process', 'fetch', 'Headers', compiled)(
  loadedModule,
  loadedModule.exports,
  (id) => {
    if (id === './tokenStorage') return storage;
    throw new Error(`Unexpected import: ${id}`);
  },
  process,
  (...args) => fetchHandler(...args),
  Headers,
);

const { ApiError, apiRequest } = loadedModule.exports;
const jsonResponse = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });

let reissueCount = 0;
let requestCount = 0;
const form = new FormData();
form.append('image', new Blob(['paw'], { type: 'image/jpeg' }), 'paw.jpg');
fetchHandler = async (url, init) => {
  const headers = new Headers(init.headers);

  if (url.endsWith('/auth/reissue')) {
    reissueCount += 1;
    assert.equal(headers.get('Authorization'), null);
    assert.deepEqual(JSON.parse(init.body), { refreshToken: 'refresh-a' });
    return jsonResponse({
      code: 'REFRESH_200',
      isSuccess: true,
      message: 'ok',
      result: { accessToken: 'access-b', refreshToken: 'refresh-b' },
    });
  }

  requestCount += 1;
  assert.equal(init.body, form);
  assert.equal(headers.get('Content-Type'), null);

  if (headers.get('Authorization') === 'Bearer access-a') {
    return jsonResponse({ code: 'TOKEN_EXPIRED', isSuccess: false, message: 'expired' }, 401);
  }

  assert.equal(headers.get('Authorization'), 'Bearer access-b');
  return jsonResponse({ ok: true });
};

await Promise.all([
  apiRequest('/images', { body: form, method: 'POST' }),
  apiRequest('/images', { body: form, method: 'POST' }),
]);
assert.equal(reissueCount, 1);
assert.equal(requestCount, 4);
assert.deepEqual(tokens, { accessToken: 'access-b', refreshToken: 'refresh-b' });

tokens = { accessToken: 'access-race', refreshToken: 'refresh-race' };
let releaseReissue;
let markReissueStarted;
const reissueStarted = new Promise((resolve) => {
  markReissueStarted = resolve;
});
const reissueReleased = new Promise((resolve) => {
  releaseReissue = resolve;
});
let usedNewAccountToken = false;
fetchHandler = async (url, init) => {
  if (!url.endsWith('/auth/reissue')) {
    usedNewAccountToken ||=
      new Headers(init.headers).get('Authorization') === 'Bearer new-account-access';
    return jsonResponse({ code: 'TOKEN_EXPIRED', isSuccess: false, message: 'expired' }, 401);
  }

  markReissueStarted();
  await reissueReleased;
  return jsonResponse({
    code: 'REFRESH_200',
    isSuccess: true,
    message: 'ok',
    result: { accessToken: 'resurrected-access', refreshToken: 'resurrected-refresh' },
  });
};
const racingRequest = apiRequest('/profile');
await reissueStarted;
tokens = { accessToken: 'new-account-access', refreshToken: 'new-account-refresh' };
releaseReissue();
await assert.rejects(racingRequest, ApiError);
assert.deepEqual(tokens, {
  accessToken: 'new-account-access',
  refreshToken: 'new-account-refresh',
});
assert.equal(usedNewAccountToken, false);

tokens = null;
fetchHandler = async (url) => {
  assert.equal(url.endsWith('/auth/reissue'), false);
  return jsonResponse({ code: 'UNAUTHORIZED', isSuccess: false, message: 'unauthorized' }, 401);
};
await assert.rejects(apiRequest('/local'), ApiError);

tokens = { accessToken: 'access-c', refreshToken: 'refresh-c' };
fetchHandler = async (url) => {
  if (!url.endsWith('/auth/reissue')) {
    return jsonResponse({ code: 'TOKEN_EXPIRED', isSuccess: false, message: 'expired' }, 401);
  }

  return jsonResponse(
    { code: 'REFRESH_401', isSuccess: false, message: 'invalid refresh token' },
    401,
  );
};
await assert.rejects(apiRequest('/profile'), ApiError);
assert.equal(tokens, null);

tokens = { accessToken: 'access-d', refreshToken: 'refresh-d' };
fetchHandler = async (url) =>
  url.endsWith('/auth/reissue')
    ? jsonResponse(
        { code: 'REFRESH_INVALID', isSuccess: false, message: 'invalid refresh token' },
        401,
      )
    : jsonResponse({ code: 'TOKEN_EXPIRED', isSuccess: false, message: 'expired' }, 401);
await assert.rejects(apiRequest('/profile'), ApiError);
assert.equal(tokens, null);
