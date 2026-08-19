export type PostKind = 'market' | 'talk';

export type ReactionKind = 'like';

export type TalkCategory = '건강상담' | '동네정보' | '산책친구' | '전체' | '헌혈소식';

export type MarketCategory = '기타' | '사료·간식' | '영양제' | '용품' | '전체';

export type MarketTradeType = '교환' | '구해요' | '나눔' | '판매';

export type MarketTradeMethod = '비대면 나눔' | '직거래' | '택배';

export type MarketStatus = '예약 중' | '완료' | '진행 중';

export type CommunityAuthorSnapshot = {
  introduction?: string;
  location?: string;
  nickname: string;
  petName?: string;
  profileImageUri?: string | null;
  userId: string;
};

export type CommunityImageAsset = {
  assetId: string;
  localUri?: string;
  url?: string;
};

type CommunityPostBase = {
  author: CommunityAuthorSnapshot;
  baseCommentCount?: number;
  body: string;
  categoryCode?: string;
  createdAt: string;
  id: string;
  images?: CommunityImageAsset[];
  kind: PostKind;
  photoUris?: string[];
  tags: string[];
  title: string;
  updatedAt: string;
};

export type TalkPost = CommunityPostBase & {
  baseBookmarkCount: number;
  baseReactionCounts: Partial<Record<ReactionKind, number>>;
  category: Exclude<TalkCategory, '전체'>;
  kind: 'talk';
  showNeighborhood: boolean;
};

export type MarketPost = CommunityPostBase & {
  baseBookmarkCount: number;
  baseReactionCounts?: Partial<Record<ReactionKind, number>>;
  category: Exclude<MarketCategory, '전체'>;
  expiresAt?: string;
  imageCount: number;
  kind: 'market';
  location: string;
  priceLabel: string;
  status: MarketStatus;
  tradeType: MarketTradeType;
};

export type CommunityPost = MarketPost | TalkPost;

export type CommunityComment = {
  author: CommunityAuthorSnapshot;
  body: string;
  createdAt: string;
  deletedAt?: string;
  id: string;
  parentId?: string;
  postId: string;
  updatedAt: string;
};

export type CommunityViewerState = {
  bookmarkedPostIds: string[];
  filterSession: {
    activeTab: PostKind;
    marketCategory: MarketCategory;
    marketStatuses: MarketStatus[];
    marketTradeTypes: MarketTradeType[];
    searchQuery: string;
    searchTab: PostKind;
    talkCategory: TalkCategory;
  };
  reactionPostIds: Partial<Record<ReactionKind, string[]>>;
};

type CommunityWriteDraftBase = {
  editPostId?: string;
  id: string;
  updatedAt: string;
  userId: string;
};

export type CommunityWriteDraft = CommunityWriteDraftBase & (
  | {
      tab: 'talk';
      talkBody: string;
      talkCategory: Exclude<TalkCategory, '전체'>;
      talkPhotos: CommunityImageAsset[];
      talkTags: string[];
      talkTitle: string;
    }
  | {
      expiresAt: string;
      marketBody: string;
      marketCategory: Exclude<MarketCategory, '전체'>;
      marketPhotos: CommunityImageAsset[];
      price: string;
      priceOffer: boolean;
      productName: string;
      tab: 'market';
      tradeLocation: string;
      tradeMethods: MarketTradeMethod[];
      tradeType: MarketTradeType;
    }
);

export type StoredCommunityState = {
  comments: CommunityComment[];
  posts: CommunityPost[];
  viewerStates: Record<string, CommunityViewerState>;
};
