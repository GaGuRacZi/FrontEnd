import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';

import type { MedicalExpenseRecord, WalkRecord, WeightRecord } from './types';

type StoredHealthSummary = {
  medicalExpenseRecords: MedicalExpenseRecord[];
  walkRecords: WalkRecord[];
  weightRecords: WeightRecord[];
};

type HealthSummaryStoreContextValue = StoredHealthSummary & {
  addMedicalExpenseRecord: (record: MedicalExpenseRecord) => void;
  addWalkRecord: (record: WalkRecord) => void;
  addWeightRecord: (record: WeightRecord) => void;
  clearScreenSession: () => Promise<void>;
  deleteMedicalExpenseRecord: (recordId: string) => void;
  deleteWalkRecord: (recordId: string) => void;
  deleteWeightRecord: (recordId: string) => void;
  deleteUserHealthSummaryData: (userId: string) => Promise<void>;
  isReady: boolean;
};

const HealthSummaryStoreContext = createContext<HealthSummaryStoreContextValue | null>(null);
const EMPTY_STATE: StoredHealthSummary = {
  medicalExpenseRecords: [],
  walkRecords: [],
  weightRecords: [],
};
const STORAGE_KEY_PREFIX = 'paw:health-summary:';

function storageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function parseStoredHealthSummary(value: string | null): StoredHealthSummary {
  if (!value) return EMPTY_STATE;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY_STATE;
    const state = parsed as Partial<StoredHealthSummary>;
    return {
      medicalExpenseRecords: Array.isArray(state.medicalExpenseRecords) ? state.medicalExpenseRecords : [],
      walkRecords: Array.isArray(state.walkRecords) ? state.walkRecords : [],
      weightRecords: Array.isArray(state.weightRecords) ? state.weightRecords : [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

function replaceRecord<T extends { id: string }>(records: T[], record: T) {
  const exists = records.some(({ id }) => id === record.id);
  return exists
    ? records.map((current) => (current.id === record.id ? record : current))
    : [...records, record];
}

export function HealthSummaryProvider({ children }: PropsWithChildren) {
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const [state, setState] = useState<StoredHealthSummary>(EMPTY_STATE);
  const [isReady, setIsReady] = useState(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionReady) return;

    let active = true;
    userIdRef.current = currentUserId;
    setIsReady(false);
    setState(EMPTY_STATE);

    if (!currentUserId) {
      setIsReady(true);
      return () => {
        active = false;
      };
    }

    void AsyncStorage.getItem(storageKey(currentUserId))
      .then((value) => {
        if (active) setState(parseStoredHealthSummary(value));
      })
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [currentUserId, sessionReady]);

  const updateState = useCallback((updater: (current: StoredHealthSummary) => StoredHealthSummary) => {
    setState((current) => {
      const next = updater(current);
      const userId = userIdRef.current;
      if (userId) void AsyncStorage.setItem(storageKey(userId), JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const addWeightRecord = useCallback((record: WeightRecord) => {
    updateState((current) => ({
      ...current,
      weightRecords: replaceRecord(current.weightRecords, record),
    }));
  }, [updateState]);

  const addWalkRecord = useCallback((record: WalkRecord) => {
    updateState((current) => ({
      ...current,
      walkRecords: replaceRecord(current.walkRecords, record),
    }));
  }, [updateState]);

  const addMedicalExpenseRecord = useCallback((record: MedicalExpenseRecord) => {
    updateState((current) => ({
      ...current,
      medicalExpenseRecords: replaceRecord(current.medicalExpenseRecords, record),
    }));
  }, [updateState]);

  const deleteWeightRecord = useCallback((recordId: string) => {
    updateState((current) => ({
      ...current,
      weightRecords: current.weightRecords.filter(({ id }) => id !== recordId),
    }));
  }, [updateState]);

  const deleteWalkRecord = useCallback((recordId: string) => {
    updateState((current) => ({
      ...current,
      walkRecords: current.walkRecords.filter(({ id }) => id !== recordId),
    }));
  }, [updateState]);

  const deleteMedicalExpenseRecord = useCallback((recordId: string) => {
    updateState((current) => ({
      ...current,
      medicalExpenseRecords: current.medicalExpenseRecords.filter(({ id }) => id !== recordId),
    }));
  }, [updateState]);

  const clearScreenSession = useCallback(async () => {
    userIdRef.current = null;
    setState(EMPTY_STATE);
    setIsReady(false);
  }, []);

  const deleteUserHealthSummaryData = useCallback((userId: string) => AsyncStorage.removeItem(storageKey(userId)), []);

  return (
    <HealthSummaryStoreContext.Provider
      value={{
        ...state,
        addMedicalExpenseRecord,
        addWalkRecord,
        addWeightRecord,
        clearScreenSession,
        deleteMedicalExpenseRecord,
        deleteWalkRecord,
        deleteWeightRecord,
        deleteUserHealthSummaryData,
        isReady,
      }}
    >
      {children}
    </HealthSummaryStoreContext.Provider>
  );
}

export function useHealthSummaryStore() {
  const context = useContext(HealthSummaryStoreContext);
  if (!context) throw new Error('useHealthSummaryStore must be used inside HealthSummaryProvider');
  return context;
}
