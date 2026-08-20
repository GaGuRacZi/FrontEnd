export type PetType = 'cat' | 'dog';
export type PetGender = 'female' | 'male';

export type PetFormValues = {
  birthDate: string;
  breed: string;
  gender: PetGender | null;
  name: string;
  neutered: boolean | null;
  profileImageUri: string | null;
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
