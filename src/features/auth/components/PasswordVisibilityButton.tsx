import { Pressable, StyleSheet } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS } from '@/src/constants';

type PasswordVisibilityButtonProps = {
  onPress: () => void;
  visible: boolean;
};

export function PasswordVisibilityButton({
  onPress,
  visible,
}: PasswordVisibilityButtonProps) {
  return (
    <Pressable
      accessibilityLabel={visible ? '비밀번호 숨기기' : '비밀번호 표시하기'}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={styles.button}
    >
      <AppIcon
        accessible={false}
        color={COLORS.gray500}
        name={visible ? 'eye-off-outline' : 'eye-outline'}
        size={24}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
});
