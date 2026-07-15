import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SHADOWS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

type SegmentOption<T extends string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  style?: StyleProp<ViewStyle>;
  value: T;
};

export function SegmentedControl<T extends string>({
  onChange,
  options,
  style,
  value,
}: SegmentedControlProps<T>) {
  return (
    <View style={[styles.container, style]}>
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.tab,
              isActive && styles.activeTab,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.toast,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
    height: SIZE.segmentHeight,
    padding: SPACING.xs,
    ...SHADOWS.segment,
  },
  tab: {
    alignItems: 'center',
    borderRadius: RADIUS.segment,
    flex: 1,
    height: SIZE.segmentIndicatorHeight,
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  label: {
    ...TYPOGRAPHY.segment,
    color: COLORS.gray600,
  },
  activeLabel: {
    ...TYPOGRAPHY.segmentActive,
    color: COLORS.background,
  },
  pressed: {
    opacity: 0.72,
  },
});
