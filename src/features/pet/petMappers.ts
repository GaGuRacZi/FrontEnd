import type { SignupData } from '@/src/features/auth/signup/SignupContext';

import type { RemotePet } from './services/petApi';
import type { PetDraft, PetEntity, PetFormValues } from './types';

function createPetId() {
  return `pet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyPetValues(): PetFormValues {
  return {
    birthDate: '',
    breed: '',
    gender: null,
    name: '',
    neutered: null,
    profileImageUri: null,
    type: null,
    weight: '',
  };
}

export function createPetDraft(userId: string, pet?: PetEntity): PetDraft {
  if (!pet) {
    return {
      ...createEmptyPetValues(),
      id: `add-${userId}`,
      petId: null,
      sourceUpdatedAt: null,
      userId,
    };
  }

  return {
    birthDate: pet.birthDate,
    breed: pet.breed,
    gender: pet.gender,
    id: `edit-${pet.id}`,
    name: pet.name,
    neutered: pet.neutered,
    petId: pet.id,
    profileImageUri: pet.profileImageUri,
    sourceUpdatedAt: pet.updatedAt,
    type: pet.type,
    userId,
    weight: String(pet.weight),
  };
}

export function petDraftToEntity(draft: PetDraft, previous?: PetEntity): PetEntity {
  const now = new Date().toISOString();

  return {
    birthDate: draft.birthDate,
    breed: draft.breed,
    createdAt: previous?.createdAt ?? now,
    gender: draft.gender!,
    id: previous?.id ?? createPetId(),
    name: draft.name.trim(),
    neutered: draft.neutered!,
    profileImageUri: draft.profileImageUri,
    type: draft.type!,
    updatedAt: now,
    userId: draft.userId,
    weight: Number(draft.weight),
  };
}

export function signupDataToPetEntity(data: SignupData, userId: string): PetEntity {
  const draft: PetDraft = {
    ...createEmptyPetValues(),
    birthDate: data.birthDate,
    breed: data.breed,
    gender: data.petGender,
    id: `signup-${userId}`,
    name: data.petName,
    neutered: data.neutered,
    petId: null,
    sourceUpdatedAt: null,
    type: data.petType,
    userId,
    weight: data.weight,
  };

  return {
    ...petDraftToEntity(draft),
    id: `initial-${userId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
  };
}

export function mergeRemotePet(current: PetEntity, remote: RemotePet): PetEntity {
  return {
    ...current,
    birthDate: remote.birthDate.replace(/-/g, '.'),
    breed: remote.breed,
    gender: remote.gender,
    id: remote.id,
    name: remote.name,
    neutered: remote.neutered,
    profileImageUri: remote.profileImageUri,
    type: remote.type,
    updatedAt: new Date().toISOString(),
    weight: remote.weight,
  };
}
