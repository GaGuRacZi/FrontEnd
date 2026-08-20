import { COLORS } from '@/src/constants';
import type { CustomTag } from '../ScheduleTodoStore';
import type { TodoCategory } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type StaticTagKey = '전체' | '복약' | '병원' | '산책';

// ─── Config ──────────────────────────────────────────────────────────────────

export const TAG_COLOR_PAIRS = [
  { bg: '#E8EEFF', color: '#6F8DDF' },
  { bg: '#F0E9FF', color: '#927DBB' },
  { bg: '#FCEAF3', color: '#BA779A' },
  { bg: '#FFF5D9', color: '#A67C3F' },
  { bg: '#FCEBE5', color: '#C67C69' },
  { bg: '#E5F5EE', color: '#52986E' },
];

export const STATIC_TAG_CONFIG: Record<Exclude<StaticTagKey, '전체'>, { bg: string; category: TodoCategory; color: string }> = {
  복약: { ...TAG_COLOR_PAIRS[0], category: 'medication' },
  병원: { ...TAG_COLOR_PAIRS[3], category: 'hospital' },
  산책: { ...TAG_COLOR_PAIRS[5], category: 'walk' },
};

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
  if (ct) return getTagColorPair(ct.colorIdx);
  return { bg: COLORS.gray200, color: COLORS.gray600 };
}

export function getTagColorPair(colorIdx: number) {
  return TAG_COLOR_PAIRS[colorIdx] ?? TAG_COLOR_PAIRS[0];
}

export function getTagCategory(tag: string): TodoCategory {
  return tag in STATIC_TAG_CONFIG
    ? STATIC_TAG_CONFIG[tag as Exclude<StaticTagKey, '전체'>].category
    : 'hospital';
}
