import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/src/components/common/AppIcon';
import { EmptyState, LoadingView } from '@/src/components/common';
import { AppButton } from '@/src/components/common/AppButton';
import { AppInput } from '@/src/components/form';
import { ScreenLayout } from '@/src/components/layout';
import { AppModal } from '@/src/components/modal';
import { COLORS, RADIUS, SHADOWS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import { usePetStore } from '@/src/features/pet/PetStore';

import {
  COMMUNITY_AD_TEXT,
  COMMUNITY_TABS,
  MARKET_CATEGORIES,
  MARKET_STATUSES,
  MARKET_TRADE_TYPES,
  REVIEW_CATEGORIES,
  TALK_CATEGORIES,
} from '../communityData';
import { useCommunityStore } from '../CommunityStore';
import { getCommunityImageUris } from '../services/communityImageStorage';
import type {
  CommunityAuthorSnapshot,
  CommunityComment,
  CommunityPost,
  MarketCategory,
  MarketPost,
  MarketStatus,
  MarketTradeType,
  ReactionKind,
  ReviewCategory,
  ReviewPost,
  TalkCategory,
  TalkPost,
} from '../types';

type CommunityTab = (typeof COMMUNITY_TABS)[number]['id'];

type ModalState =
  | { title: string; description: string }
  | null;

type CommunitySearchResult =
  | { kind: 'market'; post: MarketPost }
  | { kind: 'review'; post: ReviewPost }
  | { kind: 'talk'; post: TalkPost };

const PAW_LOGO = require('@/assets/images/paw-logo.png');
const REVIEW_GOOD_ICON = require('@/assets/images/decorations/review-good.png');
const REVIEW_NO_ICON = require('@/assets/images/decorations/review-no.png');

const REVIEW_STAR_COLOR = COLORS.star;

const CATEGORY_PILL_STYLE = {
  backgroundColor: COLORS.primarySoft,
  color: COLORS.primary,
} as const;

function getReviewScoreLabels(category: Exclude<ReviewCategory, '전체'>) {
  return category === '산책 장소'
    ? ['쾌적도', '접근성', '재방문'] as const
    : ['친절도', '가격', '재방문'] as const;
}

const TALK_CATEGORY_STYLES: Record<Exclude<TalkCategory, '전체'>, {
  backgroundColor: string;
  color: string;
}> = {
  건강상담: CATEGORY_PILL_STYLE,
  동네정보: CATEGORY_PILL_STYLE,
  산책친구: CATEGORY_PILL_STYLE,
  헌혈소식: CATEGORY_PILL_STYLE,
};

const MARKET_TRADE_STYLES: Record<MarketTradeType, {
  backgroundColor: string;
  color: string;
}> = {
  교환: CATEGORY_PILL_STYLE,
  구해요: CATEGORY_PILL_STYLE,
  나눔: CATEGORY_PILL_STYLE,
  판매: CATEGORY_PILL_STYLE,
};

const REVIEW_CATEGORY_STYLES: Record<Exclude<ReviewCategory, '전체'>, {
  backgroundColor: string;
  color: string;
}> = {
  미용실: CATEGORY_PILL_STYLE,
  병원: CATEGORY_PILL_STYLE,
  '산책 장소': CATEGORY_PILL_STYLE,
  용품샵: CATEGORY_PILL_STYLE,
};

const REVIEW_CATEGORY_ICONS: Record<Exclude<ReviewCategory, '전체'>, Parameters<typeof AppIcon>[0]['name']> = {
  미용실: 'cut-outline',
  병원: 'medical-outline',
  '산책 장소': 'leaf-outline',
  용품샵: 'storefront-outline',
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeSearchText(value: string) {
  return normalizeText(value).replace(/[ #·.,/\\-]/g, '');
}

function getRelativeTime(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function getMarketListLocation(location: string) {
  const normalizedLocation = location.trim();
  if (normalizedLocation.length <= 8) return normalizedLocation;
  return `${normalizedLocation.slice(0, 8)}...`;
}

function getMarketPriceParts(priceLabel: string) {
  const offerText = '가격 제안 가능';
  if (!priceLabel.includes(offerText)) return { offerAvailable: false, price: priceLabel };

  return {
    offerAvailable: true,
    price: priceLabel.replace(` · ${offerText}`, '').trim(),
  };
}

function hasSearchValue(values: string[], query: string) {
  const normalizedQuery = normalizeText(query);
  const compactQuery = normalizeSearchText(query);
  if (!normalizedQuery) return false;
  if (!compactQuery) return false;
  return values.some((value) => {
    const normalizedValue = normalizeText(value);
    return (
      normalizedValue.includes(normalizedQuery) ||
      Boolean(compactQuery && normalizeSearchText(value).includes(compactQuery))
    );
  });
}

function hasCommunityPostSearchMatch(
  post: CommunityPost,
  query: string,
  author = post.author,
) {
  if (post.kind === 'talk') {
    return hasSearchValue([
      post.title,
      post.body,
      post.category,
      author.nickname,
      author.location ?? '',
      ...post.tags,
    ], query);
  }

  return hasSearchValue([
    post.title,
    post.body,
    post.category,
    post.location,
    author.nickname,
    ...post.tags,
  ], query);
}

function hasReviewSearchMatch(
  post: ReviewPost,
  query: string,
) {
  return hasSearchValue([
    post.targetName ?? '',
    post.category,
    post.title,
  ], query);
}

function getReviewSearchRank(post: ReviewPost, query: string) {
  const normalizedQuery = normalizeText(query);
  const compactQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 2;
  if (!compactQuery) return 2;
  const hasMatch = (value: string) =>
    normalizeText(value).includes(normalizedQuery) ||
    Boolean(compactQuery && normalizeSearchText(value).includes(compactQuery));
  if (hasMatch(post.targetName ?? '')) return 0;
  if (hasMatch(post.category)) return 1;
  if (hasMatch(post.title)) return 1;
  return 2;
}

function HeaderIconButton({
  icon,
  label,
  onPress,
  outlined = false,
}: {
  icon: Parameters<typeof AppIcon>[0]['name'];
  label: string;
  onPress: () => void;
  outlined?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={SPACING.md}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerIconButton,
        outlined && styles.headerIconOutlined,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon color={COLORS.black} name={icon} size={outlined ? 23 : 25} />
    </Pressable>
  );
}

function CommunityHeaderTitle() {
  return <Text style={styles.headerTitle}>커뮤니티</Text>;
}

function TabSegment({
  activeTab,
  onChange,
}: {
  activeTab: CommunityTab;
  onChange: (tab: CommunityTab) => void;
}) {
  return (
    <View style={styles.segment}>
      {COMMUNITY_TABS.map((tab) => {
        const selected = activeTab === tab.id;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [
              styles.segmentItem,
              selected && styles.segmentItemActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function AdBanner() {
  return (
    <View style={styles.adBanner}>
      <Text style={styles.adText}>{COMMUNITY_AD_TEXT}</Text>
    </View>
  );
}

function ChipRow<T extends string>({
  activeValue,
  align = 'start',
  compact = false,
  roomy = false,
  values,
  onChange,
}: {
  activeValue: T;
  align?: 'center' | 'start';
  compact?: boolean;
  roomy?: boolean;
  values: T[];
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.chipRow, align === 'center' && styles.chipRowCentered]}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {values.map((value) => {
        const selected = activeValue === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={value}
            onPress={() => onChange(value)}
            style={({ pressed }) => [
              styles.categoryChip,
              compact && styles.categoryChipCompact,
              roomy && styles.categoryChipRoomy,
              selected && styles.categoryChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.categoryChipText, selected && styles.categoryChipTextActive]}>
              {value}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MetaItem({
  color = COLORS.gray600,
  icon,
  prominent = false,
  text,
}: {
  color?: string;
  icon: Parameters<typeof AppIcon>[0]['name'];
  prominent?: boolean;
  text: string | number;
}) {
  return (
    <View style={[styles.metaItem, prominent && styles.metaItemProminent]}>
      <AppIcon color={color} name={icon} size={prominent ? 17 : 14} />
      <Text style={[styles.metaText, prominent && styles.metaTextProminent, { color }]}>{text}</Text>
    </View>
  );
}

function TalkCard({
  commentCount,
  likeCount,
  onOpen,
  post,
}: {
  commentCount: number;
  likeCount: number;
  onOpen: () => void;
  post: TalkPost;
}) {
  const categoryStyle = TALK_CATEGORY_STYLES[post.category];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.talkCard, pressed && styles.pressed]}
    >
      <View style={styles.cardHeaderRow}>
        <Text
          style={[
            styles.talkCategory,
            { backgroundColor: categoryStyle.backgroundColor, color: categoryStyle.color },
          ]}
        >
          {post.category}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.cardTitle}>
        {post.title}
      </Text>
      <Text numberOfLines={1} style={styles.cardDescription}>
        {post.body}
      </Text>
      <View style={styles.cardFooterRow}>
        <View style={[styles.metaItem, styles.metaItemProminent]}>
          <Image
            source={REVIEW_GOOD_ICON}
            style={[styles.reviewFeedbackIcon, { tintColor: COLORS.danger }]}
          />
          <Text style={[styles.metaText, styles.metaTextProminent, { color: COLORS.danger }]}>
            {likeCount}
          </Text>
        </View>
        <MetaItem color={COLORS.primary} icon="chatbubble-outline" prominent text={commentCount} />
        <Text style={styles.cardTime}>{getRelativeTime(post.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

function MarketCard({
  bookmarked,
  onOpen,
  onToggleBookmark,
  post,
}: {
  bookmarked: boolean;
  onOpen: () => void;
  onToggleBookmark: () => void;
  post: MarketPost;
}) {
  const tradeStyle = MARKET_TRADE_STYLES[post.tradeType];
  const priceParts = getMarketPriceParts(post.priceLabel);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.marketCard, pressed && styles.pressed]}
    >
      <View style={styles.marketThumbnail}>
        <Image source={PAW_LOGO} style={styles.marketThumbnailLogo} />
      </View>
      <View style={styles.marketContent}>
        <View style={styles.marketTopLine}>
          <Text style={[styles.marketStatusBadge, post.status === '완료' && styles.marketDoneBadge]}>
            {post.status}
          </Text>
        </View>
        <Text
          style={[
            styles.marketTradeBadge,
            { backgroundColor: tradeStyle.backgroundColor, color: tradeStyle.color },
          ]}
        >
          {post.tradeType}
        </Text>
        <Text numberOfLines={1} style={styles.marketTitle}>
          {post.title}
        </Text>
        <Text numberOfLines={1} style={styles.marketMeta}>
          {post.category} · {getMarketListLocation(post.location)} · {getRelativeTime(post.createdAt)}
        </Text>
        <View style={styles.marketPriceRow}>
          <Text numberOfLines={1} style={styles.marketPrice}>{priceParts.price}</Text>
          {priceParts.offerAvailable ? (
            <Text style={styles.marketOfferText}>가격 제안 가능</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel={bookmarked ? '찜 해제' : '찜하기'}
          accessibilityRole="button"
          hitSlop={SPACING.sm}
          onPress={(event) => {
            event.stopPropagation();
            onToggleBookmark();
          }}
          style={({ pressed }) => [styles.marketBookmarkButton, pressed && styles.pressed]}
        >
          <AppIcon color={COLORS.danger} name={bookmarked ? 'heart' : 'heart-outline'} size={21} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function SectionTitle({ count, title }: { count?: number; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== undefined ? <Text style={styles.sectionCount}>{count}개</Text> : null}
    </View>
  );
}

function resolveAuthor(
  author: CommunityAuthorSnapshot,
  profile: ReturnType<typeof useMyPageStore>['profile'],
  viewerId: string,
) {
  if (author.userId !== viewerId || !profile) return author;

  return {
    ...author,
    introduction: profile.introduction.trim() || undefined,
    location: profile.location || author.location,
    nickname: profile.nickname || author.nickname,
    profileImageUri: profile.profileImageUri ?? null,
  };
}

function AuthorAvatar({
  author,
  size = 44,
}: {
  author: CommunityAuthorSnapshot;
  size?: number;
}) {
  return (
    <View style={[styles.authorAvatar, { height: size, width: size }]}>
      {author.profileImageUri ? (
        <Image source={{ uri: author.profileImageUri }} style={styles.authorAvatarImage} />
      ) : (
        <AppIcon color={COLORS.primary} name="person" size={Math.round(size * 0.46)} />
      )}
    </View>
  );
}

function getCommentAuthor(profile: ReturnType<typeof useMyPageStore>['profile'], selectedPet: ReturnType<typeof usePetStore>['selectedPet'], viewerId: string): CommunityAuthorSnapshot {
  return {
    introduction: profile?.introduction.trim() || undefined,
    location: profile?.location || undefined,
    nickname: profile?.nickname || '나',
    petName: selectedPet?.name,
    profileImageUri: profile?.profileImageUri ?? null,
    userId: viewerId,
  };
}

function CommentItem({
  author,
  comment,
  isMine,
  onDelete,
  onEdit,
  onReply,
}: {
  author: CommunityAuthorSnapshot;
  comment: CommunityComment;
  isMine: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onReply: () => void;
}) {
  if (comment.deletedAt) {
    return (
      <View style={styles.deletedCommentItem}>
        <Text style={styles.deletedCommentText}>삭제된 댓글입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.commentItem}>
      <AuthorAvatar author={author} size={34} />
      <View style={styles.commentBody}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{author.nickname}</Text>
          <Text style={styles.commentTime}>{getRelativeTime(comment.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{comment.body}</Text>
        <View style={styles.commentActions}>
          <Pressable accessibilityRole="button" hitSlop={SPACING.sm} onPress={onReply}>
            <Text style={styles.commentActionText}>답글</Text>
          </Pressable>
          {isMine ? (
            <>
              <Pressable accessibilityRole="button" hitSlop={SPACING.sm} onPress={onEdit}>
                <Text style={styles.commentActionText}>수정</Text>
              </Pressable>
              <Pressable accessibilityRole="button" hitSlop={SPACING.sm} onPress={onDelete}>
                <Text style={styles.commentActionText}>삭제</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function CommunityEmptyPosts({ icon, title }: {
  icon: Parameters<typeof AppIcon>[0]['name'];
  title: string;
}) {
  return (
    <View style={styles.emptyPostsCard}>
      <View style={styles.emptyPostsIcon}>
        <AppIcon color={COLORS.primary} name={icon} size={30} />
      </View>
      <Text style={styles.emptyPostsTitle}>{title}</Text>
    </View>
  );
}

function ReviewCard({
  author,
  onPress,
  post,
}: {
  author: CommunityAuthorSnapshot;
  onPress: () => void;
  post: ReviewPost;
}) {
  const categoryStyle = REVIEW_CATEGORY_STYLES[post.category];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.reviewCard, pressed && styles.pressed]}
    >
      <View style={styles.cardHeaderRow}>
        <Text
          style={[
            styles.reviewCategory,
            { backgroundColor: categoryStyle.backgroundColor, color: categoryStyle.color },
          ]}
        >
          {post.category}
        </Text>
        <View style={styles.reviewRating}>
          <AppIcon color={REVIEW_STAR_COLOR} name="star" size={15} />
          <Text style={styles.reviewRatingText}>{post.rating.toFixed(1)}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={styles.cardTitle}>
        {post.title}
      </Text>
      <Text numberOfLines={1} style={styles.cardDescription}>
        {post.body}
      </Text>
      <Text style={styles.cardTime}>{author.nickname} · {getRelativeTime(post.createdAt)}</Text>
    </Pressable>
  );
}

function ReviewReadyContent({
  category,
  onCategoryChange,
  onOpenReview,
  posts,
  profile,
  viewerId,
}: {
  category: ReviewCategory;
  onCategoryChange: (category: ReviewCategory) => void;
  onOpenReview: (postId: string) => void;
  posts: ReviewPost[];
  profile: ReturnType<typeof useMyPageStore>['profile'];
  viewerId: string;
}) {
  const reviewPosts = posts.filter((post) => category === '전체' || post.category === category);

  return (
    <>
      <AdBanner />
      <ChipRow
        activeValue={category}
        onChange={onCategoryChange}
        roomy
        values={REVIEW_CATEGORIES}
      />
      {reviewPosts.length ? (
        reviewPosts.map((post) => {
          const author = resolveAuthor(post.author, profile, viewerId);
          return (
            <ReviewCard
              author={author}
              key={post.id}
              onPress={() => onOpenReview(post.id)}
              post={post}
            />
          );
        })
      ) : (
        <CommunityEmptyPosts icon="star-outline" title="아직 리뷰가 등록되지 않았습니다" />
      )}
    </>
  );
}

function PhotoViewer({
  onClose,
  uri,
}: {
  onClose: () => void;
  uri: string | null;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(uri)}>
      <View style={styles.photoViewerOverlay}>
        <Pressable
          accessibilityLabel="사진 보기 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.photoViewerClose}
        >
          <AppIcon color={COLORS.background} name="close" size={24} />
        </Pressable>
        {uri ? (
          <Image source={{ uri }} style={styles.photoViewerImage} />
        ) : null}
      </View>
    </Modal>
  );
}

export function CommunityPostDetailScreen({ postId }: { postId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    addComment,
    deleteComment,
    deletePost,
    deleteReviewPost,
    getCommentsByPostId,
    getPostById,
    getReactionCount,
    isBookmarked,
    isReacted,
    reviewPosts,
    toggleBookmark,
    toggleReaction,
    updateComment,
    updateMarketStatus,
    viewerId,
  } = useCommunityStore();
  const { profile } = useMyPageStore();
  const { selectedPet } = usePetStore();
  const [commentText, setCommentText] = useState('');
  const [editingComment, setEditingComment] = useState<CommunityComment | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommunityComment | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<CommunityComment | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [talkActionVisible, setTalkActionVisible] = useState(false);
  const [talkDeleteVisible, setTalkDeleteVisible] = useState(false);
  const [talkDeleting, setTalkDeleting] = useState(false);
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
  const [pendingMarketStatus, setPendingMarketStatus] = useState<MarketStatus | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [marketActionVisible, setMarketActionVisible] = useState(false);
  const [marketDeleteVisible, setMarketDeleteVisible] = useState(false);
  const [marketDeleting, setMarketDeleting] = useState(false);
  const [reactionSubmitting, setReactionSubmitting] = useState(false);
  const [reviewActionVisible, setReviewActionVisible] = useState(false);
  const [reviewDeleteVisible, setReviewDeleteVisible] = useState(false);
  const [reviewDeleting, setReviewDeleting] = useState(false);
  const selectedPost = getPostById(postId);
  const selectedReviewPost = reviewPosts.find((post) => post.id === postId) ?? null;

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/community');
  };

  const handleSubmitComment = async () => {
    if (!selectedPost || selectedPost.kind !== 'talk') return;
    if (commentSubmitting) return;

    setCommentSubmitting(true);

    try {
      const author = getCommentAuthor(profile, selectedPet, viewerId);
      const result = editingComment
        ? await updateComment(editingComment.id, commentText)
        : await addComment(selectedPost.id, commentText, author, replyingTo?.id);

      if (result.ok) {
        setCommentText('');
        setEditingComment(null);
        setReplyingTo(null);
        return;
      }

      setModal({
        description: result.reason === 'empty' ? '댓글 내용을 입력해주세요.' : '댓글을 다시 확인해주세요.',
        title: '댓글을 저장하지 못했어요',
      });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete) return;
    const result = await deleteComment(commentToDelete.id);
    setCommentToDelete(null);
    if (!result.ok) {
      setModal({
        description: '이미 삭제되었거나 수정할 수 없는 댓글이에요.',
        title: '댓글을 삭제하지 못했어요',
      });
    }
  };

  const handleDeleteReview = async () => {
    if (!selectedReviewPost || reviewDeleting) return;

    setReviewDeleting(true);
    const result = await deleteReviewPost(selectedReviewPost.id);
    setReviewDeleting(false);
    setReviewDeleteVisible(false);

    if (result.ok) {
      router.replace('/community');
      return;
    }

    setModal({
      description: result.reason === 'not-yours'
        ? '내가 작성한 리뷰만 삭제할 수 있어요.'
        : '이미 삭제되었거나 다시 확인이 필요한 리뷰예요.',
      title: '리뷰를 삭제하지 못했어요',
    });
  };

  const handleDeleteTalkPost = async () => {
    if (!selectedPost || selectedPost.kind !== 'talk' || talkDeleting) return;

    setTalkDeleting(true);
    const result = await deletePost(selectedPost.id);
    setTalkDeleting(false);
    setTalkDeleteVisible(false);

    if (result.ok) {
      router.replace('/community');
      return;
    }

    setModal({
      description:
        result.reason === 'not-yours'
          ? '내가 작성한 소통 글만 삭제할 수 있어요.'
          : '이미 삭제되었거나 다시 확인이 필요한 게시글이에요.',
      title: '게시글을 삭제하지 못했어요',
    });
  };

  if (!selectedPost && !selectedReviewPost) {
    return (
      <ScreenLayout
        headerFullWidth
        headerVariant="auth"
        leftAccessibilityLabel="커뮤니티로 돌아가기"
        onLeftPress={goBack}
        title="커뮤니티"
      >
        <EmptyState
          description="이미 삭제되었거나 존재하지 않는 게시글이에요."
          icon={<AppIcon color={COLORS.primary} name="alert-circle-outline" size={32} />}
          title="게시글을 찾을 수 없어요"
        />
      </ScreenLayout>
    );
  }

  if (selectedReviewPost) {
    const author = resolveAuthor(selectedReviewPost.author, profile, viewerId);
    const isMine = selectedReviewPost.author.userId === viewerId;
    const helpful = isReacted(selectedReviewPost.id, 'helpful');
    const notHelpful = isReacted(selectedReviewPost.id, 'notHelpful');
    const helpfulCount = getReactionCount(selectedReviewPost.id, 'helpful');
    const notHelpfulCount = getReactionCount(selectedReviewPost.id, 'notHelpful');
    const placeholderPhotoCount = selectedReviewPost.placeholderPhotoCount ?? 0;
    const reviewPhotoUris = getCommunityImageUris(selectedReviewPost.images, selectedReviewPost.photoUris);
    const reviewScoreLabels = getReviewScoreLabels(selectedReviewPost.category);
    const reviewReactionDisabled = isMine || reactionSubmitting;
    const toggleReviewReaction = async (kind: ReactionKind) => {
      if (reviewReactionDisabled) return;

      setReactionSubmitting(true);
      const result = await toggleReaction(selectedReviewPost.id, kind);
      setReactionSubmitting(false);

      if (!result.ok && result.reason === 'not-yours') {
        setModal({
          description: '내가 작성한 리뷰에는 반응을 남길 수 없어요.',
          title: '반응할 수 없어요',
        });
      }
    };

    return (
      <ScreenLayout
        headerFullWidth
        headerVariant="auth"
        leftAccessibilityLabel="리뷰 목록으로 돌아가기"
        onLeftPress={goBack}
        rightContent={
          isMine ? (
            <Pressable
              accessibilityLabel="리뷰 관리"
              accessibilityRole="button"
              hitSlop={SPACING.md}
              onPress={() => setReviewActionVisible(true)}
              style={({ pressed }) => [styles.headerActionButton, pressed && styles.pressed]}
            >
              <AppIcon color={COLORS.black} name="ellipsis-horizontal" size={24} />
            </Pressable>
          ) : undefined
        }
        title="리뷰"
      >
        <ScrollView
          contentContainerStyle={[
            styles.reviewDetailContent,
            { paddingBottom: SPACING.xxxl + Math.max(SPACING.xl, insets.bottom) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.reviewTargetCard}>
            <View style={styles.reviewTargetIcon}>
              <AppIcon color={COLORS.gray600} name={REVIEW_CATEGORY_ICONS[selectedReviewPost.category]} size={24} />
            </View>
            <View style={styles.authorText}>
              <Text style={styles.authorName}>{selectedReviewPost.targetName || '리뷰 대상'}</Text>
              <Text style={styles.authorMeta}>{selectedReviewPost.category}</Text>
            </View>
          </View>

          <View style={styles.reviewScoreCard}>
            <View style={styles.reviewScoreHeader}>
              <Text style={styles.reviewScoreValue}>{selectedReviewPost.rating.toFixed(1)}</Text>
              <View style={styles.reviewScoreStars}>
                {[1, 2, 3, 4, 5].map((score) => (
                  <AppIcon
                    color={REVIEW_STAR_COLOR}
                    key={score}
                    name={selectedReviewPost.rating >= score ? 'star' : selectedReviewPost.rating >= score - 0.5 ? 'star-half' : 'star-outline'}
                    size={17}
                  />
                ))}
              </View>
            </View>
            {selectedReviewPost.detailScores ? (
              <View style={styles.reviewScoreRows}>
                {[
                  [reviewScoreLabels[0], selectedReviewPost.detailScores.kindness],
                  [reviewScoreLabels[1], selectedReviewPost.detailScores.price],
                  [reviewScoreLabels[2], selectedReviewPost.detailScores.revisit],
                ].map(([label, value]) => (
                  <View key={label as string} style={styles.reviewScoreRow}>
                    <Text style={styles.reviewScoreLabel}>{label as string}</Text>
                    <View style={styles.reviewScoreTrack}>
                      <View style={[styles.reviewScoreFill, { width: `${((value as number) / 5) * 100}%` }]} />
                    </View>
                    <Text style={styles.reviewScoreNumber}>{value as number}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.authorRow}>
            <AuthorAvatar author={author} />
            <View style={styles.authorText}>
              <Text style={styles.authorName}>{author.nickname}</Text>
              <Text style={styles.authorMeta}>
                {selectedReviewPost.visitedAt || getRelativeTime(selectedReviewPost.createdAt)}
              </Text>
            </View>
          </View>

          <View style={styles.talkDetailBody}>
            <Text style={styles.detailTitle}>{selectedReviewPost.title}</Text>
            <Text style={styles.detailBody}>{selectedReviewPost.body}</Text>
          </View>

          {reviewPhotoUris.length || placeholderPhotoCount ? (
            <View style={styles.detailPhotoGrid}>
              {reviewPhotoUris.map((uri) => (
                <Pressable
                  accessibilityLabel="리뷰 사진 크게 보기"
                  accessibilityRole="imagebutton"
                  key={uri}
                  onPress={() => setSelectedPhotoUri(uri)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Image source={{ uri }} style={styles.detailPhoto} />
                </Pressable>
              ))}
              {Array.from({ length: placeholderPhotoCount }).map((_, index) => (
                <View key={`review-placeholder-${index}`} style={styles.detailPhotoPlaceholder}>
                  <Image source={PAW_LOGO} style={styles.detailPhotoPlaceholderLogo} />
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.reviewFeedbackRow}>
            <Pressable
              accessibilityLabel={helpful ? '도움돼요 취소' : '도움돼요'}
              accessibilityRole="button"
              accessibilityState={{ disabled: reviewReactionDisabled, selected: helpful }}
              disabled={reviewReactionDisabled}
              onPress={() => void toggleReviewReaction('helpful')}
              style={({ pressed }) => [
                styles.reviewFeedbackButton,
                helpful && styles.reviewFeedbackButtonActive,
                reviewReactionDisabled && styles.reviewFeedbackButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Image
                source={REVIEW_GOOD_ICON}
                style={[
                  styles.reviewFeedbackIcon,
                  { tintColor: helpful ? COLORS.primary : COLORS.gray600 },
                ]}
              />
              <Text style={[styles.reviewFeedbackText, helpful && styles.reviewFeedbackTextActive]}>
                도움돼요 {helpfulCount}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel={notHelpful ? '도움 안 돼요 취소' : '도움 안 돼요'}
              accessibilityRole="button"
              accessibilityState={{ disabled: reviewReactionDisabled, selected: notHelpful }}
              disabled={reviewReactionDisabled}
              onPress={() => void toggleReviewReaction('notHelpful')}
              style={({ pressed }) => [
                styles.reviewFeedbackButton,
                notHelpful && styles.reviewFeedbackButtonActive,
                notHelpful && styles.reviewFeedbackButtonDangerActive,
                reviewReactionDisabled && styles.reviewFeedbackButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Image
                source={REVIEW_NO_ICON}
                style={[
                  styles.reviewFeedbackIcon,
                  { tintColor: notHelpful ? COLORS.danger : COLORS.gray600 },
                ]}
              />
              <Text style={[styles.reviewFeedbackText, notHelpful && styles.reviewFeedbackTextDangerActive]}>
                도움 안 돼요 {notHelpfulCount}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
        <AppModal
          onClose={() => setReviewActionVisible(false)}
          title="리뷰 관리"
          variant="center"
          visible={reviewActionVisible}
        >
          <View style={styles.reviewActionSheet}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setReviewActionVisible(false);
                router.push({
                  pathname: '/community/write',
                  params: { postId: selectedReviewPost.id, type: 'review' },
                });
              }}
              style={({ pressed }) => [styles.reviewActionItem, pressed && styles.pressed]}
            >
              <AppIcon color={COLORS.primary} name="create-outline" size={22} />
              <Text style={styles.reviewActionText}>수정하기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setReviewActionVisible(false);
                setReviewDeleteVisible(true);
              }}
              style={({ pressed }) => [styles.reviewActionItem, pressed && styles.pressed]}
            >
              <AppIcon color={COLORS.danger} name="trash-outline" size={22} />
              <Text style={[styles.reviewActionText, styles.reviewActionDangerText]}>삭제하기</Text>
            </Pressable>
          </View>
        </AppModal>
        <AppModal
          onClose={() => {
            if (!reviewDeleting) setReviewDeleteVisible(false);
          }}
          primaryAction={{
            disabled: reviewDeleting,
            label: reviewDeleting ? '삭제 중' : '삭제',
            onPress: () => void handleDeleteReview(),
            variant: 'danger',
          }}
          secondaryAction={{
            disabled: reviewDeleting,
            label: '취소',
            onPress: () => setReviewDeleteVisible(false),
          }}
          title="리뷰를 삭제할까요?"
          variant="center"
          visible={reviewDeleteVisible}
        >
          <Text style={styles.modalDescription}>삭제하면 도움돼요 기록과 사진도 함께 정리돼요.</Text>
        </AppModal>
        <AppModal
          onClose={() => setModal(null)}
          primaryAction={{ label: '확인', onPress: () => setModal(null) }}
          title={modal?.title}
          variant="center"
          visible={Boolean(modal)}
        >
          <Text style={styles.modalDescription}>{modal?.description}</Text>
        </AppModal>
        <PhotoViewer onClose={() => setSelectedPhotoUri(null)} uri={selectedPhotoUri} />
      </ScreenLayout>
    );
  }

  if (!selectedPost) return null;

  if (selectedPost.kind === 'talk') {
    const author = resolveAuthor(selectedPost.author, profile, viewerId);
    const isMine = selectedPost.author.userId === viewerId;
    const talkPhotoUris = getCommunityImageUris(selectedPost.images, selectedPost.photoUris);
    const comments = getCommentsByPostId(selectedPost.id);
    const rootComments = comments.filter((comment) => !comment.parentId);
    const getReplies = (commentId: string) =>
      comments.filter((comment) => comment.parentId === commentId);
    const replyTargetName = replyingTo
      ? resolveAuthor(replyingTo.author, profile, viewerId).nickname
      : '';
    const liked = isReacted(selectedPost.id, 'like');

    return (
      <ScreenLayout
        headerFullWidth
        headerVariant="auth"
        leftAccessibilityLabel="소통 목록으로 돌아가기"
        onLeftPress={goBack}
        rightContent={
          isMine ? (
            <Pressable
              accessibilityLabel="소통 글 관리"
              accessibilityRole="button"
              hitSlop={SPACING.md}
              onPress={() => setTalkActionVisible(true)}
              style={({ pressed }) => [styles.headerActionButton, pressed && styles.pressed]}
            >
              <AppIcon color={COLORS.black} name="ellipsis-horizontal" size={24} />
            </Pressable>
          ) : undefined
        }
        title="소통"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={SIZE.topHeaderHeight + insets.top}
          style={styles.detailRoot}
        >
          <ScrollView
            contentContainerStyle={[
              styles.detailContent,
              styles.talkDetailContent,
              { paddingBottom: 88 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.authorRow}>
              <AuthorAvatar author={author} />
              <View style={styles.authorText}>
                <Text style={styles.authorName}>{author.nickname}</Text>
                <Text style={styles.authorMeta}>
                  {selectedPost.showNeighborhood && author.location
                    ? `${author.location} · `
                    : ''}
                  {getRelativeTime(selectedPost.createdAt)}
                </Text>
              </View>
              <Text style={styles.detailCategory}>{selectedPost.category}</Text>
            </View>

            <View style={styles.talkDetailBody}>
              <Text style={styles.detailTitle}>{selectedPost.title}</Text>
              <Text style={styles.detailBody}>{selectedPost.body}</Text>
            </View>
            <View style={styles.tagRow}>
              {selectedPost.tags.map((tag) => (
                <Text key={tag} style={styles.tagText}>
                  #{tag}
                </Text>
              ))}
            </View>
            {talkPhotoUris.length ? (
              <View style={styles.detailPhotoGrid}>
                {talkPhotoUris.map((uri) => (
                  <Pressable
                    accessibilityLabel="게시글 사진 크게 보기"
                    accessibilityRole="imagebutton"
                    key={uri}
                    onPress={() => setSelectedPhotoUri(uri)}
                    style={({ pressed }) => pressed && styles.pressed}
                  >
                    <Image source={{ uri }} style={styles.detailPhoto} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.talkDetailReactionRow}>
              <Pressable
                accessibilityLabel={liked ? '좋아요 취소' : '좋아요'}
                accessibilityRole="button"
                onPress={() => void toggleReaction(selectedPost.id, 'like')}
                style={({ pressed }) => [styles.talkDetailReactionButton, pressed && styles.pressed]}
              >
                <Image
                  source={REVIEW_GOOD_ICON}
                  style={[styles.talkDetailReactionIcon, { tintColor: COLORS.danger }]}
                />
                <Text style={[styles.detailReactionText, styles.likeText]}>
                  {getReactionCount(selectedPost.id, 'like')}
                </Text>
              </Pressable>
              <View style={styles.talkDetailReactionButton}>
                <AppIcon color={COLORS.primary} name="chatbubble-outline" size={23} />
                <Text style={styles.detailReactionText}>{comments.length}</Text>
              </View>
            </View>

            <View style={styles.talkCommentTitle}>
              <SectionTitle count={comments.length} title="댓글" />
            </View>
            <View style={styles.commentList}>
              {rootComments.map((comment) => {
                const replies = getReplies(comment.id);
                return (
                  <View key={comment.id} style={styles.commentThread}>
                    <CommentItem
                      author={resolveAuthor(comment.author, profile, viewerId)}
                      comment={comment}
                      isMine={comment.author.userId === viewerId}
                      onDelete={() => setCommentToDelete(comment)}
                      onEdit={() => {
                        setReplyingTo(null);
                        setEditingComment(comment);
                        setCommentText(comment.body);
                      }}
                      onReply={() => {
                        setEditingComment(null);
                        setReplyingTo(comment);
                        setCommentText('');
                      }}
                    />
                    {replies.map((reply) => (
                      <View key={reply.id} style={styles.commentReplyItem}>
                        <CommentItem
                          author={resolveAuthor(reply.author, profile, viewerId)}
                          comment={reply}
                          isMine={reply.author.userId === viewerId}
                          onDelete={() => setCommentToDelete(reply)}
                          onEdit={() => {
                            setReplyingTo(null);
                            setEditingComment(reply);
                            setCommentText(reply.body);
                          }}
                          onReply={() => {
                            setEditingComment(null);
                            setReplyingTo(comment);
                            setCommentText('');
                          }}
                        />
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.commentInputBar}>
            {editingComment || replyingTo ? (
              <View style={styles.commentComposerStatus}>
                <Text numberOfLines={1} style={styles.commentComposerStatusText}>
                  {editingComment
                    ? '댓글 수정 중'
                    : `${replyTargetName}님에게 답글 작성 중`}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={SPACING.sm}
                  onPress={() => {
                    setEditingComment(null);
                    setReplyingTo(null);
                    setCommentText('');
                  }}
                  style={({ pressed }) => [styles.commentCancelButton, pressed && styles.pressed]}
                >
                  <Text style={styles.commentCancelText}>취소</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.commentInputRow}>
              <TextInput
                accessibilityLabel="댓글 입력"
                onChangeText={setCommentText}
                placeholder={replyingTo ? '답글을 입력해주세요' : '댓글을 입력해주세요'}
                placeholderTextColor={COLORS.gray500}
                style={styles.commentInput}
                value={commentText}
              />
              <Pressable
                accessibilityLabel={replyingTo ? '답글 등록' : '댓글 등록'}
                accessibilityRole="button"
                disabled={!commentText.trim() || commentSubmitting}
                onPress={() => void handleSubmitComment()}
                style={({ pressed }) => [
                  styles.commentSendButton,
                  (!commentText.trim() || commentSubmitting) && styles.disabledSendButton,
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon
                  color={COLORS.background}
                  name="send"
                  size={19}
                  style={styles.commentSendIcon}
                />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>

        <AppModal
          onClose={() => setTalkActionVisible(false)}
          title="소통 글 관리"
          variant="center"
          visible={talkActionVisible}
        >
          <View style={styles.reviewActionSheet}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setTalkActionVisible(false);
                router.push({
                  pathname: '/community/write',
                  params: { postId: selectedPost.id, type: 'talk' },
                });
              }}
              style={({ pressed }) => [styles.reviewActionItem, pressed && styles.pressed]}
            >
              <AppIcon color={COLORS.primary} name="create-outline" size={22} />
              <Text style={styles.reviewActionText}>수정하기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setTalkActionVisible(false);
                setTalkDeleteVisible(true);
              }}
              style={({ pressed }) => [styles.reviewActionItem, pressed && styles.pressed]}
            >
              <AppIcon color={COLORS.danger} name="trash-outline" size={22} />
              <Text style={[styles.reviewActionText, styles.reviewActionDangerText]}>삭제하기</Text>
            </Pressable>
          </View>
        </AppModal>

        <AppModal
          onClose={() => {
            if (!talkDeleting) setTalkDeleteVisible(false);
          }}
          primaryAction={{
            disabled: talkDeleting,
            label: talkDeleting ? '삭제 중' : '삭제',
            onPress: () => void handleDeleteTalkPost(),
            variant: 'danger',
          }}
          secondaryAction={{
            disabled: talkDeleting,
            label: '취소',
            onPress: () => setTalkDeleteVisible(false),
          }}
          title="소통 글을 삭제할까요?"
          variant="center"
          visible={talkDeleteVisible}
        >
          <Text style={styles.modalDescription}>삭제하면 좋아요와 댓글도 함께 정리돼요.</Text>
        </AppModal>

        <AppModal
          onClose={() => setCommentToDelete(null)}
          primaryAction={{
            label: '삭제',
            onPress: () => void handleDeleteComment(),
            variant: 'danger',
          }}
          secondaryAction={{ label: '취소', onPress: () => setCommentToDelete(null) }}
          title="댓글을 삭제할까요?"
          variant="center"
          visible={Boolean(commentToDelete)}
        >
          <Text style={styles.modalDescription}>삭제한 댓글은 다시 복구할 수 없어요.</Text>
        </AppModal>

        <AppModal
          onClose={() => setModal(null)}
          primaryAction={{ label: '확인', onPress: () => setModal(null) }}
          title={modal?.title}
          variant="center"
          visible={Boolean(modal)}
        >
          <Text style={styles.modalDescription}>{modal?.description}</Text>
        </AppModal>

        <PhotoViewer onClose={() => setSelectedPhotoUri(null)} uri={selectedPhotoUri} />
      </ScreenLayout>
    );
  }

  const bookmarked = isBookmarked(selectedPost.id);
  const isMine = selectedPost.author.userId === viewerId;
  const canInquire = selectedPost.status !== '완료' && !isMine;
  const marketPhotoUris = getCommunityImageUris(selectedPost.images, selectedPost.photoUris);
  const imageCount = Math.max(1, marketPhotoUris.length || selectedPost.imageCount);
  const tradeStyle = MARKET_TRADE_STYLES[selectedPost.tradeType];
  const author = resolveAuthor(selectedPost.author, profile, viewerId);
  const priceParts = getMarketPriceParts(selectedPost.priceLabel);
  const moveImage = (direction: -1 | 1) => {
    setImageIndex((current) => (current + direction + imageCount) % imageCount);
  };
  const changeMarketStatus = async (status: MarketStatus) => {
    if (selectedPost.kind !== 'market') return;
    if (statusSubmitting) return;
    if (status === selectedPost.status) {
      setStatusPickerVisible(false);
      return;
    }
    if (selectedPost.status === '완료') {
      setStatusPickerVisible(false);
      setModal({
        description: '완료된 거래는 다시 진행 중이나 예약 중으로 바꿀 수 없어요.',
        title: '이미 완료된 거래예요',
      });
      return;
    }
    if (status === '완료') {
      setStatusPickerVisible(false);
      setPendingMarketStatus(status);
      return;
    }

    setStatusSubmitting(true);
    const result = await updateMarketStatus(selectedPost.id, status);
    setStatusSubmitting(false);
    setStatusPickerVisible(false);

    if (!result.ok) {
      setModal({
        description: '게시글 작성자만 거래 상태를 변경할 수 있어요.',
        title: '상태를 변경하지 못했어요',
      });
    }
  };
  const confirmMarketStatus = async () => {
    if (!pendingMarketStatus || selectedPost.kind !== 'market') return;
    if (statusSubmitting) return;

    setStatusSubmitting(true);
    const result = await updateMarketStatus(selectedPost.id, pendingMarketStatus);
    setStatusSubmitting(false);
    setPendingMarketStatus(null);

    if (!result.ok) {
      setModal({
        description: '거래 상태를 다시 확인해주세요.',
        title: '상태를 변경하지 못했어요',
      });
    }
  };
  const requestDeleteMarketPost = () => {
    if (selectedPost.kind !== 'market') return;
    setMarketActionVisible(false);

    if (selectedPost.status === '예약 중') {
      setModal({
        description: '예약 중인 게시글은 진행 중으로 되돌린 뒤 삭제할 수 있어요.',
        title: '예약 중인 거래예요',
      });
      return;
    }

    if (selectedPost.status === '완료') {
      setModal({
        description: '거래가 완료된 게시글은 삭제할 수 없어요.',
        title: '완료된 거래예요',
      });
      return;
    }

    setMarketDeleteVisible(true);
  };
  const handleDeleteMarketPost = async () => {
    if (selectedPost.kind !== 'market' || marketDeleting) return;

    setMarketDeleting(true);
    const result = await deletePost(selectedPost.id);
    setMarketDeleting(false);
    setMarketDeleteVisible(false);

    if (result.ok) {
      router.replace('/community');
      return;
    }

    setModal({
      description:
        result.reason === 'not-yours'
          ? '내가 작성한 장터 글만 삭제할 수 있어요.'
          : '거래 상태를 다시 확인해주세요.',
      title: '게시글을 삭제하지 못했어요',
    });
  };

  return (
    <ScreenLayout
      headerFullWidth
      headerVariant="auth"
      leftAccessibilityLabel="장터 목록으로 돌아가기"
      onLeftPress={goBack}
      rightContent={
        isMine ? (
          <Pressable
            accessibilityLabel="장터 글 관리"
            accessibilityRole="button"
            hitSlop={SPACING.md}
            onPress={() => setMarketActionVisible(true)}
            style={({ pressed }) => [styles.headerActionButton, pressed && styles.pressed]}
          >
            <AppIcon color={COLORS.black} name="ellipsis-horizontal" size={24} />
          </Pressable>
        ) : undefined
      }
      title="장터"
    >
      <View style={styles.marketDetailRoot}>
        <ScrollView
          contentContainerStyle={[
            styles.marketDetailContent,
            { paddingBottom: 112 + Math.max(SPACING.xl, insets.bottom) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.marketHero}>
            {marketPhotoUris[imageIndex] ? (
              <Pressable
                accessibilityLabel="상품 사진 크게 보기"
                accessibilityRole="imagebutton"
                onPress={() => setSelectedPhotoUri(marketPhotoUris[imageIndex])}
                style={styles.marketHeroPhotoButton}
              >
                <Image source={{ uri: marketPhotoUris[imageIndex] }} style={styles.marketHeroPhoto} />
              </Pressable>
            ) : (
              <Image source={PAW_LOGO} style={styles.marketHeroLogo} />
            )}
            {imageCount > 1 ? (
              <>
                <Pressable
                  accessibilityLabel="이전 상품 이미지"
                  accessibilityRole="button"
                  onPress={() => moveImage(-1)}
                  style={({ pressed }) => [
                    styles.imageNavButton,
                    styles.imageNavLeft,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon color={COLORS.gray600} name="chevron-back" size={24} />
                </Pressable>
                <Pressable
                  accessibilityLabel="다음 상품 이미지"
                  accessibilityRole="button"
                  onPress={() => moveImage(1)}
                  style={({ pressed }) => [
                    styles.imageNavButton,
                    styles.imageNavRight,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon color={COLORS.gray600} name="chevron-forward" size={24} />
                </Pressable>
              </>
            ) : null}
            <View style={styles.imageCountBadge}>
              <Text style={styles.imageCountText}>
                {imageIndex + 1}/{imageCount}
              </Text>
            </View>
          </View>
          <View style={styles.marketDetailCard}>
            <View style={styles.marketTopLine}>
              <Text
                style={[
                  styles.marketBadge,
                  { backgroundColor: tradeStyle.backgroundColor, color: tradeStyle.color },
                ]}
              >
                {selectedPost.tradeType}
              </Text>
              {isMine && selectedPost.status !== '완료' ? (
                <Pressable
                  accessibilityLabel="거래 상태 변경"
                  accessibilityRole="button"
                  hitSlop={SPACING.sm}
                  onPress={() => setStatusPickerVisible(true)}
                  style={({ pressed }) => [
                    styles.marketStatusButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.marketStatus}>{selectedPost.status}</Text>
                  <AppIcon color={COLORS.success} name="chevron-down" size={13} />
                </Pressable>
              ) : (
                <Text style={[styles.marketStatus, selectedPost.status === '완료' && styles.marketDone]}>
                  {selectedPost.status}
                </Text>
              )}
            </View>
            <Text style={styles.detailTitle}>{selectedPost.title}</Text>
            <View style={styles.marketDetailPriceRow}>
              <Text style={styles.marketDetailPrice}>{priceParts.price}</Text>
              {priceParts.offerAvailable ? (
                <Text style={styles.marketDetailOfferText}>가격 제안 가능</Text>
              ) : null}
            </View>
            <Text style={styles.marketDetailMeta}>
              {selectedPost.category} · {selectedPost.location} · {getRelativeTime(selectedPost.createdAt)}
            </Text>
            {selectedPost.expiresAt ? (
              <View style={styles.infoLine}>
                <Text style={styles.infoLabel}>유통기한</Text>
                <Text style={styles.infoValue}>{selectedPost.expiresAt}</Text>
              </View>
            ) : null}
            <View style={styles.marketDetailDivider} />
            <View style={styles.marketDescriptionBlock}>
              <Text style={styles.marketSectionTitle}>상세 설명</Text>
              <Text style={styles.marketDetailDescription}>{selectedPost.body}</Text>
            </View>
            {selectedPost.tags.length > 0 ? (
              <View style={[styles.tagRow, styles.marketDetailTags]}>
                {selectedPost.tags.map((tag) => (
                  <Text key={tag} style={styles.tagText}>
                    #{tag}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.sellerCard}>
            <AuthorAvatar author={author} />
            <View style={styles.authorText}>
              <Text style={styles.authorName}>{author.nickname}</Text>
            {author.introduction ? (
              <Text numberOfLines={1} style={styles.authorMeta}>
                {author.introduction}
              </Text>
            ) : null}
          </View>
          </View>
        </ScrollView>

        <View style={[styles.marketActionBar, { paddingBottom: Math.max(SPACING.xl, insets.bottom) }]}>
          <Pressable
            accessibilityLabel={bookmarked ? '찜 해제' : '찜하기'}
            accessibilityRole="button"
            onPress={() => void toggleBookmark(selectedPost.id)}
            style={({ pressed }) => [styles.marketActionHeart, pressed && styles.pressed]}
          >
            <AppIcon
              color={bookmarked ? COLORS.danger : COLORS.gray600}
              name={bookmarked ? 'heart' : 'heart-outline'}
              size={25}
            />
          </Pressable>
          <AppButton
            disabled={!canInquire}
            fullWidth={false}
            onPress={() =>
              setModal({
                description: '장터 문의는 채팅 기능이 열리면 바로 이용할 수 있어요.',
                title: '채팅 문의는 준비 중이에요',
              })
            }
            style={styles.marketChatButton}
            title={selectedPost.status === '완료' ? '거래 완료' : isMine ? '내 게시글이에요' : '채팅으로 문의하기'}
          />
        </View>
      </View>

      <AppModal
        animateSheetOnly
        contentContainerStyle={styles.statusModalContent}
        onClose={() => setStatusPickerVisible(false)}
        title="거래 상태 변경"
        visible={statusPickerVisible}
      >
        <Text style={styles.statusModalDescription}>현재 거래 상황에 맞게 상태를 바꿔주세요.</Text>
        <View style={styles.statusOptionList}>
          {MARKET_STATUSES.map((status) => {
            const selected = selectedPost.status === status;
            const disabled = selected || selectedPost.status === '완료';
            const description =
              status === '진행 중'
                ? '아직 거래할 수 있어요'
                : status === '예약 중'
                  ? '거래 약속을 잡아두었어요'
                  : '거래가 끝났어요';

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled, selected }}
                disabled={disabled || statusSubmitting}
                key={status}
                onPress={() => void changeMarketStatus(status)}
                style={({ pressed }) => [
                  styles.statusOption,
                  selected && styles.statusOptionSelected,
                  disabled && !selected && styles.statusOptionDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.statusOptionText}>
                  <Text style={[styles.statusOptionTitle, selected && styles.statusOptionTitleSelected]}>
                    {status}
                  </Text>
                  <Text style={styles.statusOptionDescription}>{description}</Text>
                </View>
                {selected ? (
                  <AppIcon color={COLORS.primary} name="checkmark-circle" size={24} />
                ) : (
                  <AppIcon color={COLORS.gray300} name="ellipse-outline" size={24} />
                )}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.statusModalNote}>완료로 변경한 거래는 다시 되돌릴 수 없어요.</Text>
      </AppModal>

      <AppModal
        onClose={() => {
          if (!statusSubmitting) setPendingMarketStatus(null);
        }}
        primaryAction={{
          disabled: statusSubmitting,
          label: '완료로 변경',
          loading: statusSubmitting,
          onPress: () => void confirmMarketStatus(),
        }}
        secondaryAction={{
          disabled: statusSubmitting,
          label: '취소',
          onPress: () => setPendingMarketStatus(null),
        }}
        title="거래를 완료할까요?"
        variant="center"
        visible={Boolean(pendingMarketStatus)}
      >
        <Text style={styles.modalDescription}>완료된 거래는 다시 진행 중이나 예약 중으로 바꿀 수 없어요.</Text>
      </AppModal>

      <AppModal
        onClose={() => setMarketActionVisible(false)}
        title="장터 글 관리"
        variant="center"
        visible={marketActionVisible}
      >
        <View style={styles.reviewActionSheet}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMarketActionVisible(false);
              router.push({
                pathname: '/community/write',
                params: { postId: selectedPost.id, type: 'market' },
              });
            }}
            style={({ pressed }) => [styles.reviewActionItem, pressed && styles.pressed]}
          >
            <AppIcon color={COLORS.primary} name="create-outline" size={22} />
            <Text style={styles.reviewActionText}>수정하기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={requestDeleteMarketPost}
            style={({ pressed }) => [styles.reviewActionItem, pressed && styles.pressed]}
          >
            <AppIcon color={COLORS.danger} name="trash-outline" size={22} />
            <Text style={[styles.reviewActionText, styles.reviewActionDangerText]}>삭제하기</Text>
          </Pressable>
        </View>
      </AppModal>

      <AppModal
        onClose={() => {
          if (!marketDeleting) setMarketDeleteVisible(false);
        }}
        primaryAction={{
          disabled: marketDeleting,
          label: marketDeleting ? '삭제 중' : '삭제',
          onPress: () => void handleDeleteMarketPost(),
          variant: 'danger',
        }}
        secondaryAction={{
          disabled: marketDeleting,
          label: '취소',
          onPress: () => setMarketDeleteVisible(false),
        }}
        title="장터 글을 삭제할까요?"
        variant="center"
        visible={marketDeleteVisible}
      >
        <Text style={styles.modalDescription}>삭제하면 찜 기록과 사진도 함께 정리돼요.</Text>
      </AppModal>

      <AppModal
        onClose={() => setModal(null)}
        primaryAction={{ label: '확인', onPress: () => setModal(null) }}
        title={modal?.title}
        variant="center"
        visible={Boolean(modal)}
      >
        <Text style={styles.modalDescription}>{modal?.description}</Text>
      </AppModal>
      <PhotoViewer onClose={() => setSelectedPhotoUri(null)} uri={selectedPhotoUri} />
    </ScreenLayout>
  );
}

export function CommunityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const {
    filterSession,
    getCommentCount,
    getReactionCount,
    hasLoadError,
    isReady,
    isBookmarked,
    posts,
    reloadCommunity,
    reviewPosts,
    toggleBookmark,
    updateFilterSession,
    viewerId,
  } = useCommunityStore();
  const { profile } = useMyPageStore();
  const [activeTab, setActiveTab] = useState<CommunityTab>(filterSession.activeTab);
  const [talkCategory, setTalkCategory] = useState<TalkCategory>(filterSession.talkCategory);
  const [marketCategory, setMarketCategory] = useState<MarketCategory>(filterSession.marketCategory);
  const [reviewCategory, setReviewCategory] = useState<ReviewCategory>(filterSession.reviewCategory);
  const [marketTradeTypes, setMarketTradeTypes] = useState<MarketTradeType[]>(filterSession.marketTradeTypes);
  const [marketStatuses, setMarketStatuses] = useState<MarketStatus[]>(filterSession.marketStatuses);
  const [filterVisible, setFilterVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<CommunityTab>(filterSession.searchTab);
  const [searchQuery, setSearchQuery] = useState(filterSession.searchQuery);
  const [modal, setModal] = useState<ModalState>(null);
  const sessionRestoredRef = useRef(false);
  const lastSavedSessionRef = useRef('');

  useEffect(() => {
    if (!isReady || sessionRestoredRef.current) return;

    sessionRestoredRef.current = true;
    setActiveTab(filterSession.activeTab);
    setTalkCategory(filterSession.talkCategory);
    setMarketCategory(filterSession.marketCategory);
    setReviewCategory(filterSession.reviewCategory);
    setMarketTradeTypes(filterSession.marketTradeTypes);
    setMarketStatuses(filterSession.marketStatuses);
    setSearchTab(filterSession.searchTab);
    setSearchQuery(filterSession.searchQuery);
    lastSavedSessionRef.current = JSON.stringify(filterSession);
  }, [filterSession, isReady]);

  useEffect(() => {
    if (!isReady || !sessionRestoredRef.current) return undefined;

    const nextSession = {
      activeTab,
      marketCategory,
      marketStatuses,
      marketTradeTypes,
      reviewCategory,
      searchQuery,
      searchTab,
      talkCategory,
    };
    const serializedSession = JSON.stringify(nextSession);
    if (serializedSession === lastSavedSessionRef.current) return undefined;

    const timer = setTimeout(() => {
      lastSavedSessionRef.current = serializedSession;
      updateFilterSession(nextSession);
    }, 180);

    return () => clearTimeout(timer);
  }, [
    activeTab,
    isReady,
    marketCategory,
    marketStatuses,
    marketTradeTypes,
    reviewCategory,
    searchQuery,
    searchTab,
    talkCategory,
    updateFilterSession,
  ]);

  const talkPosts = useMemo(
    () =>
      posts
        .filter((post): post is TalkPost => post.kind === 'talk')
        .filter((post) => talkCategory === '전체' || post.category === talkCategory)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [posts, talkCategory],
  );

  const marketPosts = useMemo(
    () =>
      posts
        .filter((post): post is MarketPost => post.kind === 'market')
        .filter((post) => marketCategory === '전체' || post.category === marketCategory)
        .filter((post) => marketTradeTypes.length === 0 || marketTradeTypes.includes(post.tradeType))
        .filter((post) => marketStatuses.length === 0 || marketStatuses.includes(post.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [marketCategory, marketStatuses, marketTradeTypes, posts],
  );

  const searchResults = useMemo<CommunitySearchResult[]>(() => {
    if (!normalizeText(searchQuery)) return [];

    if (searchTab === 'review') {
      return reviewPosts
        .filter((post) => hasReviewSearchMatch(post, searchQuery))
        .sort((a, b) => {
          const rankDiff = getReviewSearchRank(a, searchQuery) - getReviewSearchRank(b, searchQuery);
          if (rankDiff !== 0) return rankDiff;
          return b.createdAt.localeCompare(a.createdAt);
        })
        .map((post) => ({ kind: 'review', post }));
    }

    if (searchTab === 'talk') {
      return posts
        .filter((post): post is TalkPost => post.kind === 'talk')
        .filter((post) =>
          hasCommunityPostSearchMatch(post, searchQuery, resolveAuthor(post.author, profile, viewerId)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((post) => ({ kind: 'talk', post }));
    }

    return posts
      .filter((post): post is MarketPost => post.kind === 'market')
      .filter((post) =>
        hasCommunityPostSearchMatch(post, searchQuery, resolveAuthor(post.author, profile, viewerId)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((post) => ({ kind: 'market', post }));
  }, [posts, profile, reviewPosts, searchQuery, searchTab, viewerId]);

  const openSearch = () => {
    setSearchTab(activeTab);
    setSearchOpen(true);
  };

  useEffect(() => {
    if (params.tab === 'talk' || params.tab === 'market' || params.tab === 'review') {
      setActiveTab(params.tab);
    }
  }, [params.tab]);

  const closeSearch = () => {
    setSearchOpen(false);
  };

  const openPost = (postId: string) => {
    router.push({ pathname: '/community/[postId]', params: { postId } });
  };

  const openComingSoon = (title: string, description: string) => {
    setModal({ title, description });
  };

  const handleToggleMarketFilter = <T extends string,>(
    value: T,
    values: T[],
    setter: (nextValues: T[]) => void,
  ) => {
    setter(values.includes(value) ? values.filter((current) => current !== value) : [...values, value]);
  };

  useEffect(() => {
    if (!searchOpen) return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSearch();
      return true;
    });

    return () => subscription.remove();
  }, [searchOpen]);

  if (!isReady) {
    return (
      <ScreenLayout
        centerContent={<CommunityHeaderTitle />}
        headerFullWidth
        leftContent={
          <HeaderIconButton
            icon="chatbubble-outline"
            label="채팅 열기"
            onPress={() => openComingSoon('채팅은 곧 만날 수 있어요', '채팅 목록과 대화방은 곧 이용할 수 있어요.')}
          />
        }
        onRightPress={openSearch}
        rightAccessibilityLabel="커뮤니티 검색"
        rightContent={<HeaderIconButton icon="search-outline" label="커뮤니티 검색" onPress={openSearch} outlined />}
      >
        <LoadingView label="커뮤니티를 불러오고 있어요." />
      </ScreenLayout>
    );
  }

  if (hasLoadError) {
    return (
      <ScreenLayout
        centerContent={<CommunityHeaderTitle />}
        headerFullWidth
        leftContent={<View style={styles.headerIconButton} />}
        rightContent={<View style={styles.headerIconButton} />}
      >
        <EmptyState
          actionLabel="다시 시도"
          description="잠시 후 다시 커뮤니티를 열어주세요."
          icon={<AppIcon color={COLORS.primary} name="chatbubbles-outline" size={32} />}
          onActionPress={() => void reloadCommunity()}
          title="커뮤니티를 불러오지 못했어요."
        />
      </ScreenLayout>
    );
  }

  if (searchOpen) {
    return (
      <ScreenLayout
        headerFullWidth
        headerVariant="auth"
        leftAccessibilityLabel="커뮤니티로 돌아가기"
        onLeftPress={closeSearch}
        title="검색"
      >
        <View style={styles.searchRoot}>
          <AppInput
            autoFocus
            containerStyle={styles.searchInputContainer}
            leftElement={<AppIcon color={COLORS.gray500} name="search-outline" size={20} />}
            onChangeText={setSearchQuery}
            placeholder={searchTab === 'review' ? '병원, 장소, 샵 이름을 검색해보세요' : '검색어를 입력해주세요'}
            rightElement={
              searchQuery ? (
                <Pressable
                  accessibilityLabel="검색어 지우기"
                  accessibilityRole="button"
                  hitSlop={SPACING.sm}
                  onPress={() => setSearchQuery('')}
                >
                  <AppIcon color={COLORS.gray500} name="close-circle" size={19} />
                </Pressable>
              ) : null
            }
            value={searchQuery}
          />
          <TabSegment
            activeTab={searchTab}
            onChange={setSearchTab}
          />
          {!normalizeText(searchQuery) ? (
            <EmptyState
              description={
                searchTab === 'review'
                  ? '대상명, 리뷰 종류, 제목으로 검색할 수 있어요.'
                  : '제목, 내용, 카테고리, 태그, 지역으로 검색할 수 있어요.'
              }
              icon={<AppIcon color={COLORS.primary} name="search-outline" size={32} />}
              title="검색어를 입력해주세요"
            />
          ) : searchResults.length === 0 ? (
            <EmptyState
              description="다른 검색어로 다시 찾아보세요."
              icon={<AppIcon color={COLORS.primary} name="file-tray-outline" size={32} />}
              title="검색 결과가 없어요"
            />
          ) : (
            <ScrollView
              contentContainerStyle={styles.searchResults}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <SectionTitle count={searchResults.length} title="검색 결과" />
              {searchResults.map((result) =>
                result.kind === 'talk' ? (
                  <TalkCard
                    commentCount={getCommentCount(result.post.id)}
                    key={result.post.id}
                    likeCount={getReactionCount(result.post.id, 'like')}
                    onOpen={() => {
                      setSearchOpen(false);
                      openPost(result.post.id);
                    }}
                    post={result.post}
                  />
                ) : result.kind === 'market' ? (
                  <MarketCard
                    bookmarked={isBookmarked(result.post.id)}
                    key={result.post.id}
                    onOpen={() => {
                      setSearchOpen(false);
                      openPost(result.post.id);
                    }}
                    onToggleBookmark={() => void toggleBookmark(result.post.id)}
                    post={result.post}
                  />
                ) : (
                  <ReviewCard
                    author={resolveAuthor(result.post.author, profile, viewerId)}
                    key={result.post.id}
                    onPress={() => {
                      setSearchOpen(false);
                      openPost(result.post.id);
                    }}
                    post={result.post}
                  />
                ),
              )}
            </ScrollView>
          )}
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      centerContent={<CommunityHeaderTitle />}
      headerFullWidth
      leftContent={
        <HeaderIconButton
          icon="chatbubble-outline"
          label="채팅 열기"
          onPress={() => openComingSoon('채팅은 곧 만날 수 있어요', '채팅 목록과 대화방은 곧 이용할 수 있어요.')}
        />
      }
      rightContent={<HeaderIconButton icon="search-outline" label="커뮤니티 검색" onPress={openSearch} outlined />}
    >
      <ScrollView
        contentContainerStyle={styles.rootContent}
        showsVerticalScrollIndicator={false}
      >
        <TabSegment activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'talk' ? (
          <>
            <AdBanner />
            <ChipRow compact activeValue={talkCategory} onChange={setTalkCategory} values={TALK_CATEGORIES} />
            {talkPosts.length ? (
              talkPosts.map((post) => (
                <TalkCard
                  commentCount={getCommentCount(post.id)}
                  key={post.id}
                  likeCount={getReactionCount(post.id, 'like')}
                  onOpen={() => openPost(post.id)}
                  post={post}
                />
              ))
            ) : (
              <CommunityEmptyPosts icon="chatbubble-ellipses-outline" title="아직 소통 글이 등록되지 않았습니다" />
            )}
          </>
        ) : null}

        {activeTab === 'market' ? (
          <>
            <AdBanner />
            <View style={styles.marketFilterHeader}>
              <ChipRow
                activeValue={marketCategory}
                onChange={setMarketCategory}
                roomy
                values={MARKET_CATEGORIES}
              />
              <Pressable
                accessibilityLabel="장터 거래 필터"
                accessibilityRole="button"
                onPress={() => setFilterVisible(true)}
                style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
              >
                <AppIcon color={COLORS.primary} name="options-outline" size={17} />
                <Text style={styles.filterButtonText}>필터</Text>
              </Pressable>
            </View>
            {marketPosts.length ? (
              marketPosts.map((post) => (
                <MarketCard
                  bookmarked={isBookmarked(post.id)}
                  key={post.id}
                  onOpen={() => openPost(post.id)}
                  onToggleBookmark={() => void toggleBookmark(post.id)}
                  post={post}
                />
              ))
            ) : (
              <CommunityEmptyPosts icon="bag-outline" title="아직 장터 글이 등록되지 않았습니다" />
            )}
          </>
        ) : null}

        {activeTab === 'review' ? (
          <ReviewReadyContent
            category={reviewCategory}
            onCategoryChange={setReviewCategory}
            onOpenReview={openPost}
            posts={reviewPosts}
            profile={profile}
            viewerId={viewerId}
          />
        ) : null}
      </ScrollView>

      <Pressable
        accessibilityLabel={activeTab === 'review' ? '리뷰 글쓰기' : '커뮤니티 글쓰기'}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/community/write', params: { type: activeTab } })}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <AppIcon color={COLORS.background} name="add" size={34} />
      </Pressable>

      <AppModal
        animateSheetOnly
        contentContainerStyle={styles.filterModalContent}
        onClose={() => setFilterVisible(false)}
        primaryAction={{
          label: '적용',
          onPress: () => setFilterVisible(false),
        }}
        secondaryAction={{
          label: '초기화',
          onPress: () => {
            setMarketStatuses([]);
            setMarketTradeTypes([]);
          },
        }}
        title="장터 필터"
        visible={filterVisible}
      >
        <Text style={styles.filterTitle}>거래 유형</Text>
        <View style={styles.filterGrid}>
          {MARKET_TRADE_TYPES.map((type) => {
            const selected = marketTradeTypes.includes(type);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={type}
                onPress={() => handleToggleMarketFilter(type, marketTradeTypes, setMarketTradeTypes)}
                style={({ pressed }) => [
                  styles.filterOption,
                  selected && styles.filterOptionActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.filterOptionText, selected && styles.filterOptionTextActive]}>
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.filterTitle}>거래 상태</Text>
        <View style={styles.filterGrid}>
          {MARKET_STATUSES.map((status) => {
            const selected = marketStatuses.includes(status);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={status}
                onPress={() => handleToggleMarketFilter(status, marketStatuses, setMarketStatuses)}
                style={({ pressed }) => [
                  styles.filterOption,
                  selected && styles.filterOptionActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.filterOptionText, selected && styles.filterOptionTextActive]}>
                  {status}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </AppModal>

      <AppModal
        onClose={() => setModal(null)}
        primaryAction={{ label: '확인', onPress: () => setModal(null) }}
        title={modal?.title}
        variant="center"
        visible={Boolean(modal)}
      >
        <Text style={styles.modalDescription}>{modal?.description}</Text>
      </AppModal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  rootContent: {
    gap: SPACING.xl,
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.lg,
  },
  headerTitle: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
  },
  headerIconButton: {
    alignItems: 'center',
    borderRadius: RADIUS.round,
    height: SIZE.touchTarget,
    justifyContent: 'center',
    width: SIZE.touchTarget,
  },
  headerIconOutlined: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderWidth: 1,
    ...SHADOWS.segment,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    flexDirection: 'row',
    height: SIZE.segmentHeight,
    padding: SPACING.xs,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: RADIUS.round,
    flex: 1,
    height: SIZE.segmentIndicatorHeight,
    justifyContent: 'center',
  },
  segmentItemActive: {
    backgroundColor: COLORS.primary,
  },
  segmentLabel: {
    ...TYPOGRAPHY.selection,
    color: COLORS.gray600,
  },
  segmentLabelActive: {
    ...TYPOGRAPHY.selectionActive,
    color: COLORS.background,
  },
  adBanner: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderColor: COLORS.yellow,
    borderRadius: 24,
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  adText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  chipRow: {
    gap: SPACING.xs,
    paddingRight: SPACING.xxl,
  },
  chipRowCentered: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingLeft: SPACING.xxl,
  },
  categoryChip: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  categoryChipCompact: {
    paddingHorizontal: SPACING.xl + SPACING.xxs,
  },
  categoryChipRoomy: {
    paddingHorizontal: SPACING.xxl + SPACING.xxs,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  categoryChipTextActive: {
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  sectionCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  talkCard: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: 22,
    borderWidth: 1,
    gap: SPACING.xxs,
    minHeight: 90,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
  },
  cardHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  talkCategory: {
    ...TYPOGRAPHY.smallButton,
    borderRadius: RADIUS.round,
    overflow: 'hidden',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  cardTitle: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  cardDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  cardFooterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.xs,
  },
  reactionButton: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  metaItemProminent: {
    gap: SPACING.sm,
  },
  metaText: {
    ...TYPOGRAPHY.small,
  },
  metaTextProminent: {
    ...TYPOGRAPHY.caption,
    fontFamily: TYPOGRAPHY.button.fontFamily,
  },
  cardTime: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray500,
  },
  reviewCard: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: 22,
    borderWidth: 1,
    gap: SPACING.xxs,
    minHeight: 90,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
  },
  reviewCategory: {
    ...TYPOGRAPHY.smallButton,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    color: COLORS.primary,
    overflow: 'hidden',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  reviewRating: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  reviewRatingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  marketCard: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xl,
    minHeight: 98,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    position: 'relative',
  },
  marketThumbnail: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.md,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  marketThumbnailLogo: {
    height: 32,
    resizeMode: 'contain',
    width: 32,
  },
  marketContent: {
    flex: 1,
    gap: SPACING.xxs,
    position: 'relative',
  },
  marketTopLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  marketTradeBadge: {
    ...TYPOGRAPHY.caption,
    borderRadius: RADIUS.round,
    fontFamily: TYPOGRAPHY.label.fontFamily,
    overflow: 'hidden',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xxs,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  marketStatusBadge: {
    ...TYPOGRAPHY.caption,
    backgroundColor: COLORS.gray200,
    borderRadius: RADIUS.round,
    color: COLORS.gray600,
    fontFamily: TYPOGRAPHY.label.fontFamily,
    overflow: 'hidden',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xxs,
  },
  marketDoneBadge: {
    backgroundColor: COLORS.gray100,
    color: COLORS.gray500,
  },
  marketBadge: {
    ...TYPOGRAPHY.smallButton,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    color: COLORS.primary,
    fontSize: 12,
    lineHeight: 18,
    overflow: 'hidden',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xxs,
  },
  marketStatus: {
    ...TYPOGRAPHY.small,
    color: COLORS.success,
    fontFamily: TYPOGRAPHY.label.fontFamily,
    fontSize: 11,
    lineHeight: 16,
  },
  marketStatusButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
    minHeight: 30,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  marketDone: {
    color: COLORS.gray500,
  },
  marketTitle: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.label.fontFamily,
    paddingRight: 86,
  },
  marketMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  marketPriceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingRight: 36,
  },
  marketPrice: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  marketOfferText: {
    ...TYPOGRAPHY.small,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  marketBookmarkButton: {
    alignItems: 'center',
    bottom: 0,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 30,
  },
  marketFilterHeader: {
    gap: SPACING.xl,
  },
  filterButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: COLORS.background,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
    height: 32,
    paddingHorizontal: SPACING.md,
  },
  filterButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  fab: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    bottom: SIZE.tabBarHeight - SPACING.jumbo,
    height: 60,
    justifyContent: 'center',
    position: 'absolute',
    right: SPACING.jumbo,
    width: 60,
    ...SHADOWS.segment,
  },
  detailRoot: {
    flex: 1,
  },
  detailContent: {
    gap: SPACING.xxl,
    paddingTop: SPACING.xl,
  },
  talkDetailContent: {
    gap: SPACING.xxxl,
  },
  authorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  authorAvatar: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 44,
  },
  authorAvatarImage: {
    height: '100%',
    width: '100%',
  },
  authorText: {
    flex: 1,
  },
  authorName: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  authorMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  detailCategory: {
    ...TYPOGRAPHY.smallButton,
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.round,
    color: COLORS.primary,
    overflow: 'hidden',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  talkDetailBody: {
    gap: SPACING.lg,
    marginTop: SPACING.xs,
  },
  detailTitle: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
  },
  detailBody: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray800,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tagText: {
    ...TYPOGRAPHY.caption,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.round,
    color: COLORS.primary,
    overflow: 'hidden',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  detailPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  detailPhoto: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.lg,
    height: 86,
    width: 86,
  },
  photoViewerOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  photoViewerClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: RADIUS.round,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    right: SPACING.xxl,
    top: SPACING.xxxl,
    width: 42,
    zIndex: 1,
  },
  photoViewerImage: {
    height: '82%',
    resizeMode: 'contain',
    width: '100%',
  },
  detailPhotoPlaceholder: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.lg,
    height: 86,
    justifyContent: 'center',
    width: 86,
  },
  detailPhotoPlaceholderLogo: {
    height: 34,
    opacity: 0.65,
    resizeMode: 'contain',
    width: 34,
  },
  talkDetailReactionRow: {
    borderBottomColor: COLORS.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xl,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.xs,
  },
  talkDetailReactionButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    minHeight: 36,
    paddingRight: SPACING.md,
  },
  talkDetailReactionIcon: {
    height: 21,
    resizeMode: 'contain',
    width: 21,
  },
  detailReactionText: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray600,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  likeText: {
    color: COLORS.danger,
  },
  talkCommentTitle: {
    marginTop: SPACING.xs,
  },
  commentList: {
    gap: SPACING.xxxl,
  },
  commentThread: {
    gap: SPACING.lg,
  },
  commentReplyItem: {
    borderLeftColor: COLORS.borderSoft,
    borderLeftWidth: 2,
    marginLeft: 17,
    paddingLeft: SPACING.xxl,
  },
  deletedCommentItem: {
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  deletedCommentText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray500,
  },
  commentItem: {
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  commentBody: {
    flex: 1,
    gap: SPACING.xs,
  },
  commentHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  commentAuthor: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  commentTime: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray500,
  },
  commentText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray800,
  },
  commentActions: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  commentActionText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  commentInputBar: {
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.borderSoft,
    borderTopWidth: 1,
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  commentComposerStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  commentComposerStatusText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    flex: 1,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  commentInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  commentInput: {
    ...TYPOGRAPHY.input,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.round,
    color: COLORS.black,
    flex: 1,
    height: 48,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  commentCancelButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  commentCancelText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  commentSendButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  commentSendIcon: {
    transform: [{ translateX: 2 }],
  },
  disabledSendButton: {
    opacity: 0.45,
  },
  marketDetailRoot: {
    flex: 1,
  },
  marketDetailContent: {
    gap: SPACING.xl,
    paddingTop: SPACING.xl,
  },
  marketHero: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: 24,
    height: 224,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  marketHeroLogo: {
    height: 112,
    resizeMode: 'contain',
    width: 112,
  },
  marketHeroPhotoButton: {
    height: '100%',
    width: '100%',
  },
  marketHeroPhoto: {
    height: '100%',
    width: '100%',
  },
  imageCountBadge: {
    backgroundColor: 'rgba(26, 26, 26, 0.45)',
    borderRadius: RADIUS.round,
    bottom: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    position: 'absolute',
    right: SPACING.xxl,
  },
  imageNavButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: RADIUS.round,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    top: '45%',
    width: 42,
  },
  imageNavLeft: {
    left: SPACING.xxl,
  },
  imageNavRight: {
    right: SPACING.xxl,
  },
  imageCountText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.background,
  },
  marketDetailCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 1,
    gap: SPACING.lg,
    padding: SPACING.xxl,
    shadowColor: COLORS.black,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.025,
    shadowRadius: 5,
  },
  marketDetailPrice: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
  },
  marketDetailPriceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  marketDetailOfferText: {
    ...TYPOGRAPHY.caption,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    color: COLORS.primary,
    fontFamily: TYPOGRAPHY.label.fontFamily,
    overflow: 'hidden',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xxs,
  },
  marketDetailMeta: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    marginBottom: SPACING.sm,
  },
  marketDetailDivider: {
    backgroundColor: COLORS.borderSoft,
    height: 1,
    marginVertical: SPACING.xs,
  },
  marketDescriptionBlock: {
    gap: SPACING.sm,
  },
  marketSectionTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  marketDetailDescription: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray600,
    lineHeight: 23,
  },
  marketDetailTags: {
    marginTop: SPACING.xs,
  },
  reviewDetailContent: {
    gap: SPACING.xxl,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
  },
  reviewTargetCard: {
    alignItems: 'center',
    borderBottomColor: COLORS.borderSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  reviewTargetIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.lg,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  reviewScoreCard: {
    borderBottomColor: COLORS.borderSoft,
    borderBottomWidth: 1,
    gap: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  reviewScoreHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  reviewScoreValue: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
  },
  reviewScoreStars: {
    flexDirection: 'row',
    gap: SPACING.xxs,
  },
  reviewScoreRows: {
    gap: SPACING.xs,
  },
  reviewScoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  reviewScoreLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.label.fontFamily,
    width: 48,
  },
  reviewScoreTrack: {
    backgroundColor: COLORS.gray200,
    borderRadius: RADIUS.round,
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  reviewScoreFill: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    height: '100%',
  },
  reviewScoreNumber: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    textAlign: 'right',
    width: 18,
  },
  reviewFeedbackRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  reviewFeedbackButton: {
    alignItems: 'center',
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
    minHeight: 46,
  },
  reviewFeedbackButtonActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  reviewFeedbackButtonDangerActive: {
    backgroundColor: COLORS.errorBackground,
    borderColor: COLORS.danger,
  },
  reviewFeedbackButtonDisabled: {
    opacity: 0.48,
  },
  reviewFeedbackIcon: {
    height: 16,
    resizeMode: 'contain',
    width: 16,
  },
  reviewFeedbackText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  reviewFeedbackTextActive: {
    color: COLORS.primary,
  },
  reviewFeedbackTextDangerActive: {
    color: COLORS.danger,
  },
  reviewActionSheet: {
    gap: SPACING.sm,
  },
  reviewActionItem: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: SPACING.md,
    minHeight: 54,
    paddingHorizontal: SPACING.md,
  },
  reviewActionText: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  reviewActionDangerText: {
    color: COLORS.danger,
  },
  infoLine: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  infoLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  infoValue: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  sellerCard: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.lg,
    padding: SPACING.xl,
  },
  marketActionBar: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.borderSoft,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  marketActionHeart: {
    alignItems: 'center',
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 58,
  },
  marketChatButton: {
    flex: 1,
  },
  statusModalContent: {
    gap: SPACING.lg,
  },
  statusModalDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  statusOptionList: {
    gap: SPACING.md,
  },
  statusOption: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.borderSoft,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  statusOptionSelected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  statusOptionDisabled: {
    opacity: 0.48,
  },
  statusOptionText: {
    gap: SPACING.xxs,
  },
  statusOptionTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  statusOptionTitleSelected: {
    color: COLORS.primary,
  },
  statusOptionDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  statusModalNote: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
  },
  searchRoot: {
    flex: 1,
    gap: SPACING.xxl,
    paddingTop: SPACING.xl,
  },
  searchInputContainer: {
    marginBottom: SPACING.xs,
  },
  searchResults: {
    gap: SPACING.xl,
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
  },
  emptyPostsCard: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.borderSoft,
    borderRadius: 24,
    borderWidth: 1,
    gap: SPACING.xl,
    padding: SPACING.xxxl,
  },
  emptyPostsIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  emptyPostsTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
    textAlign: 'center',
  },
  filterModalContent: {
    gap: SPACING.xl,
  },
  filterTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterOption: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    minWidth: 86,
    paddingHorizontal: SPACING.xl,
  },
  filterOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterOptionText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  filterOptionTextActive: {
    color: COLORS.background,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  modalDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  headerActionButton: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pressed: {
    opacity: 0.65,
  },
});
