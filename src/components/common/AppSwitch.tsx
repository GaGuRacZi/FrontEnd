import { Pressable, StyleSheet, View } from 'react-native';

import { COLORS, RADIUS, SIZE } from '@/src/constants';

type AppSwitchProps = {
  disabled?: boolean;
  onChange: (value: boolean) => void;
  value: boolean;
};

export function AppSwitch({ disabled = false, onChange, value }: AppSwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
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
