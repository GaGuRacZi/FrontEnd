import { useLocalSearchParams } from 'expo-router';

import { PetFormScreen } from '@/src/features/pet/screens/PetFormScreen';

export default function EditPetRoute() {
  const { petId } = useLocalSearchParams<{ petId: string | string[] }>();
  const resolvedPetId = Array.isArray(petId) ? petId[0] : petId;

  return <PetFormScreen mode="edit" petId={resolvedPetId ?? ''} />;
}
