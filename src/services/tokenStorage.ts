import * as SecureStore from 'expo-secure-store';

const TOKEN_STORAGE_KEYS = {
  accessToken: 'paw.accessToken',
  refreshToken: 'paw.refreshToken',
} as const;

const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'paw.auth',
} satisfies SecureStore.SecureStoreOptions;

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

let tokenMutation: Promise<unknown> = Promise.resolve();
const invalidationListeners = new Set<() => void>();

function mutateTokens<T>(operation: () => Promise<T>) {
  const result = tokenMutation.then(operation, operation);
  tokenMutation = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function saveAccessToken(token: string) {
  return SecureStore.setItemAsync(
    TOKEN_STORAGE_KEYS.accessToken,
    token,
    SECURE_STORE_OPTIONS,
  );
}

function getAccessToken() {
  return SecureStore.getItemAsync(TOKEN_STORAGE_KEYS.accessToken, SECURE_STORE_OPTIONS);
}

function saveRefreshToken(token: string) {
  return SecureStore.setItemAsync(
    TOKEN_STORAGE_KEYS.refreshToken,
    token,
    SECURE_STORE_OPTIONS,
  );
}

function getRefreshToken() {
  return SecureStore.getItemAsync(TOKEN_STORAGE_KEYS.refreshToken, SECURE_STORE_OPTIONS);
}

export function saveTokens({ accessToken, refreshToken }: AuthTokens) {
  return mutateTokens(async () => {
    await saveRefreshToken(refreshToken);
    await saveAccessToken(accessToken);
  });
}

export function getTokens() {
  return mutateTokens(async () => {
    const [accessToken, refreshToken] = await Promise.all([
      getAccessToken(),
      getRefreshToken(),
    ]);
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  });
}

export function saveTokensIfTokensMatch(
  expected: AuthTokens,
  { accessToken, refreshToken }: AuthTokens,
) {
  return mutateTokens(async () => {
    const [currentAccessToken, currentRefreshToken] = await Promise.all([
      getAccessToken(),
      getRefreshToken(),
    ]);
    if (
      currentAccessToken !== expected.accessToken ||
      currentRefreshToken !== expected.refreshToken
    ) {
      return false;
    }
    await saveRefreshToken(refreshToken);
    await saveAccessToken(accessToken);
    return true;
  });
}

function deleteTokens() {
  return Promise.all([
    SecureStore.deleteItemAsync(TOKEN_STORAGE_KEYS.accessToken, SECURE_STORE_OPTIONS),
    SecureStore.deleteItemAsync(TOKEN_STORAGE_KEYS.refreshToken, SECURE_STORE_OPTIONS),
  ]).then(() => undefined);
}

export function clearTokens() {
  return mutateTokens(deleteTokens);
}

export async function invalidateTokensIfRefreshTokenMatches(
  expectedRefreshToken: string,
) {
  const invalidated = await mutateTokens(async () => {
    if ((await getRefreshToken()) !== expectedRefreshToken) return false;
    await deleteTokens();
    return true;
  });

  if (invalidated) invalidationListeners.forEach((listener) => listener());
  return invalidated;
}

export function subscribeToTokenInvalidation(listener: () => void) {
  invalidationListeners.add(listener);
  return () => {
    invalidationListeners.delete(listener);
  };
}
