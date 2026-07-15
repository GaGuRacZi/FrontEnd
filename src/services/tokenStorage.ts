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

export function saveAccessToken(token: string) {
  return SecureStore.setItemAsync(
    TOKEN_STORAGE_KEYS.accessToken,
    token,
    SECURE_STORE_OPTIONS,
  );
}

export function getAccessToken() {
  return SecureStore.getItemAsync(TOKEN_STORAGE_KEYS.accessToken, SECURE_STORE_OPTIONS);
}

export function saveRefreshToken(token: string) {
  return SecureStore.setItemAsync(
    TOKEN_STORAGE_KEYS.refreshToken,
    token,
    SECURE_STORE_OPTIONS,
  );
}

export function getRefreshToken() {
  return SecureStore.getItemAsync(TOKEN_STORAGE_KEYS.refreshToken, SECURE_STORE_OPTIONS);
}

export async function saveTokens({ accessToken, refreshToken }: AuthTokens) {
  await Promise.all([saveAccessToken(accessToken), saveRefreshToken(refreshToken)]);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_STORAGE_KEYS.accessToken, SECURE_STORE_OPTIONS),
    SecureStore.deleteItemAsync(TOKEN_STORAGE_KEYS.refreshToken, SECURE_STORE_OPTIONS),
  ]);
}
