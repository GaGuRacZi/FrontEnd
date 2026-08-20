import { COLORS } from '@/src/constants';
import type { CustomTag } from '../ScheduleTodoStore';
import type { TodoCategory } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type StaticTagKey = '전체' | '복약' | '병원' | '산책';

// ─── Config ──────────────────────────────────────────────────────────────────

export const STATIC_TAG_CONFIG: Record<Exclude<StaticTagKey, '전체'>, { bg: string; color: string }> = {
  복약: { bg: COLORS.primarySoft, color: COLORS.primary },
  병원: { bg: COLORS.yellow, color: COLORS.yellowDark },
  산책: { bg: COLORS.greenSoft, color: COLORS.green },
};

export const TAG_COLOR_PAIRS: Array<{ bg: string; color: string }> = [
  { bg: COLORS.primarySoft, color: COLORS.primary },
  { bg: 'rgba(200,159,255,0.18)', color: '#9B6FD4' },
  { bg: COLORS.pink, color: '#CC5499' },
  { bg: COLORS.yellow, color: COLORS.yellowDark },
  { bg: 'rgba(255,179,160,0.28)', color: '#C24A20' },
  { bg: COLORS.greenSoft, color: COLORS.green },
];
export const TAG_COLORS = TAG_COLOR_PAIRS.map((p) => p.color);

export const PROTECTED_TAGS = ['복약', '병원', '산책'];
export const STATIC_MODAL_TAGS: Exclude<StaticTagKey, '전체'>[] = ['복약', '병원', '산책'];
export const RECOMMENDED_TAGS = ['검진', '주사', '미용', '간식'];

export type CategoryMeta = { icon: number; iconSize: number; tint: string };
export const CATEGORY_META: Record<TodoCategory, CategoryMeta> = {
  medication: { icon: require('@/assets/images/home/pill.png'), iconSize: 20, tint: COLORS.primarySoft },
  hospital: { icon: require('@/assets/images/home/diagnosis.png'), iconSize: 24, tint: COLORS.yellow },
  walk: { icon: require('@/assets/images/home/walk.png'), iconSize: 18, tint: COLORS.greenSoft },
};

export const DAYS_KO = ['월', '화', '수', '목', '금', '토', '일'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getTagCfg(tag: string, customTags: CustomTag[]): { bg: string; color: string } {
  if (tag in STATIC_TAG_CONFIG) return STATIC_TAG_CONFIG[tag as Exclude<StaticTagKey, '전체'>];
  const ct = customTags.find((c) => c.name === tag);
  if (ct) return TAG_COLOR_PAIRS[ct.colorIdx];
  return { bg: COLORS.gray200, color: COLORS.gray600 };
}
