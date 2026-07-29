export function parseDateValue(value: string) {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function compareDateWithToday(value: string) {
  const date = parseDateValue(value);
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() - today.getTime();
}

export function isFutureDateValue(value: string) {
  const comparison = compareDateWithToday(value);
  return comparison !== null && comparison > 0;
}

export function isPastOrTodayDateValue(value: string) {
  const comparison = compareDateWithToday(value);
  return comparison !== null && comparison <= 0;
}
