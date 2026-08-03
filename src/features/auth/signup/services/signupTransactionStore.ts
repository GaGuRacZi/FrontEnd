import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthMethod } from '../../session/AuthSessionStore';

const ACTIVE_SIGNUP_TRANSACTION_KEY = 'paw:signup-transaction:active';
const SIGNUP_TRANSACTION_PREFIX = 'paw:signup-transaction:';
const SIGNUP_TRANSACTION_SCHEMA_VERSION = 1;
const SIGNUP_TRANSACTION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type SignupTransaction = {
  createdAt: string;
  email: string;
  method: AuthMethod;
  schemaVersion: typeof SIGNUP_TRANSACTION_SCHEMA_VERSION;
  sessionId: string;
  status: 'committed' | 'pending';
  userId: string;
};

export type SignupTransactionOwner = Pick<
  SignupTransaction,
  'email' | 'method' | 'sessionId' | 'userId'
>;

function signupTransactionKey(userId: string) {
  return `${SIGNUP_TRANSACTION_PREFIX}${encodeURIComponent(userId)}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isAuthMethod(value: unknown): value is AuthMethod {
  return value === 'kakao' || value === 'local';
}

function isSignupTransaction(value: unknown): value is SignupTransaction {
  if (!value || typeof value !== 'object') return false;

  const transaction = value as Partial<SignupTransaction>;

  return (
    transaction.schemaVersion === SIGNUP_TRANSACTION_SCHEMA_VERSION &&
    typeof transaction.createdAt === 'string' &&
    Number.isFinite(Date.parse(transaction.createdAt)) &&
    typeof transaction.email === 'string' &&
    transaction.email === normalizeEmail(transaction.email) &&
    isAuthMethod(transaction.method) &&
    typeof transaction.sessionId === 'string' &&
    Boolean(transaction.sessionId.trim()) &&
    (transaction.status === 'committed' || transaction.status === 'pending') &&
    typeof transaction.userId === 'string' &&
    Boolean(transaction.userId.trim())
  );
}

function parseSignupTransaction(value: string | null) {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return isSignupTransaction(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sameOwner(
  transaction: SignupTransaction,
  owner: SignupTransactionOwner,
) {
  return (
    transaction.email === normalizeEmail(owner.email) &&
    transaction.method === owner.method &&
    transaction.sessionId === owner.sessionId &&
    transaction.userId === owner.userId
  );
}

function isCurrentTransaction(transaction: SignupTransaction) {
  const createdAt = Date.parse(transaction.createdAt);
  const now = Date.now();

  return (
    createdAt <= now + 60_000 &&
    createdAt >= now - SIGNUP_TRANSACTION_RETENTION_MS
  );
}

export async function loadSignupTransaction(userId: string) {
  const stored = await AsyncStorage.getItem(signupTransactionKey(userId));

  return {
    exists: stored !== null,
    transaction: parseSignupTransaction(stored),
  };
}

export async function loadActiveSignupTransaction(
  initialMethod?: AuthMethod,
) {
  const storedActive = await AsyncStorage.getItem(ACTIVE_SIGNUP_TRANSACTION_KEY);
  const active = parseSignupTransaction(storedActive);

  if (!active || !isCurrentTransaction(active)) {
    if (storedActive !== null) {
      await AsyncStorage.removeItem(ACTIVE_SIGNUP_TRANSACTION_KEY);
    }
    return null;
  }

  if (initialMethod && active.method !== initialMethod) return null;

  const storedTransaction = await loadSignupTransaction(active.userId);
  const transaction = storedTransaction.transaction;

  if (
    !transaction ||
    !sameOwner(transaction, active) ||
    transaction.createdAt !== active.createdAt
  ) {
    return null;
  }

  return transaction;
}

export async function saveSignupTransaction(
  owner: SignupTransactionOwner,
  status: SignupTransaction['status'],
) {
  const normalizedOwner: SignupTransactionOwner = {
    ...owner,
    email: normalizeEmail(owner.email),
  };
  const current = (await loadSignupTransaction(owner.userId)).transaction;
  const createdAt =
    current && sameOwner(current, normalizedOwner)
      ? current.createdAt
      : new Date().toISOString();
  const transaction: SignupTransaction = {
    ...normalizedOwner,
    createdAt,
    schemaVersion: SIGNUP_TRANSACTION_SCHEMA_VERSION,
    status,
  };
  const serialized = JSON.stringify(transaction);

  await AsyncStorage.multiSet([
    [signupTransactionKey(owner.userId), serialized],
    [ACTIVE_SIGNUP_TRANSACTION_KEY, serialized],
  ]);

  return transaction;
}

export async function clearSignupTransaction(
  userId: string,
  sessionId?: string,
) {
  const [storedTransaction, storedActive] = await Promise.all([
    AsyncStorage.getItem(signupTransactionKey(userId)),
    AsyncStorage.getItem(ACTIVE_SIGNUP_TRANSACTION_KEY),
  ]);
  const transaction = parseSignupTransaction(storedTransaction);
  const active = parseSignupTransaction(storedActive);
  const canRemoveTransaction =
    sessionId === undefined ||
    storedTransaction === null ||
    transaction?.sessionId === sessionId;
  const keys = canRemoveTransaction ? [signupTransactionKey(userId)] : [];

  if (
    active?.userId === userId &&
    (sessionId === undefined || active.sessionId === sessionId)
  ) {
    keys.push(ACTIVE_SIGNUP_TRANSACTION_KEY);
  }

  if (keys.length > 0) {
    await AsyncStorage.multiRemove(keys);
  }
}

export function clearActiveSignupTransaction() {
  return AsyncStorage.removeItem(ACTIVE_SIGNUP_TRANSACTION_KEY);
}

export function isSignupTransactionOwner(
  transaction: SignupTransaction,
  owner: SignupTransactionOwner,
) {
  return sameOwner(transaction, owner);
}
