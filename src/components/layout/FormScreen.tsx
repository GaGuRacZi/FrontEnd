import type { PropsWithChildren, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, LAYOUT, SPACING } from '@/src/constants';

import { AppScreen } from './AppScreen';

type FormScreenProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  header?: ReactNode;
  keyboardVerticalOffset?: number;
}>;

export function FormScreen({
  children,
  contentContainerStyle,
  footer,
  header,
  keyboardVerticalOffset = 0,
}: FormScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <AppScreen edges={['top', 'left', 'right']} padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.keyboardView}
      >
        {header}
        <ScrollView
          contentContainerStyle={[styles.content, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(SPACING.xxl, insets.bottom) }]}>
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
