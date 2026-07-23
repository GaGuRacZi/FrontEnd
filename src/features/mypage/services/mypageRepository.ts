import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDefaultMyPageState } from '../mypageMappers';
import type { StoredMyPageState } from '../types';

const STORAGE_PREFIX = 'paw:mypage:';

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(userId)}`;
}

function isStoredMyPageState(value: unknown): value is StoredMyPageState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<StoredMyPageState>;

  return Boolean(
    candidate.profile &&
      candidate.subscription &&
      candidate.notificationSettings &&
      Array.isArray(candidate.paymentMethods) &&
      Array.isArray(candidate.paymentHistory),
  );
}

export const mypageRepository = {
  async deleteUser(userId: string) {
    await AsyncStorage.removeItem(getStorageKey(userId));
  },

  async loadState(userId: string): Promise<StoredMyPageState> {
    const stored = await AsyncStorage.getItem(getStorageKey(userId));

    if (!stored) return createDefaultMyPageState(userId);

    try {
      const parsed: unknown = JSON.parse(stored);
      if (isStoredMyPageState(parsed)) {
        const defaults = createDefaultMyPageState(userId);
        return {
          ...defaults,
          ...parsed,
          notificationSettings: {
            ...defaults.notificationSettings,
            ...parsed.notificationSettings,
          },
        };
      }
      return createDefaultMyPageState(userId);
    } catch {
      return createDefaultMyPageState(userId);
    }
  },

  async saveState(userId: string, state: StoredMyPageState) {
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  },
};
