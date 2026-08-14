export function normalizeChatSearch(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function formatChatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hour = date.getHours();
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatChatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function formatChatListTime(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDifference = Math.round((dayStart - targetStart) / 86_400_000);

  if (dayDifference === 0) return formatChatTime(value);
  if (dayDifference === 1) return '어제';
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
