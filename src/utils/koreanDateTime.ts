const KOREA_TIME_ZONE = 'Asia/Seoul';
const TIME_ZONELESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

const koreanDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: KOREA_TIME_ZONE,
  year: 'numeric',
});

const koreanClockFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  timeZone: KOREA_TIME_ZONE,
});

const koreanDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  timeZone: KOREA_TIME_ZONE,
  year: 'numeric',
});

export function parseKoreanServerDate(value: string) {
  const normalized = value.trim();
  const date = new Date(
    TIME_ZONELESS_DATE_TIME.test(normalized) ? `${normalized}+09:00` : normalized,
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatKoreanServerDateTime(value: Date) {
  const parts = koreanDateTimeFormatter.formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read('minute')}:${read('second')}`;
}

export function compareKoreanServerDates(left: string, right: string) {
  return (parseKoreanServerDate(left)?.getTime() ?? 0) -
    (parseKoreanServerDate(right)?.getTime() ?? 0);
}

function getKoreanDateParts(value: Date) {
  const parts = koreanDateFormatter.formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return { day: read('day'), month: read('month'), year: read('year') };
}

function getKoreanTimeParts(value: Date) {
  const parts = koreanClockFormatter.formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return { hour: read('hour'), minute: read('minute') };
}

export function formatKoreanChatTime(value: string) {
  const date = parseKoreanServerDate(value);
  if (!date) return '';

  const { hour, minute } = getKoreanTimeParts(date);
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${String(minute).padStart(2, '0')}`;
}

export function formatKoreanChatDate(value: string) {
  const date = parseKoreanServerDate(value);
  if (!date) return '';

  const { day, month, year } = getKoreanDateParts(date);
  return `${year}년 ${month}월 ${day}일`;
}

export function isSameKoreanCalendarDate(first: string, second?: string) {
  if (!second) return false;

  const firstDate = parseKoreanServerDate(first);
  const secondDate = parseKoreanServerDate(second);
  if (!firstDate || !secondDate) return false;

  const left = getKoreanDateParts(firstDate);
  const right = getKoreanDateParts(secondDate);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

export function formatKoreanChatListTime(value: string, now = new Date()) {
  const date = parseKoreanServerDate(value);
  if (!date) return '';

  const target = getKoreanDateParts(date);
  const current = getKoreanDateParts(now);
  const dayDifference = Math.round(
    (Date.UTC(current.year, current.month - 1, current.day) -
      Date.UTC(target.year, target.month - 1, target.day)) /
      86_400_000,
  );

  if (dayDifference === 0) return formatKoreanChatTime(value);
  if (dayDifference === 1) return '어제';
  if (target.year === current.year) {
    return `${target.month}.${String(target.day).padStart(2, '0')}`;
  }
  return `${target.year}.${String(target.month).padStart(2, '0')}.${String(target.day).padStart(2, '0')}`;
}

export function formatKoreanRelativeTime(value: string, now = Date.now()) {
  const createdAt = parseKoreanServerDate(value)?.getTime();
  if (!createdAt) return '';

  const minutes = Math.max(0, Math.floor((now - createdAt) / 60_000));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}
