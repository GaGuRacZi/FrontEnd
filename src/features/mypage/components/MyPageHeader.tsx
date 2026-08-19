import { type Href, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { BrandLogoButton } from '@/src/components/common/BrandLogoButton';
import { ScreenLayout } from '@/src/components/layout';
import { PetProfileSelector } from '@/src/features/pet/components';

type MyPageHeaderProps = {
  children?: ReactNode;
  fallbackRoute?: Href;
  title?: string;
  variant?: 'root' | 'sub';
};

export function MyPageHeader({
  children,
  fallbackRoute = '/mypage',
  title,
  variant = 'sub',
}: MyPageHeaderProps) {
  const router = useRouter();

  if (variant === 'root') {
    return (
      <ScreenLayout
        centerContent={<PetProfileSelector />}
        headerFullWidth
        leftContent={<BrandLogoButton />}
        onRightPress={() => router.push('/notifications')}
        rightAccessibilityLabel="알림 열기"
        rightIcon="notifications-outline"
      >
        {children}
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      headerVariant="auth"
      leftAccessibilityLabel="이전 화면으로 돌아가기"
      leftIcon="chevron-back"
      onLeftPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace(fallbackRoute);
      }}
      rightContent={<View style={{ width: 44 }} />}
      title={title}
    >
      {children}
    </ScreenLayout>
  );
}
