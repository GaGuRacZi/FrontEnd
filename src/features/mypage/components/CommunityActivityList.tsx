import type { ReactElement } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppChip, AppIcon, EmptyState } from '@/src/components/common';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { getCommunityImageUris } from '@/src/features/community/services/communityImageStorage';
import { formatDateValue } from '@/src/features/community/utils/date';

import {
  getCommunityActivityKey,
  type CommentedActivityItem,
  type CommunityActivityFilter,
  type CommunityActivityItem,
} from '../communityActivitySelectors';

const KIND_LABELS = {
  market: '장터',
  talk: '소통',
} as const;

const KIND_ICONS = {
  market: 'bag-handle-outline',
  talk: 'chatbubbles-outline',
} as const;

type CommunityActivityListProps = {
  emptyDescription: string;
  emptyTitle: string;
  header?: ReactElement;
  items: readonly (CommentedActivityItem | CommunityActivityItem)[];
  onItemPress: (item: CommentedActivityItem | CommunityActivityItem) => void;
};

type CommunityActivityFiltersProps = {
  centered?: boolean;
  counts: Record<CommunityActivityFilter, number>;
  filters: readonly { id: CommunityActivityFilter; label: string }[];
  minWidth?: number;
  onSelect: (filter: CommunityActivityFilter) => void;
  selected: CommunityActivityFilter;
};

function getActivityDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatDateValue(date);
}

function getPhotoUri(item: CommunityActivityItem) {
  return getCommunityImageUris(item.post.images, item.post.photoUris)[0];
}

function CommunityActivityRow({
  item,
  onPress,
}: {
  item: CommentedActivityItem | CommunityActivityItem;
  onPress: () => void;
}) {
  const photoUri = getPhotoUri(item);
  const latestComment = 'latestComment' in item ? item.latestComment : null;
  const additionalCommentCount =
    'commentCount' in item ? item.commentCount - 1 : 0;
  const description = latestComment?.body ?? item.post.body;
  const activityDate = getActivityDate(item.createdAt);
  const previewLabel = latestComment
    ? latestComment.parentId
      ? '내 답글'
      : '내 댓글'
    : null;

  return (
    <Pressable
      accessibilityLabel={[
        `${KIND_LABELS[item.kind]} ${item.post.title}`,
        previewLabel ? `${previewLabel} ${description}` : description,
        additionalCommentCount > 0 ? `외 ${additionalCommentCount}개` : '',
        activityDate,
      ].filter(Boolean).join(', ')}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.thumbnail}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.thumbnailImage} />
        ) : (
          <AppIcon color={COLORS.primary} name={KIND_ICONS[item.kind]} size={24} />
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <View style={styles.kindBadge}>
            <Text style={styles.kindText}>{KIND_LABELS[item.kind]}</Text>
          </View>
          <Text style={styles.date}>{activityDate}</Text>
        </View>
        <Text numberOfLines={1} style={styles.title}>
          {item.post.title}
        </Text>
        <View style={latestComment ? styles.commentPreview : undefined}>
          {previewLabel ? (
            <View style={styles.previewMetaRow}>
              <Text style={styles.previewLabel}>{previewLabel}</Text>
              {additionalCommentCount > 0 ? (
                <Text style={styles.additionalCommentCount}>
                  외 {additionalCommentCount}개
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text numberOfLines={2} style={styles.description}>
            {description}
          </Text>
        </View>
      </View>

      <AppIcon color={COLORS.gray500} name="chevron-forward" size={20} />
    </Pressable>
  );
}

export function CommunityActivityList({
  emptyDescription,
  emptyTitle,
  header,
  items,
  onItemPress,
}: CommunityActivityListProps) {
  return (
    <FlatList
      contentContainerStyle={[styles.content, items.length === 0 && styles.emptyContent]}
      data={items}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      keyExtractor={getCommunityActivityKey}
      ListEmptyComponent={
        <EmptyState description={emptyDescription} title={emptyTitle} />
      }
      ListHeaderComponent={header}
      ListHeaderComponentStyle={header ? styles.header : undefined}
      renderItem={({ item }) => (
        <CommunityActivityRow item={item} onPress={() => onItemPress(item)} />
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

export function CommunityActivityFilters({
  centered = false,
  counts,
  filters,
  minWidth,
  onSelect,
  selected,
}: CommunityActivityFiltersProps) {
  return (
    <View style={styles.filterContainer}>
      <ScrollView
        contentContainerStyle={[styles.filters, centered && styles.centeredFilters]}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {filters.map((filter) => (
          <AppChip
            key={filter.id}
            label={`${filter.label} ${counts[filter.id]}`}
            minWidth={minWidth}
            onPress={() => onSelect(filter.id)}
            selected={selected === filter.id}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  additionalCommentCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  body: {
    flex: 1,
    gap: SPACING.xs,
  },
  card: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.lg,
    minHeight: 112,
    padding: SPACING.xl,
  },
  centeredFilters: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  commentPreview: {
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.md,
    gap: SPACING.xxs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  content: {
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.xl,
  },
  date: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
  },
  description: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  emptyContent: {
    flexGrow: 1,
  },
  filterContainer: {
    marginHorizontal: -SPACING.xl,
  },
  filters: {
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.xxl,
  },
  kindBadge: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xxs,
  },
  kindText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  pressed: {
    opacity: 0.65,
  },
  previewLabel: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  previewMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  separator: {
    height: SPACING.lg,
  },
  thumbnail: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  thumbnailImage: {
    height: '100%',
    width: '100%',
  },
  title: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
});
