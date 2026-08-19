import type {
  MarketCategory,
  MarketStatus,
  MarketTradeMethod,
  MarketTradeType,
  TalkCategory,
} from './types';

export const COMMUNITY_TABS = [
  { id: 'talk', label: '소통' },
  { id: 'market', label: '장터' },
] as const;

export const TALK_CATEGORIES: TalkCategory[] = [
  '전체',
  '건강상담',
  '산책친구',
  '헌혈소식',
  '동네정보',
];

export const MARKET_CATEGORIES: MarketCategory[] = [
  '전체',
  '영양제',
  '사료·간식',
  '용품',
  '기타',
];

export const MARKET_TRADE_TYPES: MarketTradeType[] = ['나눔', '판매', '교환', '구해요'];

export const MARKET_TRADE_METHODS: MarketTradeMethod[] = ['직거래', '택배', '비대면 나눔'];

export const MARKET_STATUSES: MarketStatus[] = ['진행 중', '예약 중', '완료'];

export const COMMUNITY_AD_TEXT = '우리 아이와 함께한 오늘을 이웃과 나눠보세요.';

export const COMMUNITY_GUEST_ID = 'guest';
