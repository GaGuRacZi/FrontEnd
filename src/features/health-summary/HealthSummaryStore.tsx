import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { usePetStore } from '@/src/features/pet/PetStore';

import {
  deleteMedicalExpenseRecord as deleteRemoteMedicalExpenseRecord,
  deleteWalkRecord as deleteRemoteWalkRecord,
  deleteWeightRecord as deleteRemoteWeightRecord,
  getExpenseSummary,
  getMedicalExpenseRecords,
  getWalkDailySummary,
  getWalkRecords,
  getWalkWeeklySummary,
  getWeightGraph,
  getWeightRecords,
  getWeightSummary,
  saveMedicalExpenseRecord as saveRemoteMedicalExpenseRecord,
  saveWalkRecord as saveRemoteWalkRecord,
  saveWeightRecord as saveRemoteWeightRecord,
  type ExpenseSummary,
  type WalkDailySummary,
  type WalkWeeklySummary,
  type WeightGraphPoint,
  type WeightSummary,
} from './services/healthSummaryApi';
import type { MedicalExpenseRecord, WalkRecord, WeightRecord } from './types';

type HealthSummaryState = {
  expenseSummaries: Record<string, ExpenseSummary>;
  medicalExpenseRecords: MedicalExpenseRecord[];
  walkDailySummaries: Record<string, WalkDailySummary[]>;
  walkRecords: WalkRecord[];
  walkWeeklySummaries: Record<string, WalkWeeklySummary>;
  weightGraphs: Record<string, WeightGraphPoint[]>;
  weightRecords: WeightRecord[];
  weightSummaries: Record<string, WeightSummary>;
};

type HealthSummaryStoreContextValue = HealthSummaryState & {
  clearScreenSession: () => Promise<void>;
  deleteMedicalExpenseRecord: (record: MedicalExpenseRecord) => Promise<void>;
  deleteUserHealthSummaryData: (_userId: string) => Promise<void>;
  deleteWalkRecord: (record: WalkRecord) => Promise<void>;
  deleteWeightRecord: (record: WeightRecord) => Promise<void>;
  isReady: boolean;
  loadMonth: (petId: string, year: number, month: number) => Promise<void>;
  saveMedicalExpenseRecord: (record: MedicalExpenseRecord) => Promise<MedicalExpenseRecord>;
  saveWalkRecord: (record: WalkRecord, automatic?: boolean) => Promise<WalkRecord>;
  saveWeightRecord: (record: WeightRecord) => Promise<WeightRecord>;
};

const HealthSummaryStoreContext = createContext<HealthSummaryStoreContextValue | null>(null);
const EMPTY_STATE: HealthSummaryState = {
  expenseSummaries: {},
  medicalExpenseRecords: [],
  walkDailySummaries: {},
  walkRecords: [],
  walkWeeklySummaries: {},
  weightGraphs: {},
  weightRecords: [],
  weightSummaries: {},
};

function isInMonth(date: string, year: number, month: number) {
  return date.startsWith(`${year}.${String(month).padStart(2, '0')}.`);
}

function replaceMonth<T extends { date: string; petId: string }>(records: T[], petId: string, year: number, month: number, next: T[]) {
  return [...records.filter((record) => record.petId !== petId || !isInMonth(record.date, year, month)), ...next];
}

function replaceRecord<T extends { id: string }>(records: T[], record: T) {
  return records.some((current) => current.id === record.id)
    ? records.map((current) => current.id === record.id ? record : current)
    : [...records, record];
}

function currentMonth() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function HealthSummaryProvider({ children }: PropsWithChildren) {
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const { isReady: petsReady, pets } = usePetStore();
  const [state, setState] = useState<HealthSummaryState>(EMPTY_STATE);
  const [isReady, setIsReady] = useState(false);

  const loadMonth = useCallback(async (petId: string, year: number, month: number) => {
    const [weightRecords, walkRecords, medicalExpenseRecords] = await Promise.allSettled([
      getWeightRecords(petId, year, month),
      getWalkRecords(petId, year, month),
      getMedicalExpenseRecords(petId, year, month),
    ]);
    setState((current) => ({
      ...current,
      medicalExpenseRecords: medicalExpenseRecords.status === 'fulfilled'
        ? replaceMonth(current.medicalExpenseRecords, petId, year, month, medicalExpenseRecords.value)
        : current.medicalExpenseRecords,
      walkRecords: walkRecords.status === 'fulfilled'
        ? replaceMonth(current.walkRecords, petId, year, month, walkRecords.value)
        : current.walkRecords,
      weightRecords: weightRecords.status === 'fulfilled'
        ? replaceMonth(current.weightRecords, petId, year, month, weightRecords.value)
        : current.weightRecords,
    }));
  }, []);

  const refreshPetSummary = useCallback(async (petId: string) => {
    const { month, year } = currentMonth();
    const previous = month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
    await Promise.allSettled([
      loadMonth(petId, year, month),
      loadMonth(petId, previous.year, previous.month),
    ]);
    const [weightSummary, oneMonthGraph, sixMonthGraph, walkWeeklySummary, walkDailySummary, expenseSummary] = await Promise.allSettled([
      getWeightSummary(petId),
      getWeightGraph(petId, 'ONE_MONTH'),
      getWeightGraph(petId, 'SIX_MONTHS'),
      getWalkWeeklySummary(petId),
      getWalkDailySummary(petId),
      getExpenseSummary(petId, year, month),
    ]);
    setState((current) => ({
      ...current,
      expenseSummaries: expenseSummary.status === 'fulfilled'
        ? { ...current.expenseSummaries, [petId]: expenseSummary.value }
        : current.expenseSummaries,
      walkDailySummaries: walkDailySummary.status === 'fulfilled'
        ? { ...current.walkDailySummaries, [petId]: walkDailySummary.value }
        : current.walkDailySummaries,
      walkWeeklySummaries: walkWeeklySummary.status === 'fulfilled'
        ? { ...current.walkWeeklySummaries, [petId]: walkWeeklySummary.value }
        : current.walkWeeklySummaries,
      weightGraphs: {
        ...current.weightGraphs,
        ...(oneMonthGraph.status === 'fulfilled' ? { [`${petId}:ONE_MONTH`]: oneMonthGraph.value } : {}),
        ...(sixMonthGraph.status === 'fulfilled' ? { [`${petId}:SIX_MONTHS`]: sixMonthGraph.value } : {}),
      },
      weightSummaries: weightSummary.status === 'fulfilled'
        ? { ...current.weightSummaries, [petId]: weightSummary.value }
        : current.weightSummaries,
    }));
  }, [loadMonth]);

  useEffect(() => {
    if (!sessionReady || !petsReady) return;

    let active = true;
    setState(EMPTY_STATE);
    if (!currentUserId || pets.length === 0) {
      setIsReady(true);
      return () => {
        active = false;
      };
    }

    setIsReady(false);
    void Promise.all(pets.map((pet) => refreshPetSummary(pet.id)))
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [currentUserId, pets, petsReady, refreshPetSummary, sessionReady]);

  const saveWeightRecord = useCallback(async (record: WeightRecord) => {
    const saved = await saveRemoteWeightRecord(record);
    setState((current) => ({ ...current, weightRecords: replaceRecord(current.weightRecords, saved) }));
    await refreshPetSummary(saved.petId);
    return saved;
  }, [refreshPetSummary]);

  const saveWalkRecord = useCallback(async (record: WalkRecord, automatic = false) => {
    const saved = await saveRemoteWalkRecord(record, automatic);
    setState((current) => ({ ...current, walkRecords: replaceRecord(current.walkRecords, saved) }));
    await refreshPetSummary(saved.petId);
    return saved;
  }, [refreshPetSummary]);

  const saveMedicalExpenseRecord = useCallback(async (record: MedicalExpenseRecord) => {
    const saved = await saveRemoteMedicalExpenseRecord(record);
    setState((current) => ({ ...current, medicalExpenseRecords: replaceRecord(current.medicalExpenseRecords, saved) }));
    await refreshPetSummary(saved.petId);
    return saved;
  }, [refreshPetSummary]);

  const deleteWeightRecord = useCallback(async (record: WeightRecord) => {
    await deleteRemoteWeightRecord(record);
    setState((current) => ({ ...current, weightRecords: current.weightRecords.filter(({ id }) => id !== record.id) }));
    await refreshPetSummary(record.petId);
  }, [refreshPetSummary]);

  const deleteWalkRecord = useCallback(async (record: WalkRecord) => {
    await deleteRemoteWalkRecord(record.id);
    setState((current) => ({ ...current, walkRecords: current.walkRecords.filter(({ id }) => id !== record.id) }));
    await refreshPetSummary(record.petId);
  }, [refreshPetSummary]);

  const deleteMedicalExpenseRecord = useCallback(async (record: MedicalExpenseRecord) => {
    await deleteRemoteMedicalExpenseRecord(record.id);
    setState((current) => ({ ...current, medicalExpenseRecords: current.medicalExpenseRecords.filter(({ id }) => id !== record.id) }));
    await refreshPetSummary(record.petId);
  }, [refreshPetSummary]);

  const clearScreenSession = useCallback(async () => {
    setState(EMPTY_STATE);
    setIsReady(false);
  }, []);

  const deleteUserHealthSummaryData = useCallback(async (_userId: string) => {
    setState(EMPTY_STATE);
  }, []);

  const value = useMemo<HealthSummaryStoreContextValue>(() => ({
    ...state,
    clearScreenSession,
    deleteMedicalExpenseRecord,
    deleteUserHealthSummaryData,
    deleteWalkRecord,
    deleteWeightRecord,
    isReady,
    loadMonth,
    saveMedicalExpenseRecord,
    saveWalkRecord,
    saveWeightRecord,
  }), [clearScreenSession, deleteMedicalExpenseRecord, deleteUserHealthSummaryData, deleteWalkRecord, deleteWeightRecord, isReady, loadMonth, saveMedicalExpenseRecord, saveWalkRecord, saveWeightRecord, state]);

  return <HealthSummaryStoreContext.Provider value={value}>{children}</HealthSummaryStoreContext.Provider>;
}

export function useHealthSummaryStore() {
  const context = useContext(HealthSummaryStoreContext);
  if (!context) throw new Error('useHealthSummaryStore must be used inside HealthSummaryProvider');
  return context;
}
