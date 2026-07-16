import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { COLORS } from '@/src/constants';

type AppDividerProps = {
  style?: StyleProp<ViewStyle>;
};

export function AppDivider({ style }: AppDividerProps) {
  return <View accessibilityElementsHidden style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: COLORS.gray300,
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
