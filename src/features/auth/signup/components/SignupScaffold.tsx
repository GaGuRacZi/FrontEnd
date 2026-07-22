import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { BackHandler, Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { SignupProgress } from '@/src/components/form/SignupProgress';
import { FormScreen } from '@/src/components/layout/FormScreen';
import { TopHeader } from '@/src/components/layout/TopHeader';
import { COLORS, LAYOUT, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

type SignupScaffoldProps = PropsWithChildren<{
  bodyStyle?: StyleProp<ViewStyle>;
  buttonTitle?: string;
  currentStep: number;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  onNext: () => void | Promise<void>;
  title: string;
}>;

export function SignupScaffold({
  bodyStyle,
  buttonTitle = '다음',
  children,
  currentStep,
  nextDisabled = false,
  nextLoading = false,
  onNext,
  title,
}: SignupScaffoldProps) {
  const router = useRouter();
  const navigateOnce = useNavigationLock();

  const handleBack = useCallback(() => {
    navigateOnce(() => {
      if (router.canGoBack()) {
        router.back();
        return;
      }

      router.replace('/login');
    });
  }, [navigateOnce, router]);

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
    <FormScreen
      contentContainerStyle={styles.content}
      footer={
        <View style={styles.buttonContainer}>
          <AppButton
            disabled={nextDisabled}
            loading={nextLoading}
            onPress={() => navigateOnce(onNext)}
            title={buttonTitle}
          />
        </View>
      }
      header={
        <TopHeader
          leftAccessibilityLabel="이전 단계로 이동"
          leftIcon="chevron-back"
          onLeftPress={handleBack}
          style={styles.header}
        />
      }
    >
      <View style={styles.heading}>
        <Text style={styles.title}>{title}</Text>
        <SignupProgress currentStep={currentStep} />
      </View>
      <View style={[styles.body, bodyStyle]}>{children}</View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginHorizontal: SPACING.xxl,
    marginTop: SPACING.xl,
  },
  content: {
    paddingBottom: SPACING.xxxl,
    paddingHorizontal: LAYOUT.authContentPaddingHorizontal,
    paddingTop: 50,
  },
  heading: {
    gap: 42,
  },
  title: {
    ...TYPOGRAPHY.authTitle,
    color: COLORS.black,
    minHeight: 64,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  body: {
    flex: 1,
    width: '100%',
  },
  buttonContainer: {
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
});
