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

const koreanDateTime = loadModule('../src/utils/koreanDateTime.ts', {});
const timezoneLessDate = '2026-08-20T10:00:00';
assert.equal(
  koreanDateTime.parseKoreanServerDate(timezoneLessDate)?.getTime(),
  Date.parse('2026-08-20T10:00:00+09:00'),
);
assert.equal(
  koreanDateTime.formatKoreanRelativeTime(
    timezoneLessDate,
    Date.parse('2026-08-20T10:30:00+09:00'),
  ),
  '30분 전',
);
assert.equal(koreanDateTime.formatKoreanChatTime(timezoneLessDate), '오전 10:00');
assert.equal(
  koreanDateTime.isSameKoreanCalendarDate('2026-08-20T14:30:00Z', '2026-08-20T15:30:00Z'),
  false,
);

let likeRequest;
let locationRequestCount = 0;
const regionQueries = [];
const imageAppends = [];
let createData;
let createRequest;
let updateData;
let updateRequest;
const marketDetail = {
  authorNickname: '나',
  commentCount: 1,
  content: '개봉만 했습니다.',
  createdAt: '2026-08-19T10:00:00+09:00',
  expiryDate: '2026-09-01',
  hashTags: ['나눔'],
  likeCount: 3,
  likedByMe: false,
  marketStatus: 'IN_PROGRESS',
  photos: [{ isThumbnail: true, photoId: 1, sortOrder: 0, url: 'https://cdn.example.com/saved.jpg' }],
  postId: 10,
  postType: 'MARKET',
  price: null,
  priceNegotiable: false,
  regionName: '서울특별시 종로구',
  tagCode: 'FOOD_SNACK',
  tagName: '사료·간식',
  thumbnailUrl: 'https://cdn.example.com/saved.jpg',
  title: '사료 나눔',
  tradeMethod: 'DIRECT',
  tradeType: 'SHARE',
  viewCount: 13,
};
const communityApi = loadModule('../src/features/community/services/communityApi.ts', {
  '@/src/services/apiClient': {
    apiRequest: async (path, options) => {
      if (path === '/communities/10/likes') {
        likeRequest = { options, path };
        return {
          code: 'LIKE_TOGGLE_200',
          isSuccess: true,
          message: 'ok',
          result: { liked: true, likeCount: 4 },
        };
      }
      if (path === '/communities/10' && !options) {
        return {
          code: 'COMMUNITY_DETAIL_200',
          isSuccess: true,
          message: 'ok',
          result: marketDetail,
        };
      }
      if (path === '/communities') {
        createRequest = { options, path };
        return {
          code: 'COMMUNITY_CREATE_200',
          isSuccess: true,
          message: 'ok',
          result: { ...marketDetail, postId: 11 },
        };
      }
      updateRequest = { options, path };
      return {
        code: 'COMMUNITY_UPDATE_200',
        isSuccess: true,
        message: 'ok',
        result: { ...marketDetail, marketStatus: 'RESERVED' },
      };
    },
  },
  '@/src/services/locationApi': {
    getRemoteUserLocation: async () => {
      locationRequestCount += 1;
      throw new Error('location-unavailable');
    },
    searchRemoteRegions: async (query) => {
      regionQueries.push(query);
      return [{ code: '1111000000', dongPreview: [], name: '서울특별시 종로구' }];
    },
  },
  '@/src/utils/file': {
    appendMultipartImage: (_formData, field, uri) => imageAppends.push({ field, uri }),
    appendMultipartJson: (_formData, data) => {
      if (data.postType === 'MARKET') createData = data;
      else updateData = data;
    },
  },
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

assert.equal(
  communityApi.mapRemotePost(
    { ...page.items[0], tagCode: 'NEW_TAG', tagName: '새 소통 카테고리' },
    { profile: null, userId: 'user-me' },
  ).category,
  '새 소통 카테고리',
);

const imageUpdatePost = {
  author: { nickname: '나', userId: 'user-me' },
  baseBookmarkCount: 0,
  baseReactionCounts: { like: 0 },
  body: '사진 순서를 바꿨어요.',
  category: '건강상담',
  categoryCode: 'HEALTH_CONSULT',
  createdAt: '2026-08-19T10:00:00+09:00',
  id: '10',
  images: [
    { assetId: 'new-photo', localUri: 'file:///new.jpg' },
    { assetId: 'saved-photo', url: 'https://cdn.example.com/saved.jpg' },
  ],
  kind: 'talk',
  showNeighborhood: false,
  tags: [],
  title: '사진 순서',
  updatedAt: '2026-08-19T10:00:00+09:00',
};
const imageUpdate = communityApi.createRemotePostData(
  imageUpdatePost,
  [{ code: 'HEALTH_CONSULT', name: '건강상담', postType: 'COMMUNICATION', sortOrder: 1 }],
  true,
);
assert.equal(imageUpdate.data.thumbnailIndex, 1);
assert.deepEqual(imageUpdate.data.keepPhotoUrls, ['https://cdn.example.com/saved.jpg']);
assert.equal(
  communityApi.createRemotePostData({
    ...imageUpdatePost,
    images: [
      { assetId: 'saved-photo', url: 'https://cdn.example.com/saved.jpg' },
      { assetId: 'new-photo', localUri: 'file:///new.jpg' },
    ],
  }, [{ code: 'HEALTH_CONSULT', name: '건강상담', postType: 'COMMUNICATION', sortOrder: 1 }], true).data.thumbnailUrl,
  'https://cdn.example.com/saved.jpg',
);
assert.deepEqual(
  communityApi.createRemotePostData({
    ...imageUpdatePost,
    images: [],
  }, [{ code: 'HEALTH_CONSULT', name: '건강상담', postType: 'COMMUNICATION', sortOrder: 1 }], true).data.keepPhotoUrls,
  [],
);

assert.deepEqual(
  communityApi.mapRemotePost(communityApi.parseRemoteCommunityDetail({
    code: 'COMMUNITY_DETAIL_200',
    isSuccess: true,
    message: 'ok',
    result: {
      ...page.items[0],
      content: '사진 순서를 확인해요.',
      hashTags: [],
      likedByMe: false,
      marketStatus: 'IN_PROGRESS',
      photos: [
        { isThumbnail: false, photoId: 'first', sortOrder: 0, url: 'https://cdn.example.com/first.jpg' },
        { isThumbnail: true, photoId: 'thumbnail', sortOrder: 1, url: 'https://cdn.example.com/thumbnail.jpg' },
      ],
      postType: 'MARKET',
      tradeMethod: 'DIRECT',
      tradeType: 'SHARE',
    },
  }), { profile: null, userId: 'user-me' }).photoUris,
  ['https://cdn.example.com/thumbnail.jpg', 'https://cdn.example.com/first.jpg'],
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

assert.deepEqual(await communityApi.toggleRemoteCommunityLike('10'), { liked: true, likeCount: 4 });
assert.deepEqual(likeRequest, {
  options: { method: 'PATCH' },
  path: '/communities/10/likes',
});

const createdMarketPost = await communityApi.createRemoteCommunityPost({
  author: { nickname: '나', userId: 'user-me' },
  baseBookmarkCount: 0,
  body: '개봉만 했습니다.',
  category: '사료·간식',
  categoryCode: 'FOOD_SNACK',
  createdAt: '2026-08-20T10:00:00+09:00',
  id: '',
  imageCount: 1,
  images: [{ assetId: 'new-photo', localUri: 'file:///market.jpg' }],
  kind: 'market',
  location: '서울특별시 종로구',
  priceLabel: '무료 나눔',
  status: '진행 중',
  tags: ['사료·간식', '나눔', '직거래'],
  title: '사료 나눔',
  tradeType: '나눔',
  updatedAt: '2026-08-20T10:00:00+09:00',
}, [{ code: 'FOOD_SNACK', name: '사료·간식', postType: 'MARKET', sortOrder: 1 }], '1111000000');
assert.equal(createdMarketPost.postId, '11');
assert.equal(createRequest.path, '/communities');
assert.equal(createRequest.options.method, 'POST');
assert.deepEqual(createData, {
  content: '개봉만 했습니다.',
  expiryDate: undefined,
  hashTags: [],
  price: null,
  priceNegotiable: false,
  postType: 'MARKET',
  regionCode: '1111000000',
  tagCode: 'FOOD_SNACK',
  thumbnailIndex: 0,
  title: '사료 나눔',
  tradeMethod: 'DIRECT',
  tradeType: 'SHARE',
});
assert.deepEqual(imageAppends, [{ field: 'images', uri: 'file:///market.jpg' }]);

const updatedMarketPost = await communityApi.updateRemoteMarketStatus(
  '10',
  '예약 중',
  [{ code: 'FOOD_SNACK', name: '사료·간식', postType: 'MARKET', sortOrder: 1 }],
  {
    profile: { introduction: '', location: '서울특별시 종로구', nickname: '나', profileImageUri: null },
    userId: 'user-me',
  },
);
assert.equal(updatedMarketPost.marketStatus, 'RESERVED');
assert.equal(locationRequestCount, 0);
assert.deepEqual(regionQueries, ['서울특별시 종로구']);
assert.equal(updateRequest.path, '/communities/10');
assert.equal(updateRequest.options.method, 'PUT');
assert.equal(updateData.marketStatus, 'RESERVED');
assert.equal(updateData.regionCode, '1111000000');
assert.equal(updateData.tradeMethod, 'DIRECT');
assert.equal(updateData.tradeType, 'SHARE');
assert.deepEqual(updateData.keepPhotoUrls, ['https://cdn.example.com/saved.jpg']);
assert.equal(updateData.thumbnailUrl, 'https://cdn.example.com/saved.jpg');

const storeSource = readFileSync(new URL('../src/features/community/CommunityStore.tsx', import.meta.url), 'utf8');
assert.match(storeSource, /applyState\(nextState\);\s+void communityRepository\.saveState\(nextState\)/);
assert.match(storeSource, /localPost\.location === profileLocation \? profileRegionCode/);

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
