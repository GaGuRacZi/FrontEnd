import { apiRequest } from '@/src/services/apiClient';
import { appendMultipartImage, appendMultipartJson } from '@/src/utils/file';

import type { PetEntity, PetGender, PetType } from '../types';

export type RemotePet = {
  birthDate: string;
  breed: string;
  gender: PetGender;
  id: string;
  name: string;
  neutered: boolean;
  profileImageUri: string | null;
  type: PetType;
  weight: number;
};

export type RemoteBreed = {
  id: number;
  name: string;
  popular: boolean;
  type: PetType;
};

export class PetApiContractError extends Error {
  constructor() {
    super('Invalid pet API response.');
    this.name = 'PetApiContractError';
  }
}

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PetApiContractError();
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new PetApiContractError();
  return value.trim();
}

function readEnvelope(value: unknown, expectedCode: string) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true || envelope.code !== expectedCode) {
    throw new PetApiContractError();
  }
  return envelope.result;
}

function readRemotePet(value: unknown): RemotePet {
  const pet = readRecord(value);
  const id = pet.petId;
  const type = pet.petType;
  const gender = pet.gender;
  const profileUrl = pet.profileUrl;

  if (
    typeof id !== 'number' ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    (type !== 'DOG' && type !== 'CAT') ||
    (gender !== 'MALE' && gender !== 'FEMALE') ||
    typeof pet.petWeight !== 'number' ||
    !Number.isFinite(pet.petWeight) ||
    pet.petWeight <= 0 ||
    typeof pet.neutering !== 'boolean' ||
    (profileUrl !== null && profileUrl !== undefined && typeof profileUrl !== 'string')
  ) {
    throw new PetApiContractError();
  }

  const birthDate = readString(pet.birth);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw new PetApiContractError();

  return {
    birthDate,
    breed: readString(pet.breedName),
    gender: gender === 'MALE' ? 'male' : 'female',
    id: String(id),
    name: readString(pet.petName),
    neutered: pet.neutering,
    profileImageUri: typeof profileUrl === 'string' && profileUrl.trim() ? profileUrl.trim() : null,
    type: type === 'DOG' ? 'dog' : 'cat',
    weight: pet.petWeight,
  };
}

function createPetFormData(pet: PetEntity, imageUri?: string | null) {
  const birth = pet.birthDate.replace(/\./g, '-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !pet.breed.trim()) {
    throw new PetApiContractError();
  }

  const formData = new FormData();
  appendMultipartJson(formData, {
    birth,
    breed: pet.breed.trim(),
    gender: pet.gender.toUpperCase(),
    neutering: pet.neutered,
    petName: pet.name.trim(),
    petType: pet.type.toUpperCase(),
    petWeight: pet.weight,
  });
  if (imageUri) {
    appendMultipartImage(formData, 'image', imageUri);
  }
  return formData;
}

export function parseRemotePetEnvelope(value: unknown, expectedCode: 'PET_CREATE_200' | 'PET_UPDATE_200') {
  return readRemotePet(readEnvelope(value, expectedCode));
}

export function parseRemoteBreedEnvelope(value: unknown): RemoteBreed[] {
  const result = readEnvelope(value, 'BREED_SEARCH_200');
  if (!Array.isArray(result)) throw new PetApiContractError();

  return result.map((value) => {
    const breed = readRecord(value);
    if (
      typeof breed.breedId !== 'number' ||
      !Number.isSafeInteger(breed.breedId) ||
      breed.breedId <= 0 ||
      (breed.petType !== 'DOG' && breed.petType !== 'CAT') ||
      typeof breed.popular !== 'boolean'
    ) {
      throw new PetApiContractError();
    }
    return {
      id: breed.breedId,
      name: readString(breed.name),
      popular: breed.popular,
      type: breed.petType === 'DOG' ? 'dog' : 'cat',
    };
  });
}

export async function createRemotePet(pet: PetEntity) {
  const response = await apiRequest<unknown>('/pets', {
    body: createPetFormData(pet, pet.profileImageUri),
    method: 'POST',
  });
  return parseRemotePetEnvelope(response, 'PET_CREATE_200');
}

export async function updateRemotePet(previous: PetEntity, next: PetEntity) {
  const petId = Number(next.id);
  if (!Number.isSafeInteger(petId) || petId <= 0) throw new PetApiContractError();

  const imageUri = previous.profileImageUri !== next.profileImageUri
    ? next.profileImageUri
    : undefined;
  const response = await apiRequest<unknown>(`/pets/${petId}`, {
    body: createPetFormData(next, imageUri),
    method: 'PUT',
  });
  return parseRemotePetEnvelope(response, 'PET_UPDATE_200');
}

export async function searchRemoteBreeds(type: PetType, query = '') {
  const params = new URLSearchParams({ petType: type.toUpperCase() });
  if (query.trim()) params.set('q', query.trim());

  const response = await apiRequest<unknown>(`/breeds?${params.toString()}`);
  return parseRemoteBreedEnvelope(response).filter((breed) => breed.type === type);
}
