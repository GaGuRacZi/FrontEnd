import assert from 'node:assert/strict';

import {
  filterActivityItems,
  getCommunityActivityKey,
  getActivityFilterCounts,
  selectAuthoredActivityItems,
  selectCommentedActivityItems,
  selectSavedActivityItems,
} from '../src/features/mypage/communityActivitySelectors.ts';

const userId = 'user-me';
const author = (id) => ({ nickname: id, userId: id });
const talk = (id, ownerId, createdAt) => ({
  author: author(ownerId),
  createdAt,
  id,
  kind: 'talk',
});
const market = (id, ownerId, createdAt) => ({
  author: author(ownerId),
  createdAt,
  id,
  kind: 'market',
});
const review = (id, ownerId, createdAt) => ({
  author: author(ownerId),
  createdAt,
  id,
});

const myTalk = talk('shared-id', userId, '2026-08-01T00:00:00.000Z');
const myMarket = market('shared-id', userId, '2026-08-02T00:00:00.000Z');
const likedTalk = talk('talk-liked', 'user-other', '2026-08-03T00:00:00.000Z');
const savedMarket = market('market-saved', 'user-other', '2026-08-04T00:00:00.000Z');
const myReview = review('shared-id', userId, '2026-08-05T00:00:00.000Z');
const posts = [myTalk, myMarket, likedTalk, savedMarket];

const authored = selectAuthoredActivityItems({
  posts,
  reviewPosts: [myReview],
  userId,
});
assert.deepEqual(authored.map(({ kind }) => kind), ['review', 'market', 'talk']);
assert.deepEqual(authored.map(getCommunityActivityKey), [
  'review:shared-id',
  'market:shared-id',
  'talk:shared-id',
]);
assert.deepEqual(getActivityFilterCounts(authored), {
  all: 3,
  market: 1,
  review: 1,
  talk: 1,
});
assert.deepEqual(
  filterActivityItems(authored, 'review').map(({ postId }) => postId),
  ['shared-id'],
);

const saved = selectSavedActivityItems({
  isBookmarked: (postId) => postId === 'market-saved',
  isReacted: (postId) => postId === 'talk-liked',
  posts,
  userId,
  viewerId: userId,
});
assert.deepEqual(saved.map(({ postId }) => postId), ['market-saved', 'talk-liked']);
assert.deepEqual(getActivityFilterCounts(saved), {
  all: 2,
  market: 1,
  review: 0,
  talk: 1,
});
assert.deepEqual(
  filterActivityItems(saved, 'talk').map(({ postId }) => postId),
  ['talk-liked'],
);
assert.deepEqual(
  filterActivityItems(saved, 'market').map(({ postId }) => postId),
  ['market-saved'],
);
assert.equal(
  selectSavedActivityItems({
    isBookmarked: () => true,
    isReacted: () => true,
    posts,
    userId,
    viewerId: 'different-user',
  }).length,
  0,
);

const comments = [
  {
    author: author(userId),
    body: '첫 댓글',
    createdAt: '2026-08-06T00:00:00.000Z',
    id: 'comment-old',
    postId: 'talk-liked',
  },
  {
    author: author(userId),
    body: '가장 최근 답글',
    createdAt: '2026-08-07T00:00:00.000Z',
    id: 'comment-latest',
    parentId: 'comment-root',
    postId: 'talk-liked',
  },
  {
    author: author(userId),
    body: '삭제된 댓글',
    createdAt: '2026-08-08T00:00:00.000Z',
    deletedAt: '2026-08-09T00:00:00.000Z',
    id: 'comment-deleted',
    postId: 'talk-liked',
  },
  {
    author: author(userId),
    body: '삭제된 게시글의 댓글',
    createdAt: '2026-08-10T00:00:00.000Z',
    id: 'comment-orphaned',
    postId: 'talk-deleted',
  },
];
const commented = selectCommentedActivityItems({ comments, posts, userId });
assert.equal(commented.length, 1);
assert.equal(commented[0]?.postId, 'talk-liked');
assert.equal(commented[0]?.commentCount, 2);
assert.equal(commented[0]?.latestComment.id, 'comment-latest');
assert.equal(commented[0]?.latestComment.parentId, 'comment-root');

const offsetPosts = [
  talk('offset-older', userId, '2026-08-15T10:00:00+09:00'),
  market('offset-newer', userId, '2026-08-15T02:00:00Z'),
];
assert.deepEqual(
  selectAuthoredActivityItems({ posts: offsetPosts, reviewPosts: [], userId }).map(
    ({ postId }) => postId,
  ),
  ['offset-newer', 'offset-older'],
);

const offsetComments = [
  {
    author: author(userId),
    body: '먼저 작성한 댓글',
    createdAt: '2026-08-15T10:00:00+09:00',
    id: 'offset-comment-older',
    postId: 'talk-liked',
  },
  {
    author: author(userId),
    body: '나중에 작성한 댓글',
    createdAt: '2026-08-15T02:00:00Z',
    id: 'offset-comment-newer',
    postId: 'talk-liked',
  },
];
assert.equal(
  selectCommentedActivityItems({ comments: offsetComments, posts, userId })[0]
    ?.latestComment.id,
  'offset-comment-newer',
);
