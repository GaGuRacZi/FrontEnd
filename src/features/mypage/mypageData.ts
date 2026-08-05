import type { PaymentMethod, PlanId } from './types';

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

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function getLocalCalendarDate(date = new Date()) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
}

export function getNextBillingDate(date = new Date()) {
  const targetYear = date.getMonth() === 11 ? date.getFullYear() + 1 : date.getFullYear();
  const targetMonth = (date.getMonth() + 1) % 12;
  const lastTargetDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDate = new Date(
    targetYear,
    targetMonth,
    Math.min(date.getDate(), lastTargetDay),
  );

  return getLocalCalendarDate(targetDate);
}

export function isValidClockTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isConnectedPaymentMethod(
  method: PaymentMethod | null | undefined,
) {
  return Boolean(
    method?.last4.trim() && method.last4.trim() !== '등록 대기',
  );
}

export function normalizePaymentMethods(methods: PaymentMethod[]) {
  const connectedMethods = methods
    .filter(isConnectedPaymentMethod)
    .filter(
      (method, index, values) =>
        values.findIndex((candidate) => candidate.id === method.id) === index,
    )
    .slice(0, 3);
  const defaultMethod =
    connectedMethods.find((method) => method.isDefault) ?? connectedMethods[0];

  return connectedMethods.map((method) => ({
    ...method,
    isDefault: method.id === defaultMethod?.id,
  }));
}

export function getCheckoutPaymentMethod(methods: PaymentMethod[]) {
  const connectedMethods = normalizePaymentMethods(methods);

  return (
    connectedMethods.find((method) => method.isDefault) ??
    connectedMethods[0] ??
    null
  );
}
