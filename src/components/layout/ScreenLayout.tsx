import type { PropsWithChildren, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import type { AppIconName } from '@/src/components/common/AppIcon';
import { LAYOUT, SPACING } from '@/src/constants';

import { AppScreen } from './AppScreen';
import { TopHeader } from './TopHeader';

type ScreenLayoutProps = PropsWithChildren<{
  headerFullWidth?: boolean;
  headerVariant?: 'auth' | 'tab';
  leftAccessibilityLabel?: string;
  leftContent?: ReactNode;
  leftIcon?: AppIconName;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  rightAccessibilityLabel?: string;
  rightContent?: ReactNode;
  rightIcon?: AppIconName;
  title?: string;
}>;

export function ScreenLayout({
  children,
  headerFullWidth = false,
  headerVariant = 'tab',
  leftAccessibilityLabel,
  leftContent,
  leftIcon,
  onLeftPress,
  onRightPress,
  rightAccessibilityLabel,
  rightContent,
  rightIcon,
  title,
}: ScreenLayoutProps) {
  const router = useRouter();
  const isAuth = headerVariant === 'auth';
  const handleLeftPress =
    onLeftPress ??
    (isAuth
      ? () => {
          if (router.canGoBack()) {
            router.back();
          }
        }
      : undefined);

  return (
    <AppScreen edges={isAuth ? undefined : ['top', 'left', 'right']}>
      <TopHeader
        leftAccessibilityLabel={leftAccessibilityLabel ?? (isAuth ? '뒤로가기' : undefined)}
        leftContent={leftContent}
        leftIcon={leftIcon ?? (isAuth ? 'chevron-back' : undefined)}
        onLeftPress={handleLeftPress}
        onRightPress={onRightPress}
        rightAccessibilityLabel={rightAccessibilityLabel ?? '알림 열기'}
        rightContent={rightContent}
        rightIcon={rightIcon ?? (isAuth ? undefined : 'notifications-outline')}
        style={headerFullWidth ? styles.fullWidthHeader : undefined}
        title={title}
      />
      {children}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  fullWidthHeader: {
    marginHorizontal: -LAYOUT.screenPaddingHorizontal,
    paddingLeft: SPACING.lg,
    paddingRight: LAYOUT.screenPaddingHorizontal,
  },
});
