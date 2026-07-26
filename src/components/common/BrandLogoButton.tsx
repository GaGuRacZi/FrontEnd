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
    width: 70,
  },
  logo: {
    height: 70,
    left: 0,
    position: 'absolute',
    top: -9,
    width: 70,
  },
  pressed: {
    opacity: 0.6,
  },
});
