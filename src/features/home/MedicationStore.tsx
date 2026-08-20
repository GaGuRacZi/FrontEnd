import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useState } from 'react';

import type { DiagnosisMedication } from '@/src/features/dashboard/types';

type MedicationStoreContextValue = {
  medications: DiagnosisMedication[];
  addMedications: (entries: DiagnosisMedication[]) => void;
  removeMedication: (id: string) => void;
};

const MedicationStoreContext = createContext<MedicationStoreContextValue | null>(null);

const MOCK_INITIAL_MEDICATIONS: DiagnosisMedication[] = [
  {
    id: 'mock-med-1',
    name: '메타캄',
    dosageLabel: 'Meloxicam 1.5mg/ml',
    frequencyLabel: '1일 2회',
    doseLabel: '1정씩',
    mealTimingLabel: '식사 후',
    timings: ['morning', 'dinner'],
    warningNote: '위장 자극 주의, 공복 투여 금지',
  },
];

export function MedicationProvider({ children }: PropsWithChildren) {
  const [medications, setMedications] = useState<DiagnosisMedication[]>(MOCK_INITIAL_MEDICATIONS);

  const addMedications = useCallback((entries: DiagnosisMedication[]) => {
    setMedications((prev) => [...prev, ...entries]);
  }, []);

  const removeMedication = useCallback((id: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <MedicationStoreContext.Provider value={{ medications, addMedications, removeMedication }}>
      {children}
    </MedicationStoreContext.Provider>
  );
}

export function useMedicationStore(): MedicationStoreContextValue {
  const ctx = useContext(MedicationStoreContext);
  if (!ctx) throw new Error('useMedicationStore must be used inside MedicationProvider');
  return ctx;
}
