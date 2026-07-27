import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';

import {
  clearPendingPetImagePicker,
  removePetImage,
  removeUserPetImages,
} from './services/petImageStorage';
import { petRepository } from './services/petRepository';
import type { PetEntity, StoredPetState } from './types';

export const MAX_PETS_PER_USER = 10;

type PetMutationResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'conflict' | 'invalid' | 'last-pet' | 'limit' | 'not-found' | 'not-ready';
    };

type PetStoreContextValue = {
  addPet: (pet: PetEntity) => Promise<PetMutationResult>;
  clearDrafts: (userId?: string) => Promise<void>;
  deletePet: (petId: string) => Promise<PetMutationResult>;
  deleteUserPetData: (userId?: string) => Promise<void>;
  hasLoadError: boolean;
  isReady: boolean;
  pets: PetEntity[];
  registerSignupPet: (userId: string, pet: PetEntity) => Promise<void>;
  reloadPets: () => void;
  selectedPet: PetEntity | null;
  selectedPetId: string | null;
  selectPet: (petId: string) => Promise<PetMutationResult>;
  updatePet: (pet: PetEntity, expectedUpdatedAt?: string) => Promise<PetMutationResult>;
};

const PetStoreContext = createContext<PetStoreContextValue | null>(null);
const EMPTY_PETS: PetEntity[] = [];

function resolveSelection(pets: PetEntity[], selectedPetId: string | null) {
  if (selectedPetId && pets.some((pet) => pet.id === selectedPetId)) return selectedPetId;
  return pets[0]?.id ?? null;
}

function collectImageUris(pets: PetEntity[]) {
  return new Set(
    pets.flatMap((pet) =>
      [pet.profileImageUri, pet.certificateImageUri].filter(
        (uri): uri is string => Boolean(uri),
      ),
    ),
  );
}

export function PetProvider({ children }: PropsWithChildren) {
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const [pets, setPets] = useState<PetEntity[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadRequest, setLoadRequest] = useState(0);
  const activeUserRef = useRef<string | null>(null);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const petsRef = useRef<PetEntity[]>([]);
  const readyUserIdRef = useRef<string | null>(null);
  const selectedPetIdRef = useRef<string | null>(null);
  const loadRevisionRef = useRef(0);

  const applyState = useCallback((state: StoredPetState) => {
    const recoveredSelectedPetId = resolveSelection(state.pets, state.selectedPetId);
    petsRef.current = state.pets;
    selectedPetIdRef.current = recoveredSelectedPetId;
    setPets(state.pets);
    setSelectedPetId(recoveredSelectedPetId);
    return recoveredSelectedPetId;
  }, []);

  const invalidateActiveState = useCallback((userId: string) => {
    if (activeUserRef.current !== userId) return;

    loadRevisionRef.current += 1;
    readyUserIdRef.current = null;
    petsRef.current = [];
    selectedPetIdRef.current = null;
    setHasLoadError(false);
    setIsReady(false);
    setPets([]);
    setSelectedPetId(null);
  }, []);

  useEffect(() => {
    if (!sessionReady) return;

    let active = true;
    const loadRevision = loadRevisionRef.current + 1;
    loadRevisionRef.current = loadRevision;
    activeUserRef.current = currentUserId;
    readyUserIdRef.current = null;
    petsRef.current = [];
    selectedPetIdRef.current = null;
    setHasLoadError(false);
    setIsReady(false);
    setPets([]);
    setSelectedPetId(null);

    if (!currentUserId) {
      setIsReady(true);
      return () => {
        active = false;
      };
    }

    petRepository
      .loadState(currentUserId)
      .then(async (state) => {
        if (!active || loadRevisionRef.current !== loadRevision) return;
        readyUserIdRef.current = currentUserId;
        const recoveredSelectedPetId = applyState(state);

        if (recoveredSelectedPetId !== state.selectedPetId) {
          await petRepository
            .saveState(currentUserId, {
              pets: state.pets,
              selectedPetId: recoveredSelectedPetId,
            })
            .catch(() => undefined);
        }
      })
      .catch(() => {
        if (active && loadRevisionRef.current === loadRevision) {
          readyUserIdRef.current = null;
          setHasLoadError(true);
        }
      })
      .finally(() => {
        if (active && loadRevisionRef.current === loadRevision) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [applyState, currentUserId, loadRequest, sessionReady]);

  const reloadPets = useCallback(() => {
    if (currentUserId) setLoadRequest((current) => current + 1);
  }, [currentUserId]);

  const persist = useCallback(
    async (userId: string, nextPets: PetEntity[], nextSelectedPetId: string | null) => {
      await petRepository.saveState(userId, {
        pets: nextPets,
        selectedPetId: nextSelectedPetId,
      });

      if (activeUserRef.current === userId && readyUserIdRef.current === userId) {
        petsRef.current = nextPets;
        selectedPetIdRef.current = nextSelectedPetId;
        setPets(nextPets);
        setSelectedPetId(nextSelectedPetId);
      }
    },
    [],
  );

  const enqueueMutation = useCallback(<T,>(mutation: () => Promise<T>) => {
    const result = mutationQueueRef.current.then(mutation, mutation);
    mutationQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  const selectPet = useCallback(
    (petId: string) => {
      const userId = currentUserId;
      return enqueueMutation(async (): Promise<PetMutationResult> => {
        if (!userId || readyUserIdRef.current !== userId) {
          return { ok: false, reason: 'not-ready' };
        }

        const currentPets = petsRef.current;
        if (!currentPets.some((pet) => pet.id === petId)) {
          return { ok: false, reason: 'not-found' };
        }
        if (selectedPetIdRef.current === petId) return { ok: true };

        await persist(userId, currentPets, petId);
        return { ok: true };
      });
    },
    [currentUserId, enqueueMutation, persist],
  );

  const addPet = useCallback(
    (pet: PetEntity) => {
      const userId = currentUserId;
      return enqueueMutation(async (): Promise<PetMutationResult> => {
        if (!userId || readyUserIdRef.current !== userId) {
          return { ok: false, reason: 'not-ready' };
        }
        if (pet.userId !== userId) return { ok: false, reason: 'invalid' };

        const currentPets = petsRef.current;
        if (currentPets.some((current) => current.id === pet.id)) {
          return { ok: false, reason: 'invalid' };
        }
        if (currentPets.length >= MAX_PETS_PER_USER) {
          return { ok: false, reason: 'limit' };
        }

        const nextPets = [...currentPets, pet];
        await persist(userId, nextPets, pet.id);
        return { ok: true };
      });
    },
    [currentUserId, enqueueMutation, persist],
  );

  const updatePet = useCallback(
    (pet: PetEntity, expectedUpdatedAt?: string) => {
      const userId = currentUserId;
      return enqueueMutation(async (): Promise<PetMutationResult> => {
        if (!userId || readyUserIdRef.current !== userId) {
          return { ok: false, reason: 'not-ready' };
        }
        if (pet.userId !== userId) return { ok: false, reason: 'invalid' };

        const currentPets = petsRef.current;
        const previous = currentPets.find((current) => current.id === pet.id);
        if (!previous) return { ok: false, reason: 'not-found' };
        if (expectedUpdatedAt && previous.updatedAt !== expectedUpdatedAt) {
          return { ok: false, reason: 'conflict' };
        }

        const nextPets = currentPets.map((current) => (current.id === pet.id ? pet : current));
        await persist(
          userId,
          nextPets,
          resolveSelection(nextPets, selectedPetIdRef.current),
        );

        const referencedImages = collectImageUris(nextPets);
        if (
          previous.profileImageUri !== pet.profileImageUri &&
          previous.profileImageUri &&
          !referencedImages.has(previous.profileImageUri)
        ) {
          await removePetImage(userId, previous.profileImageUri).catch(() => undefined);
        }
        if (
          previous.certificateImageUri !== pet.certificateImageUri &&
          previous.certificateImageUri &&
          !referencedImages.has(previous.certificateImageUri)
        ) {
          await removePetImage(userId, previous.certificateImageUri).catch(() => undefined);
        }
        return { ok: true };
      });
    },
    [currentUserId, enqueueMutation, persist],
  );

  const deletePet = useCallback(
    (petId: string) => {
      const userId = currentUserId;
      return enqueueMutation(async (): Promise<PetMutationResult> => {
        if (!userId || readyUserIdRef.current !== userId) {
          return { ok: false, reason: 'not-ready' };
        }

        const currentPets = petsRef.current;
        const target = currentPets.find((pet) => pet.id === petId);
        if (!target) return { ok: false, reason: 'not-found' };
        if (currentPets.length === 1) return { ok: false, reason: 'last-pet' };

        const editDraftId = `edit-${petId}`;
        const editDraft = await petRepository
          .loadDraft(userId, editDraftId)
          .catch(() => null);
        const nextPets = currentPets.filter((pet) => pet.id !== petId);
        const currentSelectedPetId = selectedPetIdRef.current;
        const nextSelectedPetId =
          currentSelectedPetId === petId
            ? nextPets[0].id
            : resolveSelection(nextPets, currentSelectedPetId);
        await persist(userId, nextPets, nextSelectedPetId);
        const referencedImages = collectImageUris(nextPets);
        const imagesToRemove = Array.from(
          new Set(
            [
              target.profileImageUri,
              target.certificateImageUri,
              editDraft?.profileImageUri,
              editDraft?.certificateImageUri,
            ]
              .filter((uri): uri is string => Boolean(uri))
              .filter((uri) => !referencedImages.has(uri)),
          ),
        );
        await Promise.allSettled([
          petRepository.deleteDraft(userId, editDraftId),
          clearPendingPetImagePicker(userId, editDraftId),
          ...imagesToRemove.map((uri) => removePetImage(userId, uri)),
        ]);
        return { ok: true };
      });
    },
    [currentUserId, enqueueMutation, persist],
  );

  const registerSignupPet = useCallback(
    (userId: string, pet: PetEntity) =>
      enqueueMutation(async () => {
        if (pet.userId !== userId) throw new Error('invalid-pet-owner');

        const state = await petRepository.loadState(userId);
        const existingIndex = state.pets.findIndex((current) => current.id === pet.id);
        const nextPets = [...state.pets];

        if (existingIndex >= 0) nextPets[existingIndex] = pet;
        else {
          if (nextPets.length >= MAX_PETS_PER_USER) throw new Error('pet-limit');
          nextPets.push(pet);
        }

        await petRepository.saveState(userId, { pets: nextPets, selectedPetId: pet.id });

        if (activeUserRef.current === userId) {
          loadRevisionRef.current += 1;
          readyUserIdRef.current = userId;
          applyState({ pets: nextPets, selectedPetId: pet.id });
          setHasLoadError(false);
          setIsReady(true);
        }
      }),
    [applyState, enqueueMutation],
  );

  const clearDrafts = useCallback(
    async (userId = currentUserId ?? undefined) => {
      if (!userId) return;

      const [draftsResult, stateResult] = await Promise.allSettled([
        petRepository.loadDrafts(userId),
        petRepository.loadState(userId),
      ]);

      await petRepository.clearDrafts(userId);

      if (draftsResult.status === 'fulfilled' && stateResult.status === 'fulfilled') {
        const savedImages = new Set(
          stateResult.value.pets.flatMap((pet) =>
            [pet.profileImageUri, pet.certificateImageUri].filter(
              (uri): uri is string => Boolean(uri),
            ),
          ),
        );
        const draftImages = draftsResult.value.flatMap((draft) => [
          draft.profileImageUri,
          draft.certificateImageUri,
        ]);

        await Promise.allSettled(
          draftImages.map((uri) =>
            uri && !savedImages.has(uri) ? removePetImage(userId, uri) : Promise.resolve(),
          ),
        );
      }

      await clearPendingPetImagePicker(userId).catch(() => undefined);
    },
    [currentUserId],
  );

  const deleteUserPetData = useCallback(
    (userId = currentUserId ?? undefined) => {
      if (!userId) return Promise.resolve();

      invalidateActiveState(userId);

      return enqueueMutation(async () => {
        invalidateActiveState(userId);
        try {
          await petRepository.deleteUser(userId);
          await Promise.allSettled([
            removeUserPetImages(userId),
            clearPendingPetImagePicker(userId),
          ]);
          invalidateActiveState(userId);
        } catch (error) {
          if (activeUserRef.current === userId) {
            const recoveryRevision = loadRevisionRef.current;
            try {
              const restoredState = await petRepository.loadState(userId);
              if (
                activeUserRef.current === userId &&
                loadRevisionRef.current === recoveryRevision
              ) {
                readyUserIdRef.current = userId;
                applyState(restoredState);
                setHasLoadError(false);
                setIsReady(true);
              }
            } catch {
              if (
                activeUserRef.current === userId &&
                loadRevisionRef.current === recoveryRevision
              ) {
                readyUserIdRef.current = null;
                setHasLoadError(true);
                setIsReady(true);
              }
            }
          }
          throw error;
        }
      });
    },
    [applyState, currentUserId, enqueueMutation, invalidateActiveState],
  );

  const stateMatchesSession = Boolean(
    currentUserId && readyUserIdRef.current === currentUserId,
  );
  const visiblePets = stateMatchesSession ? pets : EMPTY_PETS;
  const visibleSelectedPetId = stateMatchesSession ? selectedPetId : null;
  const selectedPet = useMemo(
    () => visiblePets.find((pet) => pet.id === visibleSelectedPetId) ?? null,
    [visiblePets, visibleSelectedPetId],
  );
  const storeReady = sessionReady && (!currentUserId || isReady);

  const value = useMemo<PetStoreContextValue>(
    () => ({
      addPet,
      clearDrafts,
      deletePet,
      deleteUserPetData,
      hasLoadError,
      isReady: storeReady,
      pets: visiblePets,
      registerSignupPet,
      reloadPets,
      selectedPet,
      selectedPetId: visibleSelectedPetId,
      selectPet,
      updatePet,
    }),
    [
      addPet,
      clearDrafts,
      deletePet,
      deleteUserPetData,
      hasLoadError,
      registerSignupPet,
      reloadPets,
      selectedPet,
      selectPet,
      storeReady,
      updatePet,
      visiblePets,
      visibleSelectedPetId,
    ],
  );

  return <PetStoreContext.Provider value={value}>{children}</PetStoreContext.Provider>;
}

export function usePetStore() {
  const context = useContext(PetStoreContext);

  if (!context) {
    throw new Error('usePetStore must be used inside PetProvider.');
  }

  return context;
}
