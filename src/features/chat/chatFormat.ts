import {
  compareKoreanServerDates,
  formatKoreanChatDate,
  formatKoreanChatListTime,
  formatKoreanChatTime,
} from '@/src/utils/koreanDateTime';

export function normalizeChatSearch(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isChatTimeNewer(candidate: string, baseline: string) {
  return compareChatTimes(candidate, baseline) > 0;
}

export function compareChatTimes(left: string, right: string) {
  return compareKoreanServerDates(left, right);
}

export function formatChatTime(value: string) {
  return formatKoreanChatTime(value);
}

export function formatChatDate(value: string) {
  return formatKoreanChatDate(value);
}

export function formatChatListTime(value: string, now = new Date()) {
  return formatKoreanChatListTime(value, now);
}
