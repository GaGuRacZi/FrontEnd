import type { ReviewPost } from '../types';
import { isPastOrTodayDateValue } from './date';

export const REVIEW_BODY_MIN_LENGTH = 10;
export const REVIEW_BODY_MAX_LENGTH = 700;
export const REVIEW_TARGET_MAX_LENGTH = 50;
export const REVIEW_TITLE_MAX_LENGTH = 40;

export function isValidReviewScore(value: number) {
  return Number.isFinite(value) && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
}

function isValidReviewDetailScores(scores?: ReviewPost['detailScores']) {
  if (!scores) return true;
  return [scores.kindness, scores.price, scores.revisit].every(isValidReviewScore);
}

export function getValidReviewInput(
  post: Pick<ReviewPost, 'body' | 'detailScores' | 'rating' | 'title' | 'visitedAt'>,
) {
  const title = post.title.trim();
  const body = post.body.trim();
  const visitedAt = post.visitedAt?.trim();

  if (!title || !body || !visitedAt) return null;
  if (
    title.length > REVIEW_TITLE_MAX_LENGTH ||
    body.length < REVIEW_BODY_MIN_LENGTH ||
    body.length > REVIEW_BODY_MAX_LENGTH ||
    !isPastOrTodayDateValue(visitedAt) ||
    !isValidReviewScore(post.rating) ||
    !isValidReviewDetailScores(post.detailScores)
  ) {
    return null;
  }

  return { body, title, visitedAt };
}

export function getValidReviewTarget(value?: string) {
  const target = value?.trim();
  if (!target || target.length > REVIEW_TARGET_MAX_LENGTH) return null;
  return target;
}
