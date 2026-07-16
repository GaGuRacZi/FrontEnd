import { BrandLogoButton } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';

export function DashboardScreen() {
  return (
    <ScreenLayout
      headerFullWidth
      leftContent={<BrandLogoButton />}
      title="진료 요약"
    />
  );
}
