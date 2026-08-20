import { COLORS } from '@/src/constants';
import type { CustomTag } from '../ScheduleTodoStore';

export const TAG_COLOR_PAIRS = [
  { bg: '#E8EEFF', color: '#6F8DDF' },
  { bg: '#F0E9FF', color: '#927DBB' },
  { bg: '#FCEAF3', color: '#BA779A' },
  { bg: '#FFF5D9', color: '#A67C3F' },
  { bg: '#FCEBE5', color: '#C67C69' },
  { bg: '#E5F5EE', color: '#52986E' },
];

export const RECOMMENDED_TAGS = ['검진', '주사', '미용', '간식'];

export const DAYS_KO = ['월', '화', '수', '목', '금', '토', '일'];

export function getTagCfg(tag: string, customTags: CustomTag[]): { bg: string; color: string } {
  const ct = customTags.find((c) => c.name === tag);
  if (ct) return getTagColorPair(ct.colorIdx);
  return { bg: COLORS.gray200, color: COLORS.gray600 };
}

export function getTagColorPair(colorIdx: number) {
  return TAG_COLOR_PAIRS[colorIdx] ?? TAG_COLOR_PAIRS[0];
}
