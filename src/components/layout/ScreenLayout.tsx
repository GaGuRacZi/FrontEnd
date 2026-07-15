import type { PropsWithChildren, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import type { AppIconName } from '@/src/components/common/AppIcon';
import { LAYOUT, SPACING } from '@/src/constants';

import { AppScreen } from './AppScreen';
import { TopHeader } from './TopHeader';

type LeftHeaderActionProps =
  | { leftAccessibilityLabel: string; onLeftPress: () => void }
  | { leftAccessibilityLabel?: string; onLeftPress?: undefined };

type RightHeaderActionProps =
  | { onRightPress: () => void; rightAccessibilityLabel: string }
  | { onRightPress?: undefined; rightAccessibilityLabel?: string };

type ScreenLayoutProps = PropsWithChildren<
  {
    headerFullWidth?: boolean;
    headerVariant?: 'auth' | 'tab';
    leftContent?: ReactNode;
    leftIcon?: AppIconName;
    rightContent?: ReactNode;
    rightIcon?: AppIconName;
    title?: string;
  } & LeftHeaderActionProps &
    RightHeaderActionProps
>;

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
  const canGoBack = isAuth && router.canGoBack();
  const handleLeftPress =
    onLeftPress ??
    (canGoBack
      ? () => {
          router.back();
        }
      : undefined);
  const resolvedLeftIcon = leftIcon ?? (isAuth && handleLeftPress ? 'chevron-back' : undefined);
  const leftActionProps = handleLeftPress
    ? {
        leftAccessibilityLabel: leftAccessibilityLabel ?? '뒤로가기',
        onLeftPress: handleLeftPress,
      }
    : {};
  const rightActionProps = onRightPress
    ? {
        onRightPress,
        rightAccessibilityLabel: rightAccessibilityLabel ?? '알림 열기',
      }
    : {};

  return (
    <AppScreen edges={isAuth ? undefined : ['top', 'left', 'right']}>
      <TopHeader
        {...leftActionProps}
        {...rightActionProps}
        leftContent={leftContent}
        leftIcon={resolvedLeftIcon}
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
