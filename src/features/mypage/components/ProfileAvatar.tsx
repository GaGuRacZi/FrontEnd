import { Image, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS } from '@/src/constants';

type ProfileAvatarProps = {
  size?: number;
  uri?: string | null;
};

export function ProfileAvatar({ size = 72, uri }: ProfileAvatarProps) {
  return (
    <View style={[styles.avatar, { height: size, width: size }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <AppIcon color={COLORS.primary} name="person-outline" size={Math.round(size * 0.42)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderColor: COLORS.yellow,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
});
