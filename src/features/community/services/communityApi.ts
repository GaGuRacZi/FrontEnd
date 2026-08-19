import { apiRequest } from '@/src/services/apiClient';
import { getRemoteUserLocation } from '@/src/services/locationApi';
import { appendMultipartImage, appendMultipartJson } from '@/src/utils/file';

import type { UserProfile } from '@/src/features/mypage/types';

import type {
  CommunityAuthorSnapshot,
  CommunityComment,
  CommunityImageAsset,
  CommunityPost,
  MarketCategory,
  MarketPost,
  MarketStatus,
  MarketTradeMethod,
  MarketTradeType,
  TalkCategory,
  TalkPost,
} from '../types';
import { getMarketTradeMethods, getPositiveMarketPrice } from '../utils/marketValidation';

type RemotePostType = 'COMMUNICATION' | 'MARKET';
type RemoteTradeMethod = 'CONTACTLESS_SHARE' | 'DELIVERY' | 'DIRECT';
type RemoteTradeType = 'EXCHANGE' | 'SELL' | 'SHARE' | 'WANT';
type RemoteMarketStatus = 'COMPLETED' | 'IN_PROGRESS' | 'RESERVED';

export type RemoteCommunityTag = {
  code: string;
  name: string;
  postType: RemotePostType;
  sortOrder: number;
};

export type RemoteCommunityPost = {
  authorNickname: string;
  commentCount: number;
  content: string;
  createdAt: string;
  expiryDate: string | null;
  hashTags: string[];
  likeCount: number;
  likedByMe: boolean | null;
  marketStatus: RemoteMarketStatus | null;
  photos: CommunityImageAsset[];
  postId: string;
  postType: RemotePostType;
  price: number | null;
  priceNegotiable: boolean;
  regionName: string | null;
  tagCode: string;
  tagName: string;
  thumbnailUrl: string | null;
  title: string;
  tradeMethod: RemoteTradeMethod | null;
  tradeType: RemoteTradeType | null;
  viewCount: number;
};

export type RemoteCommunityPage = {
  hasNext: boolean;
  items: RemoteCommunityPost[];
  nextCursor: string | null;
};

export class CommunityApiContractError extends Error {
  constructor() {
    super('Invalid community API response.');
    this.name = 'CommunityApiContractError';
  }
}

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CommunityApiContractError();
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new CommunityApiContractError();
  return value.trim();
}

function readOptionalString(value: unknown) {
  if (value === null || value === undefined) return null;
  return readString(value);
}

function readId(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  return readString(value);
}

function readCount(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new CommunityApiContractError();
  }
  return value;
}

function readDate(value: unknown) {
  const date = readString(value);
  if (!Number.isFinite(Date.parse(date))) throw new CommunityApiContractError();
  return date;
}

function readEnvelope(value: unknown, expectedCode: string) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true || envelope.code !== expectedCode) {
    throw new CommunityApiContractError();
  }
  return envelope.result;
}

function readRemotePostType(value: unknown): RemotePostType {
  if (value === 'COMMUNICATION' || value === 'MARKET') return value;
  throw new CommunityApiContractError();
}

function readRemoteTradeType(value: unknown): RemoteTradeType | null {
  if (value === null || value === undefined) return null;
  if (value === 'EXCHANGE' || value === 'SELL' || value === 'SHARE' || value === 'WANT') return value;
  throw new CommunityApiContractError();
}

function readRemoteTradeMethod(value: unknown): RemoteTradeMethod | null {
  if (value === null || value === undefined) return null;
  if (value === 'CONTACTLESS_SHARE' || value === 'DELIVERY' || value === 'DIRECT') return value;
  throw new CommunityApiContractError();
}

function readRemoteMarketStatus(value: unknown): RemoteMarketStatus | null {
  if (value === null || value === undefined) return null;
  if (value === 'COMPLETED' || value === 'IN_PROGRESS' || value === 'RESERVED') return value;
  throw new CommunityApiContractError();
}

function readPhotos(value: unknown): CommunityImageAsset[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new CommunityApiContractError();

  return value.map((photo) => {
    const record = readRecord(photo);
    return {
      assetId: readId(record.photoId),
      url: readString(record.url),
    };
  });
}

function readRemotePost(value: unknown, detail: boolean): RemoteCommunityPost {
  const post = readRecord(value);
  const postType = readRemotePostType(post.postType);
  const rawContent = detail ? post.content : post.contentPreview;
  if (typeof rawContent !== 'string') throw new CommunityApiContractError();
  const rawHashTags = detail ? post.hashTags : [];
  if (!Array.isArray(rawHashTags) || !rawHashTags.every((tag) => typeof tag === 'string')) {
    throw new CommunityApiContractError();
  }
  const price = post.price;
  if (price !== null && price !== undefined && (typeof price !== 'number' || !Number.isSafeInteger(price) || price < 0)) {
    throw new CommunityApiContractError();
  }
  if (typeof post.priceNegotiable !== 'boolean') throw new CommunityApiContractError();
  if (detail && typeof post.likedByMe !== 'boolean') throw new CommunityApiContractError();

  return {
    authorNickname: readString(post.authorNickname),
    commentCount: readCount(post.commentCount),
    content: rawContent.trim(),
    createdAt: readDate(post.createdAt),
    expiryDate: readOptionalString(post.expiryDate),
    hashTags: rawHashTags.map((tag) => tag.trim()).filter(Boolean),
    likeCount: readCount(post.likeCount),
    likedByMe: detail ? post.likedByMe as boolean : null,
    marketStatus: readRemoteMarketStatus(post.marketStatus),
    photos: detail ? readPhotos(post.photos) : [],
    postId: readId(post.postId),
    postType,
    price: typeof price === 'number' ? price : null,
    priceNegotiable: post.priceNegotiable,
    regionName: readOptionalString(post.regionName),
    tagCode: readString(post.tagCode),
    tagName: readString(post.tagName),
    thumbnailUrl: readOptionalString(post.thumbnailUrl),
    title: readString(post.title),
    tradeMethod: readRemoteTradeMethod(post.tradeMethod),
    tradeType: readRemoteTradeType(post.tradeType),
    viewCount: readCount(post.viewCount),
  };
}

function readRemoteComment(value: unknown, identity: CommunityIdentity): CommunityComment {
  const comment = readRecord(value);
  const deleted = comment.deleted;
  if (typeof deleted !== 'boolean') throw new CommunityApiContractError();
  const createdAt = readDate(comment.createdAt);
  const id = readId(comment.commentId);
  const postId = readId(comment.postId);
  const parentId = comment.parentId === null || comment.parentId === undefined
    ? undefined
    : readId(comment.parentId);
  const authorNickname = readString(comment.authorNickname);
  const author = getAuthor(authorNickname, postId, identity);

  return deleted
    ? {
        author: { nickname: '', profileImageUri: null, userId: `deleted-${id}` },
        body: '삭제된 댓글입니다.',
        createdAt,
        deletedAt: createdAt,
        id,
        parentId,
        postId,
        updatedAt: createdAt,
      }
    : {
        author,
        body: readString(comment.content),
        createdAt,
        id,
        parentId,
        postId,
        updatedAt: createdAt,
      };
}

export type CommunityIdentity = {
  profile: Pick<UserProfile, 'introduction' | 'location' | 'nickname' | 'profileImageUri'> | null;
  userId: string;
};

function getAuthor(nickname: string, postId: string, identity: CommunityIdentity): CommunityAuthorSnapshot {
  if (identity.profile?.nickname === nickname) {
    return {
      introduction: identity.profile.introduction,
      location: identity.profile.location,
      nickname,
      profileImageUri: identity.profile.profileImageUri,
      userId: identity.userId,
    };
  }

  return {
    nickname,
    profileImageUri: null,
    userId: `community-author-${postId}`,
  };
}

const TALK_CATEGORY_BY_CODE: Record<string, Exclude<TalkCategory, '전체'>> = {
  BLOOD_NEWS: '헌혈소식',
  HEALTH_CONSULT: '건강상담',
  LOCAL_INFO: '동네정보',
  WALK_BUDDY: '산책친구',
};

const MARKET_CATEGORY_BY_CODE: Record<string, Exclude<MarketCategory, '전체'>> = {
  CONSUMABLES: '용품',
  FOOD_SNACK: '사료·간식',
  OTHER: '기타',
  SUPPLEMENT: '영양제',
  SUPPLIES: '용품',
};

const REMOTE_TRADE_TYPE: Record<MarketTradeType, RemoteTradeType> = {
  교환: 'EXCHANGE',
  구해요: 'WANT',
  나눔: 'SHARE',
  판매: 'SELL',
};

const LOCAL_TRADE_TYPE: Record<RemoteTradeType, MarketTradeType> = {
  EXCHANGE: '교환',
  SELL: '판매',
  SHARE: '나눔',
  WANT: '구해요',
};

const REMOTE_TRADE_METHOD: Record<MarketTradeMethod, RemoteTradeMethod> = {
  '비대면 나눔': 'CONTACTLESS_SHARE',
  '직거래': 'DIRECT',
  택배: 'DELIVERY',
};

const LOCAL_TRADE_METHOD: Record<RemoteTradeMethod, MarketTradeMethod> = {
  CONTACTLESS_SHARE: '비대면 나눔',
  DELIVERY: '택배',
  DIRECT: '직거래',
};

const LOCAL_MARKET_STATUS: Record<RemoteMarketStatus, MarketStatus> = {
  COMPLETED: '완료',
  IN_PROGRESS: '진행 중',
  RESERVED: '예약 중',
};

const REMOTE_MARKET_STATUS: Record<MarketStatus, RemoteMarketStatus> = {
  완료: 'COMPLETED',
  '예약 중': 'RESERVED',
  '진행 중': 'IN_PROGRESS',
};

function getPriceLabel(post: RemoteCommunityPost) {
  if (post.tradeType === 'SHARE') return '나눔';
  if (post.tradeType === 'EXCHANGE') return '교환';
  if (post.price === null) return '가격 협의';
  const price = `${post.price.toLocaleString('ko-KR')}원`;
  return post.tradeType === 'SELL' && post.priceNegotiable
    ? `${price} · 가격 제안 가능`
    : price;
}

function formatExpiryDate(value: string | null) {
  return value?.replace(/-/g, '.') ?? undefined;
}

function parseExpiryDate(value: string | undefined) {
  const normalized = value?.trim().replace(/\./g, '-');
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined;
}

function getCategoryCode(
  postType: RemotePostType,
  category: string,
  tags: readonly RemoteCommunityTag[],
  currentCode?: string,
) {
  if (currentCode) {
    const current = tags.find((tag) => tag.postType === postType && tag.code === currentCode);
    if (current && (current.name === category || (postType === 'MARKET' && category === '용품' && current.code === 'CONSUMABLES'))) {
      return current.code;
    }
  }

  const tag = tags.find((current) => current.postType === postType && current.name === category);
  if (tag) return tag.code;
  const fallback = postType === 'COMMUNICATION'
    ? Object.entries(TALK_CATEGORY_BY_CODE).find(([, name]) => name === category)?.[0]
    : Object.entries(MARKET_CATEGORY_BY_CODE).find(([, name]) => name === category)?.[0];
  if (!fallback) throw new CommunityApiContractError();
  return fallback;
}

function createPostFormData(data: Record<string, unknown>, images: readonly CommunityImageAsset[]) {
  const formData = new FormData();
  appendMultipartJson(formData, data);
  images.forEach((image) => {
    if (image.localUri) appendMultipartImage(formData, 'images', image.localUri);
  });
  return formData;
}

function getTradeMethod(post: MarketPost) {
  const method = getMarketTradeMethods(post.tags)[0];
  if (!method) throw new CommunityApiContractError();
  return REMOTE_TRADE_METHOD[method];
}

async function getMarketRegionCode() {
  return (await getRemoteUserLocation()).regionCode;
}

function createRemotePostData(
  post: TalkPost | MarketPost,
  tags: readonly RemoteCommunityTag[],
  isUpdate: boolean,
) {
  const images = post.images ?? [];
  const base = {
    content: post.body.trim(),
    hashTags: post.tags.filter(
      (tag) =>
        !Object.hasOwn(REMOTE_TRADE_METHOD, tag as MarketTradeMethod) &&
        (post.kind !== 'market' || (tag !== post.category && tag !== post.tradeType)),
    ),
    tagCode: getCategoryCode(
      post.kind === 'talk' ? 'COMMUNICATION' : 'MARKET',
      post.category,
      tags,
      post.categoryCode,
    ),
    title: post.title.trim(),
  };
  const existingUrls = images.flatMap((image) => image.url ? [image.url] : []);
  const newImageCount = images.filter((image) => image.localUri).length;
  const imageData = isUpdate
    ? {
        ...(existingUrls.length ? { keepPhotoUrls: existingUrls } : {}),
        ...(existingUrls[0] ? { thumbnailUrl: existingUrls[0] } : newImageCount ? { thumbnailIndex: 0 } : {}),
      }
    : newImageCount ? { thumbnailIndex: 0 } : {};

  if (post.kind === 'talk') {
    return {
      data: isUpdate ? { ...base, ...imageData } : { ...base, ...imageData, postType: 'COMMUNICATION' },
      images,
    };
  }

  const price = getPositiveMarketPrice(post.priceLabel);
  const marketData = {
    expiryDate: parseExpiryDate(post.expiresAt),
    price: price ?? null,
    priceNegotiable: post.priceLabel.includes('가격 제안 가능'),
    tradeMethod: getTradeMethod(post),
    tradeType: REMOTE_TRADE_TYPE[post.tradeType],
  };
  return {
    data: isUpdate
      ? { ...base, ...imageData, ...marketData, marketStatus: REMOTE_MARKET_STATUS[post.status], regionCode: '' }
      : { ...base, ...imageData, ...marketData, postType: 'MARKET', regionCode: '' },
    images,
  };
}

function withMarketRegion(data: Record<string, unknown>, regionCode: string) {
  return { ...data, regionCode };
}

export function mapRemotePost(remote: RemoteCommunityPost, identity: CommunityIdentity): CommunityPost {
  const author = getAuthor(remote.authorNickname, remote.postId, identity);
  const photoUris = remote.photos.map((photo) => photo.url).filter((url): url is string => Boolean(url));
  const base = {
    author,
    baseCommentCount: remote.commentCount,
    body: remote.content,
    categoryCode: remote.tagCode,
    createdAt: remote.createdAt,
    id: remote.postId,
    images: remote.photos,
    photoUris: photoUris.length > 0 ? photoUris : remote.thumbnailUrl ? [remote.thumbnailUrl] : [],
    tags: remote.hashTags,
    title: remote.title,
    updatedAt: remote.createdAt,
  };

  if (remote.postType === 'COMMUNICATION') {
    return {
      ...base,
      baseBookmarkCount: 0,
      baseReactionCounts: { like: remote.likeCount },
      category: TALK_CATEGORY_BY_CODE[remote.tagCode] ?? (remote.tagName as Exclude<TalkCategory, '전체'>),
      kind: 'talk',
      showNeighborhood: false,
    };
  }

  if (!remote.tradeType || !remote.marketStatus) throw new CommunityApiContractError();
  const method = remote.tradeMethod ? [LOCAL_TRADE_METHOD[remote.tradeMethod]] : [];
  return {
    ...base,
    baseBookmarkCount: 0,
    category: MARKET_CATEGORY_BY_CODE[remote.tagCode] ?? (remote.tagName as Exclude<MarketCategory, '전체'>),
    expiresAt: formatExpiryDate(remote.expiryDate),
    imageCount: remote.photos.length || (remote.thumbnailUrl ? 1 : 0),
    kind: 'market',
    location: remote.regionName ?? '',
    priceLabel: getPriceLabel(remote),
    status: LOCAL_MARKET_STATUS[remote.marketStatus],
    tags: [...remote.hashTags, ...method],
    tradeType: LOCAL_TRADE_TYPE[remote.tradeType],
  };
}

export function parseRemoteCommunityPage(value: unknown): RemoteCommunityPage {
  const result = readRecord(readEnvelope(value, 'COMMUNITY_LIST_200'));
  if (!Array.isArray(result.content) || typeof result.hasNext !== 'boolean') {
    throw new CommunityApiContractError();
  }
  const nextCursor = result.nextCursor;
  if (nextCursor !== null && nextCursor !== undefined && typeof nextCursor !== 'string') {
    throw new CommunityApiContractError();
  }
  return {
    hasNext: result.hasNext,
    items: result.content.map((item) => readRemotePost(item, false)),
    nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
  };
}

export function parseRemoteCommunityDetail(value: unknown) {
  return readRemotePost(readEnvelope(value, 'COMMUNITY_DETAIL_200'), true);
}

export function parseRemoteCommunityMutation(value: unknown, code: 'COMMUNITY_CREATE_200' | 'COMMUNITY_UPDATE_200') {
  return readRemotePost(readEnvelope(value, code), true);
}

export function parseRemoteCommunityTags(value: unknown): RemoteCommunityTag[] {
  const result = readEnvelope(value, 'COMMUNITY_TAG_LIST_200');
  if (!Array.isArray(result)) throw new CommunityApiContractError();
  return result.map((item) => {
    const tag = readRecord(item);
    const postType = readRemotePostType(tag.postType);
    const sortOrder = tag.sortOrder;
    if (typeof sortOrder !== 'number' || !Number.isSafeInteger(sortOrder) || sortOrder < 0) {
      throw new CommunityApiContractError();
    }
    return {
      code: readString(tag.tagCode),
      name: readString(tag.tagName),
      postType,
      sortOrder,
    };
  });
}

export function parseRemoteCommentPage(value: unknown, identity: CommunityIdentity): RemoteCommunityPage & { comments: CommunityComment[] } {
  const result = readRecord(readEnvelope(value, 'COMMENT_LIST_200'));
  if (!Array.isArray(result.content) || typeof result.hasNext !== 'boolean') {
    throw new CommunityApiContractError();
  }
  const nextCursor = result.nextCursor;
  if (nextCursor !== null && nextCursor !== undefined && typeof nextCursor !== 'string') {
    throw new CommunityApiContractError();
  }
  return {
    comments: result.content.map((item) => readRemoteComment(item, identity)),
    hasNext: result.hasNext,
    items: [],
    nextCursor: typeof nextCursor === 'string' ? nextCursor : null,
  };
}

export function parseRemoteCommentMutation(value: unknown, code: 'COMMENT_CREATE_200' | 'COMMENT_UPDATE_200', identity: CommunityIdentity) {
  return readRemoteComment(readEnvelope(value, code), identity);
}

export function parseRemoteLikeMutation(value: unknown) {
  const result = readRecord(readEnvelope(value, 'LIKE_TOGGLE_200'));
  if (typeof result.liked !== 'boolean') throw new CommunityApiContractError();
  return { liked: result.liked, likeCount: readCount(result.likeCount) };
}

export async function getRemoteCommunityPage(postType: RemotePostType, cursor?: string | null) {
  const params = new URLSearchParams({ postType, size: '50', sort: 'LATEST' });
  if (cursor) params.set('cursor', cursor);
  return parseRemoteCommunityPage(await apiRequest<unknown>(`/communities?${params.toString()}`));
}

export async function getRemoteCommunityDetail(postId: string) {
  return parseRemoteCommunityDetail(await apiRequest<unknown>(`/communities/${encodeURIComponent(postId)}`));
}

export async function getRemoteCommunityTags(postType: RemotePostType) {
  return parseRemoteCommunityTags(
    await apiRequest<unknown>(`/community-tags?postType=${postType}`),
  );
}

export async function getRemoteComments(postId: string, cursor?: string | null, identity?: CommunityIdentity) {
  if (!identity) throw new CommunityApiContractError();
  const params = new URLSearchParams({ size: '50' });
  if (cursor) params.set('cursor', cursor);
  return parseRemoteCommentPage(
    await apiRequest<unknown>(`/communities/${encodeURIComponent(postId)}/comments?${params.toString()}`),
    identity,
  );
}

export async function createRemoteCommunityPost(post: TalkPost | MarketPost, tags: readonly RemoteCommunityTag[]) {
  const request = createRemotePostData(post, tags, false);
  const data = post.kind === 'market'
    ? withMarketRegion(request.data, await getMarketRegionCode())
    : request.data;
  return parseRemoteCommunityMutation(
    await apiRequest<unknown>('/communities', { body: createPostFormData(data, request.images), method: 'POST' }),
    'COMMUNITY_CREATE_200',
  );
}

export async function updateRemoteCommunityPost(post: TalkPost | MarketPost, tags: readonly RemoteCommunityTag[]) {
  const request = createRemotePostData(post, tags, true);
  const data = post.kind === 'market'
    ? withMarketRegion(request.data, await getMarketRegionCode())
    : request.data;
  return parseRemoteCommunityMutation(
    await apiRequest<unknown>(`/communities/${encodeURIComponent(post.id)}`, { body: createPostFormData(data, request.images), method: 'PUT' }),
    'COMMUNITY_UPDATE_200',
  );
}

export async function deleteRemoteCommunityPost(postId: string) {
  await apiRequest<unknown>(`/communities/${encodeURIComponent(postId)}`, { method: 'DELETE' });
}

export async function createRemoteComment(postId: string, content: string, parentId?: string) {
  const normalizedParentId = parentId ? Number(parentId) : null;
  if (
    parentId &&
    (normalizedParentId === null ||
      !Number.isSafeInteger(normalizedParentId) ||
      normalizedParentId <= 0)
  ) {
    throw new CommunityApiContractError();
  }
  return apiRequest<unknown>(`/communities/${encodeURIComponent(postId)}/comments`, {
    json: { content: content.trim(), parentId: normalizedParentId },
    method: 'POST',
  });
}

export async function updateRemoteComment(commentId: string, content: string) {
  return apiRequest<unknown>(`/comments/${encodeURIComponent(commentId)}`, {
    json: { content: content.trim() },
    method: 'PUT',
  });
}

export async function deleteRemoteComment(commentId: string) {
  await apiRequest<unknown>(`/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
}

export async function toggleRemoteTalkLike(postId: string) {
  return parseRemoteLikeMutation(
    await apiRequest<unknown>(`/communities/${encodeURIComponent(postId)}/likes`, { method: 'PATCH' }),
  );
}
