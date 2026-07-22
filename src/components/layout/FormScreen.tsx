import type { PropsWithChildren, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, LAYOUT, SIZE, SPACING } from '@/src/constants';

import { AppScreen } from './AppScreen';
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView';

type FormScreenProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  footerContainerStyle?: StyleProp<ViewStyle>;
  header?: ReactNode;
  keyboardVerticalOffset?: number;
}>;

export function FormScreen({
  children,
  contentContainerStyle,
  footer,
  footerContainerStyle,
  header,
  keyboardVerticalOffset = 0,
}: FormScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <AppScreen edges={footer ? ['top', 'left', 'right'] : undefined} padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.keyboardView}
      >
        {header}
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.content, contentContainerStyle]}
          extraScrollHeight={footer ? SIZE.buttonHeight + SPACING.xxxl * 2 : SPACING.xxxl}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </KeyboardAwareScrollView>
        {footer ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(SPACING.xxl, insets.bottom) },
              footerContainerStyle,
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: LAYOUT.screenPaddingHorizontal,
    paddingVertical: LAYOUT.screenPaddingVertical,
  },
  footer: {
    backgroundColor: COLORS.background,
    paddingHorizontal: LAYOUT.screenPaddingHorizontal,
    paddingTop: SPACING.xl,
  },
});
