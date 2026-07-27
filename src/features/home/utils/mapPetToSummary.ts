import type { PetEntity } from '@/src/features/pet/types';

import type { PetSummary } from '../types';
import { calculatePetAgeLabel } from './petAge';

export function mapPetEntityToSummary(pet: PetEntity): PetSummary {
  return {
    id: pet.id,
    name: pet.name,
    breedLabel: pet.breed,
    ageLabel: calculatePetAgeLabel(pet.birthDate),
    weightLabel: `${pet.weight}kg`,
    photoUrl: pet.profileImageUri ?? undefined,
  };
}