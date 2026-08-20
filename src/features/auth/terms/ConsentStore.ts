import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ConsentDecisionInput, ConsentRecord } from './types';
import { isValidConsentRecord } from './types';

export interface ConsentStore {
  deleteExpiredSignupHistories(activeSignupUserId: string): Promise<void>;
  deleteHistory(userId: string): Promise<void>;
  getHistory(userId: string): Promise<ConsentRecord[]>;
  recordDecision(input: ConsentDecisionInput): Promise<ConsentRecord>;
  transferSignupHistoryToUser(
    sourceUserId: string,
    targetUserId: string,
  ): Promise<ConsentRecord[]>;
}

const SIGNUP_CONSENT_USER_ID_PREFIX = 'signup-draft:';
const CONSENT_STORAGE_KEY_PREFIX = '@paw/consent-history:v1:';
const SIGNUP_CONSENT_STORAGE_KEY_PREFIX = `${CONSENT_STORAGE_KEY_PREFIX}${encodeURIComponent(
  SIGNUP_CONSENT_USER_ID_PREFIX,
)}`;
const CONSENT_SCHEMA_VERSION = 1;
const SIGNUP_CONSENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const LEGACY_MARKETING_TERM_ID = 'marketing-communications';

type StoredConsentHistory = {
  records: ConsentRecord[];
  schemaVersion: typeof CONSENT_SCHEMA_VERSION;
};

export function getSignupConsentUserId(signupSessionId: string) {
  const normalizedSessionId = signupSessionId.trim();

  if (!normalizedSessionId) {
    throw new Error('회원가입 세션 ID가 필요합니다.');
  }

  return `${SIGNUP_CONSENT_USER_ID_PREFIX}${normalizedSessionId}`;
}

function copyRecord(record: ConsentRecord) {
  return { ...record };
}

function storageKey(userId: string) {
  return `${CONSENT_STORAGE_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

function removeLegacyMarketingRecords(value: string | null) {
  if (!value) return value;

  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return value;

  const stored = parsed as Record<string, unknown>;
  if (!Array.isArray(stored.records)) return value;

  const records = stored.records.filter(
    (record) =>
      !record ||
      typeof record !== 'object' ||
      Array.isArray(record) ||
      (record as Record<string, unknown>).termId !== LEGACY_MARKETING_TERM_ID,
  );

  return records.length === stored.records.length ? value : JSON.stringify({ ...stored, records });
}

function parseHistory(value: string | null, userId: string) {
  if (!value) return [];

  const parsed: unknown = JSON.parse(value);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('동의 이력 형식이 올바르지 않습니다.');
  }

  const stored = parsed as Partial<StoredConsentHistory>;

  if (
    stored.schemaVersion !== CONSENT_SCHEMA_VERSION ||
    !Array.isArray(stored.records) ||
    !stored.records.every((record) => isValidConsentRecord(record, userId))
  ) {
    throw new Error('동의 이력 형식이 올바르지 않습니다.');
  }

  return stored.records.map(copyRecord);
}

function serializeHistory(records: readonly ConsentRecord[]) {
  const stored: StoredConsentHistory = {
    records: records.map(copyRecord),
    schemaVersion: CONSENT_SCHEMA_VERSION,
  };

  return JSON.stringify(stored);
}

export class LocalConsentStore implements ConsentStore {
  private queue: Promise<void> = Promise.resolve();

  private enqueue<T>(operation: () => Promise<T>) {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async readHistory(userId: string) {
    const key = storageKey(userId);
    const stored = await AsyncStorage.getItem(key);

    try {
      const normalizedStored = removeLegacyMarketingRecords(stored);
      if (normalizedStored && normalizedStored !== stored) {
        await AsyncStorage.setItem(key, normalizedStored);
      }
      return parseHistory(normalizedStored, userId);
    } catch {
      await AsyncStorage.removeItem(key);
      return [];
    }
  }

  async deleteExpiredSignupHistories(activeSignupUserId: string) {
    return this.enqueue(async () => {
      if (!activeSignupUserId.startsWith(SIGNUP_CONSENT_USER_ID_PREFIX)) {
        throw new Error('회원가입 임시 계정 ID가 필요합니다.');
      }

      const activeStorageKey = storageKey(activeSignupUserId);
      const storageKeys = await AsyncStorage.getAllKeys();
      const signupStorageKeys = storageKeys.filter(
        (key) =>
          key.startsWith(SIGNUP_CONSENT_STORAGE_KEY_PREFIX) && key !== activeStorageKey,
      );

      if (signupStorageKeys.length === 0) return;

      const cutoff = Date.now() - SIGNUP_CONSENT_RETENTION_MS;
      const storedHistories = await AsyncStorage.multiGet(signupStorageKeys);
      const expiredKeys = storedHistories.flatMap(([key, value]) => {
        try {
          const userId = decodeURIComponent(key.slice(CONSENT_STORAGE_KEY_PREFIX.length));
          const history = parseHistory(value, userId);
          const latestDecision = history.reduce(
            (latest, { decidedAt }) => Math.max(latest, Date.parse(decidedAt)),
            0,
          );
          return Number.isFinite(latestDecision) && latestDecision >= cutoff ? [] : [key];
        } catch {
          return [key];
        }
      });

      if (expiredKeys.length > 0) await AsyncStorage.multiRemove(expiredKeys);
    });
  }

  async deleteHistory(userId: string) {
    return this.enqueue(async () => {
      await AsyncStorage.removeItem(storageKey(userId));
    });
  }

  async getHistory(userId: string) {
    return this.enqueue(async () => this.readHistory(userId));
  }

  async transferSignupHistoryToUser(sourceUserId: string, targetUserId: string) {
    return this.enqueue(async () => {
      const normalizedTargetUserId = targetUserId.trim();

      if (!normalizedTargetUserId) {
        throw new Error('사용자 ID가 필요합니다.');
      }

      if (normalizedTargetUserId.startsWith(SIGNUP_CONSENT_USER_ID_PREFIX)) {
        throw new Error('회원가입 임시 계정을 대상 사용자로 지정할 수 없습니다.');
      }

      if (sourceUserId === normalizedTargetUserId) {
        return this.readHistory(normalizedTargetUserId);
      }

      if (!sourceUserId.startsWith(SIGNUP_CONSENT_USER_ID_PREFIX)) {
        throw new Error('회원가입 중 수집한 동의만 사용자 계정에 연결할 수 있습니다.');
      }

      const [sourceHistory, targetHistory] = await Promise.all([
        this.readHistory(sourceUserId),
        this.readHistory(normalizedTargetUserId),
      ]);
      const linkedRecords = sourceHistory.map((record) => ({
        ...record,
        userId: normalizedTargetUserId,
      }));
      const mergedHistory = linkedRecords.reduce<ConsentRecord[]>((history, record) => {
        const current = [...history]
          .reverse()
          .find(
            ({ termId, termVersion }) =>
              termId === record.termId && termVersion === record.termVersion,
        );

        if (current?.agreed === record.agreed) return history;

        const linkedRecord =
          current?.agreed === true && !record.agreed && !record.withdrawnAt
            ? { ...record, withdrawnAt: record.decidedAt }
            : record;

        return [...history, linkedRecord];
      }, targetHistory);

      await AsyncStorage.setItem(
        storageKey(normalizedTargetUserId),
        serializeHistory(mergedHistory),
      );
      await AsyncStorage.removeItem(storageKey(sourceUserId));

      return mergedHistory.map(copyRecord);
    });
  }

  async recordDecision(input: ConsentDecisionInput) {
    return this.enqueue(async () => {
      const history = await this.readHistory(input.userId);
      const current = [...history]
        .reverse()
        .find(
          ({ termId, termVersion }) =>
            termId === input.termId && termVersion === input.termVersion,
        );

      if (current?.agreed === input.agreed) {
        return copyRecord(current);
      }

      const occurredAt = input.occurredAt ?? new Date().toISOString();
      const record: ConsentRecord = {
        agreed: input.agreed,
        agreedAt: input.agreed ? occurredAt : null,
        decidedAt: occurredAt,
        id: `${input.userId}:${input.termId}:${occurredAt}:${history.length}`,
        termId: input.termId,
        termVersion: input.termVersion,
        userId: input.userId,
        withdrawnAt: current?.agreed === true && !input.agreed ? occurredAt : null,
      };

      await AsyncStorage.setItem(
        storageKey(input.userId),
        serializeHistory([...history, record]),
      );

      return copyRecord(record);
    });
  }
}

export const consentStore: ConsentStore = new LocalConsentStore();
