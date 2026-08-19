import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadModule(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(module, module.exports, (id) => {
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected import: ${id}`);
  });
  return module.exports;
}

const communityApi = loadModule('../src/features/community/services/communityApi.ts', {
  '@/src/services/apiClient': { apiRequest: async () => undefined },
  '@/src/services/locationApi': { getRemoteUserLocation: async () => ({ regionCode: '1111000000' }) },
  '@/src/utils/file': { appendMultipartImage: () => undefined, appendMultipartJson: () => undefined },
  '../utils/marketValidation': {
    getMarketTradeMethods: (tags) => tags.filter((tag) => ['직거래', '택배', '비대면 나눔'].includes(tag)),
    getPositiveMarketPrice: () => null,
  },
});

const talkListEnvelope = {
  code: 'COMMUNITY_LIST_200',
  isSuccess: true,
  message: 'ok',
  result: {
    content: [{
      authorNickname: '보호자',
      commentCount: 2,
      contentPreview: '산책 후 발바닥이 빨개요.',
      createdAt: '2026-08-19T10:00:00+09:00',
      likeCount: 3,
      postId: 10,
      postType: 'COMMUNICATION',
      price: null,
      priceNegotiable: false,
      tagCode: 'HEALTH_CONSULT',
      tagName: '건강상담',
      title: '병원에 가야 할까요?',
      viewCount: 4,
    }],
    hasNext: false,
    nextCursor: null,
    size: 50,
  },
};

const page = communityApi.parseRemoteCommunityPage(talkListEnvelope);
assert.equal(page.items[0].postId, '10');
assert.equal(page.items[0].content, '산책 후 발바닥이 빨개요.');
assert.equal(page.hasNext, false);
assert.deepEqual(
  communityApi.mapRemotePost(page.items[0], {
    profile: null,
    userId: 'user-me',
  }),
  {
    author: { nickname: '보호자', profileImageUri: null, userId: 'community-author-10' },
    baseBookmarkCount: 0,
    baseCommentCount: 2,
    baseReactionCounts: { like: 3 },
    body: '산책 후 발바닥이 빨개요.',
    category: '건강상담',
    categoryCode: 'HEALTH_CONSULT',
    createdAt: '2026-08-19T10:00:00+09:00',
    id: '10',
    images: [],
    kind: 'talk',
    photoUris: [],
    showNeighborhood: false,
    tags: [],
    title: '병원에 가야 할까요?',
    updatedAt: '2026-08-19T10:00:00+09:00',
  },
);

assert.deepEqual(
  communityApi.parseRemoteCommunityTags({
    code: 'COMMUNITY_TAG_LIST_200',
    isSuccess: true,
    message: 'ok',
    result: [{ postType: 'MARKET', sortOrder: 1, tagCode: 'FOOD_SNACK', tagName: '사료·간식' }],
  }),
  [{ code: 'FOOD_SNACK', name: '사료·간식', postType: 'MARKET', sortOrder: 1 }],
);

assert.deepEqual(
  communityApi.parseRemoteLikeMutation({
    code: 'LIKE_TOGGLE_200',
    isSuccess: true,
    message: 'ok',
    result: { liked: true, likeCount: 4 },
  }),
  { liked: true, likeCount: 4 },
);

assert.deepEqual(
  communityApi.parseRemoteCommentMutation({
    code: 'COMMENT_CREATE_200',
    isSuccess: true,
    message: 'ok',
    result: {
      authorNickname: '나',
      commentId: 11,
      content: '좋은 정보예요.',
      createdAt: '2026-08-19T11:00:00+09:00',
      deleted: false,
      parentId: null,
      postId: 10,
    },
  }, 'COMMENT_CREATE_200', {
    profile: { introduction: '', location: '', nickname: '나', profileImageUri: null },
    userId: 'user-me',
  }),
  {
    author: { introduction: '', location: '', nickname: '나', profileImageUri: null, userId: 'user-me' },
    body: '좋은 정보예요.',
    createdAt: '2026-08-19T11:00:00+09:00',
    id: '11',
    parentId: undefined,
    postId: '10',
    updatedAt: '2026-08-19T11:00:00+09:00',
  },
);

assert.throws(() => communityApi.parseRemoteCommunityPage({ ...talkListEnvelope, code: 'COMMUNITY_DETAIL_200' }));
