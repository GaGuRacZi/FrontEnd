import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useState } from 'react';

import type { DiagnosisMedication } from '@/src/features/dashboard/types';

type MedicationStoreContextValue = {
  medications: DiagnosisMedication[];
  addMedications: (entries: DiagnosisMedication[]) => void;
  removeMedication: (id: string) => void;
};

const MedicationStoreContext = createContext<MedicationStoreContextValue | null>(null);

export function MedicationProvider({ children }: PropsWithChildren) {
  const [medications, setMedications] = useState<DiagnosisMedication[]>([]);

  const addMedications = useCallback((entries: DiagnosisMedication[]) => {
    setMedications((current) => {
      const existingIds = new Set(current.map((medication) => medication.id));
      const additions = entries.filter((medication) => !existingIds.has(medication.id));
      return additions.length > 0 ? [...current, ...additions] : current;
    });
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
