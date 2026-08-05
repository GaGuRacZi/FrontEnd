import type { ImageStyle, StyleProp } from 'react-native';
import { Image } from 'react-native';

type BrandPawLogoProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function BrandPawLogo({ size = 30, style }: BrandPawLogoProps) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      accessible={false}
      resizeMode="contain"
      source={require('../../../assets/images/paw-logo.png')}
      style={[{ height: size, width: size }, style]}
    />
  );
}
