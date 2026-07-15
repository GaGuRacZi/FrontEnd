import type { ImageSourcePropType } from 'react-native';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

export type ImageAttachment = {
  id: string;
  source: ImageSourcePropType;
};

type ImageAttachmentFieldProps = {
  attachments: readonly ImageAttachment[];
  disabled?: boolean;
  label?: string;
  maxCount?: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export function ImageAttachmentField({
  attachments,
  disabled = false,
  label = '사진',
  maxCount = 5,
  onAdd,
  onRemove,
}: ImageAttachmentFieldProps) {
  const canAdd = attachments.length < maxCount;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.count}>
          {attachments.length}/{maxCount}
        </Text>
      </View>

      {attachments.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.attachmentList}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {attachments.map((attachment, index) => (
            <View key={attachment.id} style={styles.thumbnailContainer}>
              <Image
                accessibilityLabel={`${label} ${index + 1}`}
                source={attachment.source}
                style={styles.thumbnail}
              />
              <Pressable
                accessibilityLabel={`${label} ${index + 1} 삭제`}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                hitSlop={SPACING.lg}
                onPress={() => onRemove(attachment.id)}
                style={({ pressed }) => [
                  styles.removeButton,
                  disabled && styles.disabled,
                  pressed && !disabled && styles.pressed,
                ]}
              >
                <AppIcon color={COLORS.background} name="close" size={16} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {canAdd ? (
        <Pressable
          accessibilityLabel={`${label} 추가`}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          hitSlop={SPACING.sm}
          onPress={onAdd}
          style={({ pressed }) => [
            styles.addButton,
            disabled && styles.disabled,
            pressed && !disabled && styles.pressed,
          ]}
        >
          <AppIcon color={COLORS.primary} name="add" size={16} />
          <Text style={styles.addButtonText}>사진 추가</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  count: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
  },
  attachmentList: {
    gap: SPACING.xl,
    paddingRight: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  thumbnailContainer: {
    height: SIZE.attachmentThumbnail,
    width: SIZE.attachmentThumbnail,
  },
  thumbnail: {
    borderRadius: RADIUS.md,
    height: '100%',
    width: '100%',
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: COLORS.gray800,
    borderRadius: RADIUS.round,
    height: SIZE.attachmentRemoveButton,
    justifyContent: 'center',
    position: 'absolute',
    right: -SPACING.sm,
    top: -SPACING.sm,
    width: SIZE.attachmentRemoveButton,
  },
  addButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderBlue,
    borderRadius: RADIUS.attachButton,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
    height: SIZE.attachButtonHeight,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  addButtonText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  pressed: {
    opacity: 0.65,
  },
  disabled: {
    opacity: 0.45,
  },
});
