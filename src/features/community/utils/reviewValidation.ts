import type { ReviewCategory, ReviewPost } from '../types';
import { isPastOrTodayDateValue } from './date';

const REVIEW_BODY_MIN_LENGTH = 10;
export const REVIEW_BODY_MAX_LENGTH = 700;
export const REVIEW_TARGET_MAX_LENGTH = 50;
export const REVIEW_TITLE_MAX_LENGTH = 40;

export function isValidReviewScore(value: number) {
  return Number.isFinite(value) && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
}

function normalizeReviewInlineText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeReviewBody(value: string) {
  return value.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}

export function getReviewScoreLabels(category: Exclude<ReviewCategory, '전체'>) {
  if (category === '산책 장소') return ['안전성', '청결도', '재방문 의사'] as const;
  if (category === '병원') return ['친절도', '설명 만족도', '재방문 의사'] as const;
  if (category === '용품샵') return ['가격 만족도', '상품 다양성', '재이용 의사'] as const;
  return ['친절도', '결과 만족도', '재이용 의사'] as const;
}

function isValidReviewDetailScores(scores: ReviewPost['detailScores'] | undefined) {
  return Boolean(
    scores && [scores.kindness, scores.price, scores.revisit].every(isValidReviewScore),
  );
}

export function getReviewInputValidationMessage(
  post: Pick<ReviewPost, 'body' | 'detailScores' | 'rating' | 'title' | 'visitedAt'>,
) {
  const title = normalizeReviewInlineText(post.title);
  const body = normalizeReviewBody(post.body);
  const visitedAt = post.visitedAt?.trim();

  if (!title) return '제목을 입력해주세요.';
  if (title.length > REVIEW_TITLE_MAX_LENGTH) {
    return `제목은 ${REVIEW_TITLE_MAX_LENGTH}자 이하로 입력해주세요.`;
  }
  if (!visitedAt) return '이용 날짜를 입력해주세요.';
  if (!isPastOrTodayDateValue(visitedAt)) {
    return '이용 날짜는 오늘 또는 이전 날짜로 입력해주세요.';
  }
  if (!body) return '후기 내용을 입력해주세요.';
  if (body.length < REVIEW_BODY_MIN_LENGTH) {
    return `후기 내용은 ${REVIEW_BODY_MIN_LENGTH}자 이상 입력해주세요.`;
  }
  if (body.length > REVIEW_BODY_MAX_LENGTH) {
    return `후기 내용은 ${REVIEW_BODY_MAX_LENGTH}자 이하로 입력해주세요.`;
  }
  if (!isValidReviewScore(post.rating) || !isValidReviewDetailScores(post.detailScores)) {
    return '평점을 다시 선택해주세요.';
  }
  return null;
}

export function getReviewTargetValidationMessage(value?: string) {
  const target = normalizeReviewInlineText(value ?? '');
  if (!target) return '리뷰 대상을 입력해주세요.';
  if (target.length > REVIEW_TARGET_MAX_LENGTH) {
    return `리뷰 대상은 ${REVIEW_TARGET_MAX_LENGTH}자 이하로 입력해주세요.`;
  }
  return null;
}

export function getValidReviewInput(
  post: Pick<ReviewPost, 'body' | 'detailScores' | 'rating' | 'title' | 'visitedAt'>,
) {
  const title = normalizeReviewInlineText(post.title);
  const body = normalizeReviewBody(post.body);
  const visitedAt = post.visitedAt?.trim();

  if (getReviewInputValidationMessage(post) || !visitedAt) return null;

  return { body, title, visitedAt };
}

export function getValidReviewTarget(value?: string) {
  const target = normalizeReviewInlineText(value ?? '');
  if (getReviewTargetValidationMessage(target)) return null;
  return target;
}
