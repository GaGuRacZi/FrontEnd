import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';

import { BrandLogoButton } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { PetProfileSelector } from '@/src/features/pet/components';

export function HealthSummaryScreen() {
  const router = useRouter();

  return (
    <ScreenLayout
      centerContent={<PetProfileSelector />}
      headerFullWidth
      leftContent={<BrandLogoButton />}
      onRightPress={() => router.push('/notifications' as Href)}
      rightAccessibilityLabel="알림 열기"
    />
  );
}
