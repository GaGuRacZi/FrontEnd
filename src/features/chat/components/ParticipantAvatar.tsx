import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONT_FAMILY } from '@/src/constants';

import type { ChatParticipantSnapshot } from '../types';

type ParticipantAvatarProps = {
  participant: ChatParticipantSnapshot;
  size?: number;
};

const AVATAR_COLORS = ['#E8DDF8', '#CFF3E5', '#FFF0BE', '#E6EDFF'] as const;

function getAvatarColor(userId: string) {
  const index = [...userId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function ParticipantAvatar({ participant, size = 56 }: ParticipantAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const profileImageUri = participant.profileImageUri;
  const initial = participant.withdrawnAt ? '탈' : participant.nickname.trim().slice(0, 1) || '파';

  useEffect(() => {
    setImageFailed(false);
  }, [profileImageUri]);

  return (
    <View
      accessible
      accessibilityLabel={`${participant.nickname} 프로필 사진`}
      accessibilityRole="image"
      style={[
        styles.container,
        {
          backgroundColor: getAvatarColor(participant.userId),
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      {profileImageUri && !imageFailed ? (
        <Image
          onError={() => setImageFailed(true)}
          source={{ uri: profileImageUri }}
          style={styles.image}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.max(13, Math.round(size * 0.34)) }]}>
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderColor: COLORS.borderSoft,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  initial: {
    color: COLORS.gray800,
    fontFamily: FONT_FAMILY.bold,
  },
});
