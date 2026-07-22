import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS } from '@/src/constants';

import type { PetFormValues } from '../types';

type PetAvatarProps = {
  pet: Pick<PetFormValues, 'name' | 'profileImageUri' | 'type'> | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const FALLBACK_IMAGES = {
  cat: require('../../../../assets/images/signup/pet-type-cat.png'),
  dog: require('../../../../assets/images/signup/pet-type-dog.png'),
};

export function PetAvatar({ pet, size = 40, style }: PetAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [pet?.profileImageUri]);

  const profileImageUri = pet?.profileImageUri;
  const hasProfileImage = Boolean(profileImageUri && !imageFailed);
  const imageSource = profileImageUri && !imageFailed
    ? { uri: profileImageUri }
    : pet?.type
      ? FALLBACK_IMAGES[pet.type]
      : null;
  const accessibilityLabel = pet?.name.trim()
    ? `${pet.name} 프로필 사진`
    : '반려동물 프로필 사진';

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.container,
        { borderRadius: size / 2, height: size, width: size },
        style,
      ]}
    >
      {imageSource ? (
        <Image
          accessibilityIgnoresInvertColors
          onError={() => setImageFailed(true)}
          resizeMode={hasProfileImage ? 'cover' : 'contain'}
          source={imageSource}
          style={{
            height: hasProfileImage ? size : size * 0.8,
            width: hasProfileImage ? size : size * 0.8,
          }}
        />
      ) : (
        <AppIcon color={COLORS.primary} name="paw" size={size * 0.5} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderColor: COLORS.borderSoft,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
