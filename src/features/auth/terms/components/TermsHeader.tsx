import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler, Platform, StyleSheet } from 'react-native';

import { TopHeader } from '@/src/components/layout/TopHeader';
import { SPACING } from '@/src/constants';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

type TermsHeaderProps = {
  disabled?: boolean;
  fallbackRoute: '/' | '/login' | '/signup/terms';
  title?: string;
};

export function TermsHeader({ disabled = false, fallbackRoute, title }: TermsHeaderProps) {
  const navigation = useNavigation();
  const router = useRouter();
  const navigateOnce = useNavigationLock();

  const handleBack = useCallback(() => {
    if (disabled) return;

    navigateOnce(() => {
      if (router.canGoBack()) {
        router.back();
        return;
      }

      router.replace(fallbackRoute);
    });
  }, [disabled, fallbackRoute, navigateOnce, router]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !disabled });

    return () => navigation.setOptions({ gestureEnabled: true });
  }, [disabled, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });

      return () => subscription.remove();
    }, [handleBack]),
  );

  return (
    <TopHeader
      leftAccessibilityLabel="뒤로가기"
      leftDisabled={disabled}
      leftIcon="chevron-back"
      onLeftPress={handleBack}
      style={styles.header}
      title={title}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    marginHorizontal: SPACING.xxl,
    marginTop: SPACING.xl,
  },
});
