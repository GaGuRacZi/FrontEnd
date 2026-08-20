import type { PlanCatalogItem, PlanId } from './types';

export type PlanDefinition = {
  aiSummary: string;
  commonBenefit: string;
  icon: number;
  id: PlanId;
  monthlyPrice: number;
  name: string;
  priceLabel: string;
  recording: string;
};

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    aiSummary: '진료 AI 요약 3회',
    commonBenefit: '기본 건강 기록',
    icon: require('@/assets/images/plans/baby-jelly.png'),
    id: 'baby-jelly',
    monthlyPrice: 0,
    name: '꼬마 젤리',
    priceLabel: '무료',
    recording: '진료 녹음 10분',
  },
  {
    aiSummary: '진료 AI 요약 10회',
    commonBenefit: '기본 건강 기록',
    icon: require('@/assets/images/plans/little-jelly.png'),
    id: 'little-jelly',
    monthlyPrice: 4900,
    name: '새싹 젤리',
    priceLabel: '월 4,900원',
    recording: '진료 녹음 60분',
  },
  {
    aiSummary: '진료 AI 요약 무제한',
    commonBenefit: '기본 건강 기록',
    icon: require('@/assets/images/plans/adult-jelly.png'),
    id: 'adult-jelly',
    monthlyPrice: 9900,
    name: '어른 젤리',
    priceLabel: '월 9,900원',
    recording: '진료 녹음 120분',
  },
];

export function getPlan(planId: PlanId, catalog: readonly PlanCatalogItem[] = []) {
  const definition = (
    PLAN_DEFINITIONS.find((plan) => plan.id === planId) ?? PLAN_DEFINITIONS[0]
  );
  const remote = catalog.find((plan) => plan.id === planId);
  if (!remote) return definition;
  return {
    ...definition,
    monthlyPrice: remote.monthlyPrice,
    name: remote.name,
    priceLabel: remote.monthlyPrice === 0
      ? '무료'
      : `월 ${remote.monthlyPrice.toLocaleString('ko-KR')}원`,
  };
}

export function getPlanRank(planId: PlanId) {
  return PLAN_DEFINITIONS.findIndex((plan) => plan.id === planId);
}

export function isValidClockTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
