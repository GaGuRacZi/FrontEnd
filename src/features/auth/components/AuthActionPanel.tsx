import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, LAYOUT, RADIUS, SPACING } from '@/src/constants';

type AuthActionPanelProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function AuthActionPanel({ children, style }: AuthActionPanelProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        style,
        { paddingBottom: Math.max(SPACING.xxl, insets.bottom) },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.authPanel,
    borderTopRightRadius: RADIUS.authPanel,
    elevation: 4,
    gap: SPACING.xxl,
    paddingHorizontal: LAYOUT.authContentPaddingHorizontal,
    paddingTop: 28,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 13,
  },
});
