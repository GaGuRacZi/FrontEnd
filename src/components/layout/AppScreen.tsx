import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, LAYOUT } from '@/src/constants';

type AppScreenProps = PropsWithChildren<{
  backgroundColor?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  padded?: boolean;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function AppScreen({
  backgroundColor = COLORS.background,
  children,
  contentContainerStyle,
  edges = ['top', 'bottom', 'left', 'right'],
  padded = true,
  scrollable = false,
  style,
}: AppScreenProps) {
  const contentStyles = [
    styles.content,
    padded && styles.padded,
    contentContainerStyle,
  ];

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor }, style]}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={contentStyles}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fixedContent, ...contentStyles]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  fixedContent: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: LAYOUT.screenPaddingHorizontal,
    paddingVertical: LAYOUT.screenPaddingVertical,
  },
});
