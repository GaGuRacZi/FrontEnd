import { MARKET_TRADE_METHODS } from '../communityData';
import type { MarketTradeMethod, MarketTradeType } from '../types';

const PRICE_LABEL_PATTERN = /^[\d,]+\s*원$/;
const PRICE_OFFER_LABEL_PATTERN = /^[\d,]+\s*원\s*·\s*가격 제안 가능$/;

export function getPositiveMarketPrice(value: string) {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return null;

  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function createMarketPriceLabel(
  tradeType: MarketTradeType,
  value: string,
  priceOffer: boolean,
) {
  if (tradeType === '나눔') return '나눔';
  if (tradeType === '교환') return '교환';

  const amount = getPositiveMarketPrice(value);
  if (!amount) return tradeType === '구해요' ? '가격 협의' : null;

  const price = `${amount.toLocaleString('ko-KR')}원`;
  return tradeType === '판매' && priceOffer ? `${price} · 가격 제안 가능` : price;
}

export function isValidMarketPriceLabel(tradeType: MarketTradeType, value: string) {
  const label = value.trim();
  if (tradeType === '나눔') return label === '나눔';
  if (tradeType === '교환') return label === '교환' || label === '교환 가능';
  if (tradeType === '구해요' && label === '가격 협의') return true;
  if (!getPositiveMarketPrice(label)) return false;

  return tradeType === '판매'
    ? PRICE_LABEL_PATTERN.test(label) || PRICE_OFFER_LABEL_PATTERN.test(label)
    : PRICE_LABEL_PATTERN.test(label);
}

export function getMarketTradeMethods(values: readonly string[]) {
  return [...new Set(values.filter((value): value is MarketTradeMethod =>
    MARKET_TRADE_METHODS.includes(value as MarketTradeMethod),
  ))];
}

export function isValidMarketTradeMethodSelection(
  tradeType: MarketTradeType,
  methods: readonly MarketTradeMethod[],
) {
  return methods.length > 0 &&
    (tradeType === '나눔' || !methods.includes('비대면 나눔'));
}
