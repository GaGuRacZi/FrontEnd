import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDefaultSupportState, NOTICE_MOCKS } from '../supportData';
import { normalizeStoredSupportState } from '../supportValidation';
import type { Notice, StoredSupportState } from '../types';

const SUPPORT_STORAGE_PREFIX = 'paw:mypage-support:';

function storageKey(userId: string) {
  return `${SUPPORT_STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function copyNotice(notice: Notice) {
  return {
    ...notice,
    isNew: Date.now() - Date.parse(notice.createdAt) <= 14 * 24 * 60 * 60 * 1000,
  };
}

export const supportRepository = {
  async deleteUser(userId: string) {
    await AsyncStorage.removeItem(storageKey(userId));
  },

  async getNotices() {
    return NOTICE_MOCKS.map(copyNotice).sort(
      (first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt),
    );
  },

  async loadState(userId: string): Promise<StoredSupportState> {
    const fallback = createDefaultSupportState(userId);
    const stored = await AsyncStorage.getItem(storageKey(userId));
    if (!stored) return fallback;

    try {
      return normalizeStoredSupportState(JSON.parse(stored) as unknown, userId, fallback);
    } catch {
      await AsyncStorage.removeItem(storageKey(userId)).catch(() => undefined);
      return fallback;
    }
  },

  async saveState(userId: string, state: StoredSupportState) {
    const normalized = normalizeStoredSupportState(
      state,
      userId,
      createDefaultSupportState(userId),
    );
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(normalized));
  },
};
