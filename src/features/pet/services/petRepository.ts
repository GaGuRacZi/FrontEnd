import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PetDraft, PetEntity, PetGender, PetType, StoredPetState } from '../types';

const PET_STATE_PREFIX = 'paw:pets:';
const PET_DRAFT_PREFIX = 'paw:pet-draft:';

export interface PetRepository {
  clearDrafts(userId: string): Promise<void>;
  deleteDraft(userId: string, draftId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  loadDraft(userId: string, draftId: string): Promise<PetDraft | null>;
  loadDrafts(userId: string): Promise<PetDraft[]>;
  loadState(userId: string): Promise<StoredPetState>;
  saveDraft(draft: PetDraft): Promise<void>;
  saveState(userId: string, state: StoredPetState): Promise<void>;
}

function stateKey(userId: string) {
  return `${PET_STATE_PREFIX}${encodeURIComponent(userId)}`;
}

function draftKey(userId: string, draftId: string) {
  return `${PET_DRAFT_PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(draftId)}`;
}

function draftPrefix(userId: string) {
  return `${PET_DRAFT_PREFIX}${encodeURIComponent(userId)}:`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function readNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value.flatMap((item) => {
        const normalized = readRequiredString(item);
        return normalized ? [normalized] : [];
      }),
    ),
  );
}

function isPetType(value: unknown): value is PetType {
  return value === 'cat' || value === 'dog';
}

function isPetGender(value: unknown): value is PetGender {
  return value === 'female' || value === 'male';
}

function adaptPetEntity(value: unknown, userId: string): PetEntity | null {
  if (!isRecord(value)) return null;

  const id = readRequiredString(value.id);
  const storedUserId = readRequiredString(value.userId);
  const birthDate = readRequiredString(value.birthDate);
  const breed = readRequiredString(value.breed);
  const createdAt = readRequiredString(value.createdAt);
  const name = readRequiredString(value.name);
  const updatedAt = readRequiredString(value.updatedAt);
  const weight = value.weight;

  if (
    !id ||
    storedUserId !== userId ||
    !birthDate ||
    !breed ||
    !createdAt ||
    !name ||
    !updatedAt ||
    !isPetType(value.type) ||
    !isPetGender(value.gender) ||
    typeof value.neutered !== 'boolean' ||
    typeof weight !== 'number' ||
    !Number.isFinite(weight) ||
    weight <= 0 ||
    weight > 200
  ) {
    return null;
  }

  return {
    birthDate,
    bloodType: readNullableString(value.bloodType),
    breed,
    careAreas: readStringArray(value.careAreas),
    certificateImageUri: readNullableString(value.certificateImageUri),
    createdAt,
    excludedIngredients: readStringArray(value.excludedIngredients),
    gender: value.gender,
    id,
    name,
    neutered: value.neutered,
    ownerName: readString(value.ownerName),
    profileImageUri: readNullableString(value.profileImageUri),
    registrationNumber: readString(value.registrationNumber),
    surgeries: readStringArray(value.surgeries),
    type: value.type,
    updatedAt,
    userId,
    weight,
  };
}

function adaptPetDraft(value: unknown, userId: string): PetDraft | null {
  if (!isRecord(value)) return null;

  const id = readRequiredString(value.id);
  const storedUserId = readRequiredString(value.userId);
  const petId = value.petId;

  if (
    !id ||
    storedUserId !== userId ||
    (petId !== null && petId !== undefined && typeof petId !== 'string') ||
    (value.type !== null && value.type !== undefined && !isPetType(value.type)) ||
    (value.gender !== null && value.gender !== undefined && !isPetGender(value.gender)) ||
    (value.neutered !== null &&
      value.neutered !== undefined &&
      typeof value.neutered !== 'boolean')
  ) {
    return null;
  }

  return {
    birthDate: readString(value.birthDate),
    bloodType: readNullableString(value.bloodType),
    breed: readString(value.breed),
    careAreas: readStringArray(value.careAreas),
    certificateImageUri: readNullableString(value.certificateImageUri),
    excludedIngredients: readStringArray(value.excludedIngredients),
    gender: value.gender ?? null,
    id,
    name: readString(value.name),
    neutered: value.neutered ?? null,
    ownerName: readString(value.ownerName),
    petId: typeof petId === 'string' && petId.trim() ? petId : null,
    profileImageUri: readNullableString(value.profileImageUri),
    registrationNumber: readString(value.registrationNumber),
    sourceUpdatedAt: readNullableString(value.sourceUpdatedAt),
    surgeries: readStringArray(value.surgeries),
    type: value.type ?? null,
    userId,
    weight:
      typeof value.weight === 'string'
        ? value.weight
        : typeof value.weight === 'number' && Number.isFinite(value.weight)
          ? String(value.weight)
          : '',
  };
}

function adaptStoredState(value: unknown, userId: string): StoredPetState | null {
  if (!isRecord(value) || !Array.isArray(value.pets)) return null;

  const petIds = new Set<string>();
  const pets = value.pets.flatMap((item) => {
    const pet = adaptPetEntity(item, userId);
    if (!pet || petIds.has(pet.id)) return [];

    petIds.add(pet.id);
    return [pet];
  });
  const selectedPetId = readNullableString(value.selectedPetId);

  return {
    pets,
    selectedPetId: selectedPetId && petIds.has(selectedPetId) ? selectedPetId : null,
  };
}

class LocalPetRepository implements PetRepository {
  async loadState(userId: string) {
    const stored = await AsyncStorage.getItem(stateKey(userId));

    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        const state = adaptStoredState(parsed, userId);

        if (state) {
          if (JSON.stringify(state) !== JSON.stringify(parsed)) {
            await AsyncStorage.setItem(stateKey(userId), JSON.stringify(state)).catch(
              () => undefined,
            );
          }
          return state;
        }

        await AsyncStorage.removeItem(stateKey(userId));
      } catch {
        await AsyncStorage.removeItem(stateKey(userId));
      }
    }

    return { pets: [], selectedPetId: null };
  }

  async saveState(userId: string, state: StoredPetState) {
    await AsyncStorage.setItem(stateKey(userId), JSON.stringify(state));
  }

  async loadDraft(userId: string, draftId: string) {
    const stored = await AsyncStorage.getItem(draftKey(userId, draftId));
    if (!stored) return null;

    try {
      const parsed: unknown = JSON.parse(stored);
      const draft = adaptPetDraft(parsed, userId);

      if (!draft || draft.id !== draftId) {
        await this.deleteDraft(userId, draftId);
        return null;
      }

      if (JSON.stringify(draft) !== JSON.stringify(parsed)) {
        await this.saveDraft(draft).catch(() => undefined);
      }
      return draft;
    } catch {
      await this.deleteDraft(userId, draftId);
      return null;
    }
  }

  async saveDraft(draft: PetDraft) {
    await AsyncStorage.setItem(draftKey(draft.userId, draft.id), JSON.stringify(draft));
  }

  async loadDrafts(userId: string) {
    const keys = await AsyncStorage.getAllKeys();
    const prefix = draftPrefix(userId);
    const draftKeys = keys.filter((key) => key.startsWith(prefix));
    const storedDrafts = draftKeys.length ? await AsyncStorage.multiGet(draftKeys) : [];

    const drafts: PetDraft[] = [];
    const invalidKeys: string[] = [];
    const normalizedEntries: [string, string][] = [];

    storedDrafts.forEach(([key, stored]) => {
      if (!stored) {
        invalidKeys.push(key);
        return;
      }

      try {
        const parsed: unknown = JSON.parse(stored);
        const draft = adaptPetDraft(parsed, userId);

        if (!draft || key !== draftKey(userId, draft.id)) {
          invalidKeys.push(key);
          return;
        }

        drafts.push(draft);
        if (JSON.stringify(draft) !== JSON.stringify(parsed)) {
          normalizedEntries.push([key, JSON.stringify(draft)]);
        }
      } catch {
        invalidKeys.push(key);
      }
    });

    await Promise.allSettled([
      invalidKeys.length ? AsyncStorage.multiRemove(invalidKeys) : Promise.resolve(),
      normalizedEntries.length ? AsyncStorage.multiSet(normalizedEntries) : Promise.resolve(),
    ]);

    return drafts;
  }

  async deleteDraft(userId: string, draftId: string) {
    await AsyncStorage.removeItem(draftKey(userId, draftId));
  }

  async clearDrafts(userId: string) {
    const keys = await AsyncStorage.getAllKeys();
    const prefix = draftPrefix(userId);
    const draftKeys = keys.filter((key) => key.startsWith(prefix));
    if (draftKeys.length) await AsyncStorage.multiRemove(draftKeys);
  }

  async deleteUser(userId: string) {
    await this.clearDrafts(userId);
    await AsyncStorage.removeItem(stateKey(userId));
  }
}

export const petRepository: PetRepository = new LocalPetRepository();
