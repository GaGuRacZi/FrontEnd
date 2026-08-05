import type { UserProfile } from '@/src/features/mypage/types';
import type { PetEntity } from '@/src/features/pet/types';

import type { CommunityAuthorSnapshot } from '../types';

export function createCommunityAuthor(
  profile: UserProfile | null,
  selectedPet: PetEntity | null,
  userId: string,
): CommunityAuthorSnapshot {
  return {
    introduction: profile?.introduction.trim() || undefined,
    location: profile?.location || undefined,
    nickname: profile?.nickname || '파우 보호자',
    petName: selectedPet?.name,
    profileImageUri: profile?.profileImageUri ?? null,
    userId,
  };
}
