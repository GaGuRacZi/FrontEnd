import type {
  CommunityComment,
  CommunityPost,
  MarketPost,
  PostKind,
  ReviewPost,
  TalkPost,
} from '../community/types';

export type CommunityActivityFilter = 'all' | PostKind;

type TalkActivityItem = {
  createdAt: string;
  kind: 'talk';
  post: TalkPost;
  postId: string;
};

type MarketActivityItem = {
  createdAt: string;
  kind: 'market';
  post: MarketPost;
  postId: string;
};

type ReviewActivityItem = {
  createdAt: string;
  kind: 'review';
  post: ReviewPost;
  postId: string;
};

export type CommunityActivityItem =
  | MarketActivityItem
  | ReviewActivityItem
  | TalkActivityItem;

export type CommentedActivityItem = TalkActivityItem & {
  commentCount: number;
  latestComment: CommunityComment;
};

export function getCommunityActivityKey(
  item: Pick<CommunityActivityItem, 'kind' | 'postId'>,
) {
  return `${item.kind}:${item.postId}`;
}

type CommunityPostsInput = {
  posts: readonly CommunityPost[];
  reviewPosts: readonly ReviewPost[];
  userId: string | null;
};

type SavedPostsInput = {
  isBookmarked: (postId: string) => boolean;
  isReacted: (postId: string, kind: 'like') => boolean;
  posts: readonly CommunityPost[];
  userId: string | null;
  viewerId: string;
};

type CommentedPostsInput = {
  comments: readonly CommunityComment[];
  posts: readonly CommunityPost[];
  userId: string | null;
};

function getTimestamp(value: string) {
  return Date.parse(value);
}

function compareNewest(a: CommunityActivityItem, b: CommunityActivityItem) {
  return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
}

function toPostActivityItem(post: CommunityPost): MarketActivityItem | TalkActivityItem {
  if (post.kind === 'talk') {
    return {
      createdAt: post.createdAt,
      kind: 'talk',
      post,
      postId: post.id,
    };
  }

  return {
    createdAt: post.createdAt,
    kind: 'market',
    post,
    postId: post.id,
  };
}

export function selectAuthoredActivityItems({
  posts,
  reviewPosts,
  userId,
}: CommunityPostsInput): CommunityActivityItem[] {
  if (!userId) return [];

  return [
    ...posts
      .filter((post) => post.author.userId === userId)
      .map(toPostActivityItem),
    ...reviewPosts
      .filter((post) => post.author.userId === userId)
      .map((post): ReviewActivityItem => ({
        createdAt: post.createdAt,
        kind: 'review',
        post,
        postId: post.id,
      })),
  ].sort(compareNewest);
}

export function selectSavedActivityItems({
  isBookmarked,
  isReacted,
  posts,
  userId,
  viewerId,
}: SavedPostsInput): CommunityActivityItem[] {
  if (!userId || userId !== viewerId) return [];

  return posts
    .filter((post) =>
      post.kind === 'talk'
        ? isReacted(post.id, 'like')
        : isBookmarked(post.id),
    )
    .map(toPostActivityItem)
    .sort(compareNewest);
}

export function selectCommentedActivityItems({
  comments,
  posts,
  userId,
}: CommentedPostsInput): CommentedActivityItem[] {
  if (!userId) return [];

  const commentSummaries = new Map<
    string,
    { count: number; latest: CommunityComment }
  >();
  comments.forEach((comment) => {
    if (comment.deletedAt || comment.author.userId !== userId) return;
    const previous = commentSummaries.get(comment.postId);
    const createdAt = getTimestamp(comment.createdAt);
    const previousCreatedAt = previous ? getTimestamp(previous.latest.createdAt) : 0;
    if (
      !previous ||
      createdAt > previousCreatedAt ||
      (createdAt === previousCreatedAt && comment.id > previous.latest.id)
    ) {
      commentSummaries.set(comment.postId, {
        count: (previous?.count ?? 0) + 1,
        latest: comment,
      });
      return;
    }
    previous.count += 1;
  });

  return posts
    .filter((post): post is TalkPost => post.kind === 'talk' && commentSummaries.has(post.id))
    .map((post): CommentedActivityItem => {
      const { count, latest: latestComment } = commentSummaries.get(post.id)!;
      return {
        commentCount: count,
        createdAt: latestComment.createdAt,
        kind: 'talk',
        latestComment,
        post,
        postId: post.id,
      };
    })
    .sort(compareNewest);
}

export function getActivityFilterCounts(items: readonly CommunityActivityItem[]) {
  const counts: Record<CommunityActivityFilter, number> = {
    all: 0,
    market: 0,
    review: 0,
    talk: 0,
  };
  items.forEach((item) => {
    counts.all += 1;
    counts[item.kind] += 1;
  });
  return counts;
}

export function filterActivityItems(
  items: readonly CommunityActivityItem[],
  filter: CommunityActivityFilter,
) {
  return filter === 'all' ? [...items] : items.filter((item) => item.kind === filter);
}
