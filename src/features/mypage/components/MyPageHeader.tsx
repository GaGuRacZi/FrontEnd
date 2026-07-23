import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { View } from 'react-native';

import { BrandLogoButton } from '@/src/components/common/BrandLogoButton';
import { ScreenLayout } from '@/src/components/layout';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { PetProfileSelector } from '@/src/features/pet/components';

type MyPageHeaderProps = {
  children?: ReactNode;
  title?: string;
  variant?: 'root' | 'sub';
};

export function MyPageHeader({ children, title, variant = 'sub' }: MyPageHeaderProps) {
  const router = useRouter();
  const { currentUserId, isReady } = useAuthSession();

  useEffect(() => {
    if (isReady && !currentUserId) router.replace('/');
  }, [currentUserId, isReady, router]);

  if (variant === 'root') {
    return (
      <ScreenLayout
        centerContent={<PetProfileSelector />}
        headerFullWidth
        leftContent={<BrandLogoButton />}
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
        else router.replace('/mypage');
      }}
      rightContent={<View style={{ width: 44 }} />}
      title={title}
    >
      {children}
    </ScreenLayout>
  );
}
