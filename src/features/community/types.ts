export type PostKind = 'market' | 'review' | 'talk';

export type ReactionKind = 'helpful' | 'like' | 'notHelpful';

export type TalkCategory = '건강상담' | '동네정보' | '산책친구' | '전체' | '헌혈소식';

export type MarketCategory = '기타' | '사료·간식' | '영양제' | '용품' | '전체';

export type ReviewCategory = '미용실' | '병원' | '산책 장소' | '용품샵' | '전체';

export type MarketTradeType = '교환' | '구해요' | '나눔' | '판매';

export type MarketStatus = '예약 중' | '완료' | '진행 중';

export type CommunityAuthorSnapshot = {
  introduction?: string;
  location?: string;
  nickname: string;
  petName?: string;
  profileImageUri?: string | null;
  userId: string;
};

type CommunityPostBase = {
  author: CommunityAuthorSnapshot;
  body: string;
  createdAt: string;
  id: string;
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
  baseReactionCounts: Partial<Record<ReactionKind, number>>;
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

export type ReviewPost = {
  author: CommunityAuthorSnapshot;
  baseReactionCounts?: Partial<Record<ReactionKind, number>>;
  body: string;
  category: Exclude<ReviewCategory, '전체'>;
  createdAt: string;
  detailScores?: {
    kindness: number;
    price: number;
    revisit: number;
  };
  id: string;
  photoUris?: string[];
  placeholderPhotoCount?: number;
  rating: number;
  targetName?: string;
  title: string;
  visitedAt?: string;
};

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
    marketCategory: MarketCategory;
    marketStatuses: MarketStatus[];
    marketTradeTypes: MarketTradeType[];
    talkCategory: TalkCategory;
  };
  reactionPostIds: Partial<Record<ReactionKind, string[]>>;
};

export type StoredCommunityState = {
  comments: CommunityComment[];
  posts: CommunityPost[];
  reviewPosts: ReviewPost[];
  viewerStates: Record<string, CommunityViewerState>;
};
