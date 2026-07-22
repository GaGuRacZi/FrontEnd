import { ScreenLayout } from '@/src/components/layout';
import { PetProfileSelector } from '@/src/features/pet/components';

export function MyPageScreen() {
  return (
    <ScreenLayout
      centerContent={<PetProfileSelector />}
      leftIcon="chatbubble-ellipses-outline"
    />
  );
}
