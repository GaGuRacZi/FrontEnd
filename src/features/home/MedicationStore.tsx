import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import {
  getRemoteVisitDetail,
  getRemoteVisits,
  type RemotePrescription,
  type RemoteVisit,
} from '@/src/features/dashboard/services/visitApi';
import type { DiagnosisMedication, DiagnosisMedicationTiming } from '@/src/features/dashboard/types';
import { usePetStore } from '@/src/features/pet/PetStore';

type MedicationStoreContextValue = {
  clearScreenSession: () => Promise<void>;
  hasLoadError: boolean;
  hasMedicationLoadError: boolean;
  isReady: boolean;
  medications: DiagnosisMedication[];
  reloadMedications: () => void;
  visits: RemoteVisit[];
};

const MedicationStoreContext = createContext<MedicationStoreContextValue | null>(null);

const FREQUENCY_LABEL = {
  AS_NEEDED: '필요 시',
  ONCE_DAILY: '하루 1회',
  THREE_TIMES: '하루 3회',
  TWICE_DAILY: '하루 2회',
} as const;

const MEAL_TIMING_LABEL = {
  AFTER_MEAL: '식후',
  ANYTIME: '무관',
  BEFORE_MEAL: '식전',
  BETWEEN_MEALS: '식간',
} as const;

const TAKE_TIME: Record<string, DiagnosisMedicationTiming> = {
  BEDTIME: 'bedtime',
  EVENING: 'dinner',
  LUNCH: 'lunch',
  MORNING: 'morning',
};

export function mapRemotePrescriptionToMedication(
  prescription: RemotePrescription,
  id = prescription.id,
): DiagnosisMedication {
  const dose = prescription.dosageAmount === null
    ? prescription.dosageUnit ?? '정'
    : `${prescription.dosageAmount}${prescription.dosageUnit ?? '정'}씩`;
  return {
    description: prescription.nameEn ?? undefined,
    doseLabel: dose,
    dosageLabel: prescription.ingredient ?? prescription.nameEn ?? '',
    frequencyLabel: FREQUENCY_LABEL[prescription.frequency],
    id,
    mealTimingLabel: MEAL_TIMING_LABEL[prescription.mealTiming],
    medicationId: prescription.medicationId ?? undefined,
    name: prescription.nameKo,
    timings: prescription.takeTimes.map((time) => TAKE_TIME[time]),
    warningNote: prescription.caution ?? undefined,
  };
}

export function MedicationProvider({ children }: PropsWithChildren) {
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const { selectedPet } = usePetStore();
  const [isReady, setIsReady] = useState(false);
  const [medications, setMedications] = useState<DiagnosisMedication[]>([]);
  const [visits, setVisits] = useState<RemoteVisit[]>([]);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [hasMedicationLoadError, setHasMedicationLoadError] = useState(false);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    if (!sessionReady) return;

    let active = true;
    setIsReady(false);
    setHasLoadError(false);
    setHasMedicationLoadError(false);
    setMedications([]);
    setVisits([]);

    if (!currentUserId || !selectedPet) {
      setIsReady(true);
      return () => {
        active = false;
      };
    }

    void getRemoteVisits(selectedPet.id)
      .then(async (nextVisits) => {
        const details = await Promise.allSettled(
          nextVisits
            .filter((visit) => visit.status === 'READY')
            .map((visit) => getRemoteVisitDetail(visit.id)),
        );
        if (!active) return;
        setVisits(nextVisits);
        setHasMedicationLoadError(details.some(({ status }) => status === 'rejected'));
        setMedications(details.flatMap((result) => (
          result.status === 'fulfilled'
            ? result.value.prescriptions.map((prescription) => mapRemotePrescriptionToMedication(
                prescription,
                `${result.value.id}:${prescription.id}`,
              ))
            : []
        )));
      })
      .catch(() => {
        if (active) {
          setHasLoadError(true);
          setHasMedicationLoadError(true);
        }
      })
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [currentUserId, request, selectedPet, sessionReady]);

  const clearScreenSession = useCallback(async () => {
    setMedications([]);
    setVisits([]);
    setHasLoadError(false);
    setHasMedicationLoadError(false);
    setIsReady(false);
  }, []);

  const reloadMedications = useCallback(() => {
    setRequest((current) => current + 1);
  }, []);

  return (
    <MedicationStoreContext.Provider
      value={{ clearScreenSession, hasLoadError, hasMedicationLoadError, isReady, medications, reloadMedications, visits }}
    >
      {children}
    </MedicationStoreContext.Provider>
  );
}

export function useMedicationStore(): MedicationStoreContextValue {
  const ctx = useContext(MedicationStoreContext);
  if (!ctx) throw new Error('useMedicationStore must be used inside MedicationProvider');
  return ctx;
}
