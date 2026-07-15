import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet } from 'react-native';

import { SIZE } from '@/src/constants';

export function BrandLogoButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel="홈으로 이동"
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => router.navigate('/home')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Image
        accessibilityIgnoresInvertColors
        source={require('../../../assets/images/paw-logo.png')}
        style={styles.logo}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: SIZE.topHeaderHeight,
    width: 80,
  },
  logo: {
    height: 80,
    left: 0,
    position: 'absolute',
    top: -14,
    width: 80,
  },
  pressed: {
    opacity: 0.6,
  },
});
