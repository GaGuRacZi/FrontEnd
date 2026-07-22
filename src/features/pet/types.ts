export type PetType = 'cat' | 'dog';
export type PetGender = 'female' | 'male';

export type PetFormValues = {
  birthDate: string;
  bloodType: string | null;
  breed: string;
  careAreas: string[];
  certificateImageUri: string | null;
  excludedIngredients: string[];
  gender: PetGender | null;
  name: string;
  neutered: boolean | null;
  ownerName: string;
  profileImageUri: string | null;
  registrationNumber: string;
  surgeries: string[];
  type: PetType | null;
  weight: string;
};

export type PetEntity = Omit<
  PetFormValues,
  'gender' | 'neutered' | 'type' | 'weight'
> & {
  createdAt: string;
  gender: PetGender;
  id: string;
  neutered: boolean;
  type: PetType;
  updatedAt: string;
  userId: string;
  weight: number;
};

export type PetDraft = PetFormValues & {
  id: string;
  petId: string | null;
  sourceUpdatedAt: string | null;
  userId: string;
};

export type StoredPetState = {
  pets: PetEntity[];
  selectedPetId: string | null;
};

export type PetSelectionField =
  | 'careAreas'
  | 'excludedIngredients'
  | 'surgeries';
