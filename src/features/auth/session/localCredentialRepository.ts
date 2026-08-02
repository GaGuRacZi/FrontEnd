import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const CREDENTIAL_VERSION = 1;
const SALT_BYTE_LENGTH = 16;
const HEX_PATTERN = /^[0-9a-f]+$/;

const SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'paw.local-credentials',
} satisfies SecureStore.SecureStoreOptions;

type StoredLocalCredential = {
  salt: string;
  status: 'active' | 'pending';
  verifier: string;
  version: typeof CREDENTIAL_VERSION;
};

export type LocalCredentialVerification = 'invalid' | 'missing' | 'verified';

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isStoredLocalCredential(value: unknown): value is StoredLocalCredential {
  if (!value || typeof value !== 'object') return false;

  const record = value as Record<string, unknown>;

  return (
    record.version === CREDENTIAL_VERSION &&
    typeof record.salt === 'string' &&
    record.salt.length === SALT_BYTE_LENGTH * 2 &&
    HEX_PATTERN.test(record.salt) &&
    (record.status === 'active' || record.status === 'pending') &&
    typeof record.verifier === 'string' &&
    record.verifier.length === 64 &&
    HEX_PATTERN.test(record.verifier)
  );
}

function areEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function getCredentialKey(userId: string) {
  if (!userId) throw new Error('local-credential-user-required');

  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userId,
  );
  return `paw.local.${digest}`;
}

function createVerifier(password: string, salt: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`,
  );
}

async function loadCredential(userId: string) {
  const key = await getCredentialKey(userId);
  const storedValue = await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);

  if (!storedValue) return null;

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(storedValue);
  } catch {
    throw new Error('local-credential-corrupt');
  }

  if (!isStoredLocalCredential(parsedValue)) {
    throw new Error('local-credential-corrupt');
  }

  return parsedValue;
}

function isCorruptCredentialError(error: unknown) {
  return error instanceof Error && error.message === 'local-credential-corrupt';
}

async function deleteCredential(userId: string) {
  const key = await getCredentialKey(userId);
  await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
}

async function loadCredentialOrClearCorrupt(userId: string) {
  try {
    return await loadCredential(userId);
  } catch (error) {
    if (!isCorruptCredentialError(error)) throw error;
    await deleteCredential(userId).catch(() => undefined);
    return null;
  }
}

export const localCredentialRepository = {
  async activate(userId: string) {
    const credential = await loadCredential(userId);
    if (!credential) throw new Error('local-credential-missing');
    if (credential.status === 'active') return;

    const key = await getCredentialKey(userId);
    await SecureStore.setItemAsync(
      key,
      JSON.stringify({ ...credential, status: 'active' }),
      SECURE_STORE_OPTIONS,
    );
  },

  async delete(userId: string) {
    await deleteCredential(userId);
  },

  async has(userId: string) {
    return Boolean(await loadCredentialOrClearCorrupt(userId));
  },

  async save(userId: string, password: string) {
    if (!password) throw new Error('local-credential-password-required');

    const salt = bytesToHex(await Crypto.getRandomBytesAsync(SALT_BYTE_LENGTH));
    const verifier = await createVerifier(password, salt);
    const credential: StoredLocalCredential = {
      salt,
      status: 'pending',
      verifier,
      version: CREDENTIAL_VERSION,
    };
    const key = await getCredentialKey(userId);

    await SecureStore.setItemAsync(
      key,
      JSON.stringify(credential),
      SECURE_STORE_OPTIONS,
    );
  },

  async verify(
    userId: string,
    password: string,
  ): Promise<LocalCredentialVerification> {
    if (!password) return 'invalid';

    const credential = await loadCredentialOrClearCorrupt(userId);
    if (!credential || credential.status !== 'active') return 'missing';

    const verifier = await createVerifier(password, credential.salt);
    return areEqual(verifier, credential.verifier) ? 'verified' : 'invalid';
  },
};
