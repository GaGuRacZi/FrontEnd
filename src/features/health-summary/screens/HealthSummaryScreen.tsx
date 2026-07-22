import { BrandLogoButton } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { PetProfileSelector } from '@/src/features/pet/components';

export function HealthSummaryScreen() {
  return (
    <ScreenLayout
      centerContent={<PetProfileSelector />}
      headerFullWidth
      leftContent={<BrandLogoButton />}
    />
  );
}
