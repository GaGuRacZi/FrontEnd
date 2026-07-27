import type { PlanId } from './types';

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
    name: '아기 젤리',
    priceLabel: '무료',
    recording: '진료 녹음 10분',
  },
  {
    aiSummary: '진료 AI 요약 10회',
    commonBenefit: '기본 건강 기록',
    icon: require('@/assets/images/plans/little-jelly.png'),
    id: 'little-jelly',
    monthlyPrice: 4900,
    name: '꼬마 젤리',
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

export function getPlan(planId: PlanId) {
  return (
    PLAN_DEFINITIONS.find((plan) => plan.id === planId) ?? PLAN_DEFINITIONS[0]
  );
}

export function getPlanRank(planId: PlanId) {
  return PLAN_DEFINITIONS.findIndex((plan) => plan.id === planId);
}

export function getPlanPrice(planId: PlanId) {
  return getPlan(planId).monthlyPrice;
}

export function getUpgradePaymentAmount(currentPlanId: PlanId, nextPlanId: PlanId) {
  return Math.max(getPlanPrice(nextPlanId) - getPlanPrice(currentPlanId), 0);
}
