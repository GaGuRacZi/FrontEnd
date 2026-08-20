import type { MedicalExpenseRecord, WalkRecord, WeightRecord } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateParts(value: string) {
  const [year, month, day] = value.split('.').map(Number);
  return { day, month, year };
}

function parseKoreanTime(value?: string) {
  const match = value?.match(/(오전|오후)\s+(\d+):(\d+)/);
  if (!match) return { hour: 0, minute: 0 };

  let hour = Number(match[2]);
  const minute = Number(match[3]);
  if (match[1] === '오후' && hour !== 12) hour += 12;
  if (match[1] === '오전' && hour === 12) hour = 0;
  return { hour, minute };
}

export function getHealthRecordTime(date: string, time?: string, recordedAt?: string) {
  if (recordedAt) {
    const timestamp = Date.parse(recordedAt);
    if (!Number.isNaN(timestamp)) return timestamp;
  }
  const { day, month, year } = parseDateParts(date);
  const { hour, minute } = parseKoreanTime(time);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

export function getSortedWeightRecords(records: WeightRecord[]) {
  return [...records].sort(
    (first, second) => getHealthRecordTime(first.date, first.time, first.recordedAt) - getHealthRecordTime(second.date, second.time, second.recordedAt),
  );
}

export function getWeightOverview(records: WeightRecord[]) {
  const sorted = getSortedWeightRecords(records);
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.at(-2) ?? null;

  return {
    currentWeight: latest?.weight ?? null,
    difference: latest && previous ? Math.round((latest.weight - previous.weight) * 10) / 10 : null,
    latest,
  };
}

function getWeekStart(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result.getTime();
}

function getWalkAverage(records: WalkRecord[]) {
  if (records.length === 0) return null;
  return Math.round(records.reduce((total, record) => total + record.durationMinutes, 0) / records.length);
}

export function getWalkOverview(records: WalkRecord[], now = new Date()) {
  const thisWeekStart = getWeekStart(now);
  const previousWeekStart = thisWeekStart - 7 * MS_PER_DAY;
  const nextWeekStart = thisWeekStart + 7 * MS_PER_DAY;
  const thisWeek = records.filter((record) => {
    const time = getHealthRecordTime(record.date);
    return time >= thisWeekStart && time < nextWeekStart;
  });
  const previousWeek = records.filter((record) => {
    const time = getHealthRecordTime(record.date);
    return time >= previousWeekStart && time < thisWeekStart;
  });
  const average = getWalkAverage(thisWeek);
  const previousAverage = getWalkAverage(previousWeek);

  return {
    average,
    difference: average !== null && previousAverage !== null ? average - previousAverage : null,
    records: thisWeek,
  };
}

function isSameMonth(date: string, year: number, month: number) {
  const parts = parseDateParts(date);
  return parts.year === year && parts.month === month;
}

export function getMedicalExpenseOverview(records: MedicalExpenseRecord[], now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const previous = month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
  const currentTotal = records
    .filter((record) => isSameMonth(record.date, year, month))
    .reduce((total, record) => total + record.totalCost, 0);
  const previousTotal = records
    .filter((record) => isSameMonth(record.date, previous.year, previous.month))
    .reduce((total, record) => total + record.totalCost, 0);

  return {
    currentTotal,
    difference: previousTotal - currentTotal,
    previousTotal,
    total: records.reduce((sum, record) => sum + record.totalCost, 0),
  };
}

export function getRecordsForMonth<T extends { date: string; recordedAt?: string; time?: string }>(records: T[], year: number, month: number) {
	return records
		.filter((record) => isSameMonth(record.date, year, month))
		.sort((first, second) => getHealthRecordTime(second.date, second.time, second.recordedAt) - getHealthRecordTime(first.date, first.time, first.recordedAt));
}
