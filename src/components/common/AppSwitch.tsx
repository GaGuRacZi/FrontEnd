import { Pressable, StyleSheet, View } from 'react-native';

import { COLORS, RADIUS, SIZE, SPACING } from '@/src/constants';

type AppSwitchProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  value: boolean;
};

export function AppSwitch({
  accessibilityLabel,
  disabled = false,
  onChange,
  value,
}: AppSwitchProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={SPACING.md}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.track,
        value && styles.activeTrack,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.thumb, value && styles.activeThumb]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    height: SIZE.switchHeight,
    justifyContent: 'center',
    padding: 2,
    width: SIZE.switchWidth,
  },
  activeTrack: {
    backgroundColor: COLORS.primary,
  },
  thumb: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.round,
    height: SIZE.switchThumb,
    width: SIZE.switchThumb,
  },
  activeThumb: {
    alignSelf: 'flex-end',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
});
