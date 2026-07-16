import { BrandLogoButton } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';

export function HomeScreen() {
  return <ScreenLayout headerFullWidth leftContent={<BrandLogoButton />} />;
}
