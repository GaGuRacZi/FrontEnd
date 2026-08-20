import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, BrandPawLogo } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { ChatPostReferenceSnapshot } from '../types';

type ChatPostReferenceCardProps = {
  onPress?: () => void;
  reference: ChatPostReferenceSnapshot;
};

const KIND_LABELS = {
  market: '장터',
  talk: '소통',
} as const;

export function ChatPostReferenceCard({ onPress, reference }: ChatPostReferenceCardProps) {
  const deleted = Boolean(reference.deletedAt);
  const details = reference.kind === 'market'
    ? [...new Set([reference.tradeType, reference.priceLabel, reference.marketStatus].filter(Boolean))]
        .join(' · ')
    : [reference.authorNickname, reference.commentCount === undefined ? null : `댓글 ${reference.commentCount}`]
        .filter(Boolean)
        .join(' · ');

  return (
    <Pressable
      accessibilityLabel={
        deleted
          ? '삭제된 게시글, 대화 기록은 그대로 확인할 수 있어요'
          : `${KIND_LABELS[reference.kind]} 게시글, ${reference.title}${details ? `, ${details}` : ''}`
      }
      accessibilityRole={deleted ? 'text' : 'button'}
      disabled={deleted || !onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={[styles.thumbnail, deleted && styles.deletedThumbnail]}>
        {deleted ? (
          <AppIcon color={COLORS.gray500} name="alert-circle-outline" size={24} />
        ) : reference.thumbnailUri ? (
          <Image source={{ uri: reference.thumbnailUri }} style={styles.image} />
        ) : (
          <BrandPawLogo size={27} />
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.kind}>{KIND_LABELS[reference.kind]}</Text>
        <Text numberOfLines={1} style={[styles.title, deleted && styles.deletedText]}>
          {deleted ? '삭제된 게시글입니다' : reference.title}
        </Text>
        {deleted ? (
          <Text style={styles.details}>대화 기록은 그대로 확인할 수 있어요.</Text>
        ) : details ? (
          <Text numberOfLines={1} style={styles.details}>{details}</Text>
        ) : null}
      </View>
      {!deleted && onPress ? (
        <AppIcon color={COLORS.gray500} name="chevron-forward" size={20} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xl,
    minHeight: 82,
    padding: SPACING.xl,
  },
  thumbnail: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.md,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  deletedThumbnail: {
    backgroundColor: COLORS.gray100,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  content: {
    flex: 1,
  },
  kind: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  title: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
    marginTop: SPACING.xxs,
  },
  deletedText: {
    color: COLORS.gray600,
  },
  details: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    marginTop: SPACING.xxs,
  },
  pressed: {
    opacity: 0.62,
  },
});
