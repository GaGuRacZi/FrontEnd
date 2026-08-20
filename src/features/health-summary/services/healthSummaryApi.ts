import { apiRequest } from '@/src/services/apiClient';
import { appendMultipartImage, appendMultipartJson } from '@/src/utils/file';

import type { MedicalExpenseRecord, WalkRecord, WeightRecord } from '../types';

type JsonRecord = Record<string, unknown>;

export type WeightSummary = {
  currentWeight: number | null;
  monthChange: number | null;
};

export type WeightGraphPoint = {
  date: string;
  weight: number;
};

export type WalkWeeklySummary = {
  averageMinutes: number | null;
  diffMinutes: number | null;
};

export type WalkDailySummary = {
  date: string;
  totalMinutes: number;
};

export type ExpenseSummary = {
  monthlyTotalAmount: number;
  totalAmount: number;
};

export type ActiveWalk = {
  date: string;
  startedAt: string;
  startTime: string;
};

function readRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-health-response');
  return value as JsonRecord;
}

function readEnvelope(value: unknown) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true) throw new Error('health-request-failed');
  return envelope.result;
}

function readString(value: unknown) {
  if (typeof value !== 'string') throw new Error('invalid-health-response');
  return value;
}

function readNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('invalid-health-response');
  return value;
}

function readId(value: unknown) {
  const id = readNumber(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('invalid-health-response');
  return String(id);
}

function toLocalDate(value: string): Date {
  // 타임존 정보 없으면 UTC로 강제 파싱 → 로컬(KST) 변환
  const utcStr = /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : value + 'Z';
  return new Date(utcStr);
}

function formatDate(value: string) {
  const dt = toLocalDate(value);
  if (Number.isNaN(dt.getTime())) throw new Error('invalid-health-response');
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

function formatTime(value: string) {
  const dt = toLocalDate(value);
  if (Number.isNaN(dt.getTime())) throw new Error('invalid-health-response');
  const hour = dt.getHours();
  const minute = String(dt.getMinutes()).padStart(2, '0');
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}:${minute}`;
}

function toServerDate(value: string) {
  const normalized = value.replace(/\./g, '-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error('invalid-health-date');
  return normalized;
}

function toServerDateTime(date: string, time: string) {
  const koreanMatch = /^(오전|오후)\s+(\d{1,2}):(\d{2})$/.exec(time);
  const time24Match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!koreanMatch && !time24Match) throw new Error('invalid-health-time');
  let hour = Number(koreanMatch?.[2] ?? time24Match?.[1]);
  const minute = Number(koreanMatch?.[3] ?? time24Match?.[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('invalid-health-time');
  }
  if (koreanMatch?.[1] === '오후' && hour !== 12) hour += 12;
  if (koreanMatch?.[1] === '오전' && hour === 12) hour = 0;
  return `${toServerDate(date)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function numericId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('invalid-health-id');
  return id;
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  return search.toString();
}

function firstPhoto(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const photos = value
    .map((photo) => readRecord(photo))
    .map((photo) => ({ sortOrder: readNumber(photo.sortOrder), url: readString(photo.url) }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
  return photos[0]?.url;
}

function fulfilledValues<T>(results: PromiseSettledResult<T>[]) {
  const values = results.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (results.length > 0 && values.length === 0 && failure) throw failure.reason;
  return values;
}

export function parseWeightRecord(value: unknown): WeightRecord {
  const record = readRecord(value);
  const bodyType = readString(record.bodyType);
  const appetiteType = readString(record.appetiteType);
  const recordedAt = readString(record.recordedAt);
  const bodyCondition = bodyType === 'SKINNY' ? 'lean' : bodyType === 'HEALTHY' ? 'ideal' : bodyType === 'OVER_WEIGHT' ? 'overweight' : null;
  const appetite = appetiteType === 'LOW' ? 'low' : appetiteType === 'MIDDLE' ? 'normal' : appetiteType === 'HIGH' ? 'high' : null;
  if (!bodyCondition || !appetite) throw new Error('invalid-health-response');
  return {
    appetite,
    bodyCondition,
    date: formatDate(recordedAt),
    id: readId(record.petWeightId),
    isDirectInput: true,
    memo: typeof record.memoContent === 'string' && record.memoContent.trim() ? record.memoContent : undefined,
    petId: readId(record.petId),
    photoUri: firstPhoto(record.photos),
    recordedAt,
    time: formatTime(recordedAt),
    weight: readNumber(record.weight),
  };
}

function mapWalk(value: unknown): WalkRecord {
  const record = readRecord(value);
  const walkDate = readString(record.walkDate);
  const startTime = readString(record.startTime);
  const endTime = readString(record.endTime);
  const walkType = readString(record.walkType);
  const intensity = walkType === '느긋' ? 'relaxed' : walkType === '보통' ? 'moderate' : walkType === '활발' ? 'active' : null;
  const weather = typeof record.weatherType === 'string' ? record.weatherType : undefined;
  if (!intensity) throw new Error('invalid-health-response');
  return {
    date: formatDate(walkDate),
    dayLabel: '산책 기록',
    distanceKm: readNumber(record.walkingAmount),
    durationMinutes: readNumber(record.durationMinutes),
    endTime: formatTime24(endTime),
    excrement: {
      defecation: record.isStool === true,
      specialNote: typeof record.significant === 'string' && record.significant.trim().length > 0,
      urination: record.isUrine === true,
    },
    id: readId(record.walkId),
    intensity,
    petId: readId(record.petId),
    significant: typeof record.significant === 'string' && record.significant.trim() ? record.significant : undefined,
    startTime: formatTime24(startTime),
    temperatureText: typeof record.temp === 'number' ? `${record.temp}°C` : undefined,
    weatherText: weather === '구름' ? '흐림' : weather,
  };
}

function formatTime24(value: string) {
  const match = /T(\d{2}:\d{2})/.exec(value);
  if (!match) throw new Error('invalid-health-response');
  return match[1];
}

function mapExpense(value: unknown): MedicalExpenseRecord {
  const record = readRecord(value);
  const details = record.expenseDetails;
  if (!Array.isArray(details)) throw new Error('invalid-health-response');
  return {
    date: formatDate(readString(record.expenseDate)),
    hospitalName: readString(record.expenseName),
    id: readId(record.expenseId),
    items: details.map((detail) => {
      const item = readRecord(detail);
      return {
        cost: readNumber(item.expenseAmount),
        id: readId(item.expenseDetailId),
        name: readString(item.expenseDetailName),
      };
    }),
    paymentMethod: typeof record.paymentTypeLabel === 'string' ? record.paymentTypeLabel : paymentLabel(readString(record.paymentType)),
    petId: readId(record.petId),
    totalCost: readNumber(record.expenseAmount),
  };
}

function paymentLabel(value: string) {
  return ({ CARD: '카드결제', EASY_PAY: '간편결제', MOBILE: '모바일결제', TRANSFER: '계좌이체', VIRTUAL_ACCOUNT: '가상계좌' } as Record<string, string>)[value] ?? value;
}

function paymentType(value: string) {
  const type = ({ '가상계좌': 'VIRTUAL_ACCOUNT', '간편결제': 'EASY_PAY', '계좌이체': 'TRANSFER', '카드결제': 'CARD', '모바일결제': 'MOBILE' } as Record<string, string>)[value];
  if (!type) throw new Error('invalid-payment-method');
  return type;
}

function weightData(record: WeightRecord, includePhotoUrls: boolean) {
  return {
    appetiteType: ({ high: 'HIGH', low: 'LOW', normal: 'MIDDLE' } as const)[record.appetite],
    bodyType: ({ ideal: 'HEALTHY', lean: 'SKINNY', overweight: 'OVER_WEIGHT' } as const)[record.bodyCondition],
    ...(includePhotoUrls ? { keepPhotoUrls: record.photoUri?.startsWith('http') ? [record.photoUri] : [] } : {}),
    memoContent: record.memo ?? '',
    recordedAt: toServerDateTime(record.date, record.time),
    weight: record.weight,
  };
}

function weightFormData(record: WeightRecord, includePhotoUrls: boolean) {
  const data = new FormData();
  appendMultipartJson(data, weightData(record, includePhotoUrls));
  if (record.photoUri && !record.photoUri.startsWith('http')) appendMultipartImage(data, 'images', record.photoUri);
  return data;
}

function walkPayload(record: WalkRecord) {
  const weatherType = record.weatherText === '구름' ? '흐림' : record.weatherText;
  const temp = Number(record.temperatureText?.replace(/[^0-9.-]/g, ''));
  if (!weatherType || !Number.isInteger(temp)) throw new Error('invalid-walk-weather');
  const walkType = ({ active: '활발', moderate: '보통', relaxed: '느긋' } as const)[record.intensity];
  const base = {
    endTime: toServerDateTime(record.date, record.endTime),
    isStool: record.excrement.defecation,
    isUrine: record.excrement.urination,
    ...(record.excrement.specialNote
      ? { significant: record.significant ?? '특이사항 있음' }
      : {}),
    startTime: toServerDateTime(record.date, record.startTime),
    temp,
    walkingAmount: record.distanceKm,
    walkDate: toServerDate(record.date),
    walkType,
    weatherType,
  };
  return base;
}

function expensePayload(record: MedicalExpenseRecord) {
  if (!record.items.length) throw new Error('medical-expense-items-required');
  return {
    expenseAmount: record.totalCost,
    expenseDate: toServerDate(record.date),
    expenseDetails: record.items.map((item) => ({ expenseAmount: item.cost, expenseDetailName: item.name })),
    expenseName: record.hospitalName,
    paymentType: paymentType(record.paymentMethod),
  };
}

export async function getWeightRecords(petId: string, year: number, month: number) {
  const response = await apiRequest<unknown>(`/pets/${numericId(petId)}/weights?${query({ month, year })}`);
  const result = readEnvelope(response);
  if (!Array.isArray(result)) throw new Error('invalid-health-response');
  return result.map(parseWeightRecord);
}

export async function saveWeightRecord(record: WeightRecord) {
  const petId = numericId(record.petId);
  const existing = /^\d+$/.test(record.id);
  const response = await apiRequest<unknown>(
    existing ? `/pets/${petId}/weights/${numericId(record.id)}` : `/pets/${petId}/weights`,
    { body: weightFormData(record, existing), method: existing ? 'PUT' : 'POST' },
  );
  return parseWeightRecord(readEnvelope(response));
}

export async function deleteWeightRecord(record: WeightRecord) {
  const response = await apiRequest<unknown>(`/pets/${numericId(record.petId)}/weights/${numericId(record.id)}`, { method: 'DELETE' });
  readEnvelope(response);
}

export async function getWeightSummary(petId: string): Promise<WeightSummary> {
  const response = await apiRequest<unknown>(`/pets/${numericId(petId)}/weights/summary`);
  const result = readRecord(readEnvelope(response));
  return {
    currentWeight: result.currentWeight === null ? null : readNumber(result.currentWeight),
    monthChange: result.monthChange === null ? null : readNumber(result.monthChange),
  };
}

export async function getWeightGraph(petId: string, period: 'ONE_MONTH' | 'SIX_MONTHS') {
  const response = await apiRequest<unknown>(`/pets/${numericId(petId)}/weights/graph?${query({ period })}`);
  const result = readRecord(readEnvelope(response));
  if (!Array.isArray(result.points)) throw new Error('invalid-health-response');
  return result.points.map((point) => {
    const item = readRecord(point);
    return { date: formatDate(readString(item.date)), weight: readNumber(item.weight) };
  });
}

export async function getWalkRecords(petId: string, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const response = await apiRequest<unknown>(`/api/walks?${query({ endDate, petId: numericId(petId), startDate })}`);
  const result = readEnvelope(response);
  if (!Array.isArray(result)) throw new Error('invalid-health-response');
  const ids = result.map((item) => readId(readRecord(item).walkId));
  const records = await Promise.allSettled(ids.map(getWalkRecord));
  return fulfilledValues(records);
}

export async function getWalkRecord(id: string) {
  const response = await apiRequest<unknown>(`/api/walks/${numericId(id)}`);
  return mapWalk(readEnvelope(response));
}

export async function saveWalkRecord(record: WalkRecord, automatic = false) {
  const payload = walkPayload(record);
  const finishPayload = {
    isStool: payload.isStool,
    isUrine: payload.isUrine,
    ...(payload.significant ? { significant: payload.significant } : {}),
    temp: payload.temp,
    walkingAmount: payload.walkingAmount,
    walkType: payload.walkType,
    weatherType: payload.weatherType,
  };
  const response = automatic
    ? await apiRequest<unknown>('/api/walks/finish', { json: { ...finishPayload, petId: numericId(record.petId) }, method: 'PATCH' })
    : /^\d+$/.test(record.id)
      ? await apiRequest<unknown>(`/api/walks/${numericId(record.id)}`, { json: payload, method: 'PATCH' })
      : await apiRequest<unknown>('/api/walks', { json: { ...payload, petId: numericId(record.petId) }, method: 'POST' });
  return mapWalk(readEnvelope(response));
}

export async function deleteWalkRecord(id: string) {
  const response = await apiRequest<unknown>(`/api/walks/${numericId(id)}`, { method: 'DELETE' });
  readEnvelope(response);
}

export async function getWalkWeeklySummary(petId: string): Promise<WalkWeeklySummary> {
  const response = await apiRequest<unknown>(`/api/walks/statistics/weekly?${query({ petId: numericId(petId) })}`);
  const result = readRecord(readEnvelope(response));
  return {
    averageMinutes: result.averageMinutes === null ? null : readNumber(result.averageMinutes),
    diffMinutes: result.diffMinutes === null ? null : readNumber(result.diffMinutes),
  };
}

export async function getWalkDailySummary(petId: string) {
  const response = await apiRequest<unknown>(`/api/walks/statistics/daily?${query({ petId: numericId(petId) })}`);
  const result = readEnvelope(response);
  if (!Array.isArray(result)) throw new Error('invalid-health-response');
  return result.map((item) => {
    const walk = readRecord(item);
    return {
      date: formatDate(readString(walk.walkDate)),
      totalMinutes: readNumber(walk.totalMinutes),
    };
  }) as WalkDailySummary[];
}

export async function getActiveWalk(petId: string): Promise<ActiveWalk | null> {
  try {
    const response = await apiRequest<unknown>(`/api/walks/in-progress?${query({ petId: numericId(petId) })}`);
    const payload = readEnvelope(response);
    if (payload === null) return null;
    const result = readRecord(payload);
    const startTime = result.startTime;
    if (typeof startTime !== 'string') return null;
    return { date: formatDate(readString(result.walkDate)), startedAt: startTime, startTime: formatTime24(startTime) };
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 404) return null;
    throw error;
  }
}

export async function startWalk(petId: string): Promise<ActiveWalk> {
  const response = await apiRequest<unknown>('/api/walks/start', { json: { petId: numericId(petId) }, method: 'POST' });
  const result = readRecord(readEnvelope(response));
  const startedAt = readString(result.startTime);
  return { date: formatDate(readString(result.walkDate)), startedAt, startTime: formatTime24(startedAt) };
}

export async function getMedicalExpenseRecords(petId: string, year: number, month: number) {
  const response = await apiRequest<unknown>(`/api/v1/pets/${numericId(petId)}/expenses?${query({ month, year })}`);
  const result = readRecord(readEnvelope(response));
  if (!Array.isArray(result.expenses)) throw new Error('invalid-health-response');
  const ids = result.expenses.map((item) => readId(readRecord(item).expenseId));
  const records = await Promise.allSettled(ids.map(getMedicalExpenseRecord));
  return fulfilledValues(records);
}

export async function getMedicalExpenseRecord(id: string) {
  const response = await apiRequest<unknown>(`/api/v1/expenses/${numericId(id)}`);
  return mapExpense(readEnvelope(response));
}

export async function saveMedicalExpenseRecord(record: MedicalExpenseRecord) {
  const payload = expensePayload(record);
  const response = /^\d+$/.test(record.id)
    ? await apiRequest<unknown>(`/api/v1/expenses/${numericId(record.id)}`, { json: payload, method: 'PUT' })
    : await apiRequest<unknown>(`/api/v1/pets/${numericId(record.petId)}/expenses`, { json: payload, method: 'POST' });
  return mapExpense(readEnvelope(response));
}

export async function deleteMedicalExpenseRecord(id: string) {
  const response = await apiRequest<unknown>(`/api/v1/expenses/${numericId(id)}`, { method: 'DELETE' });
  readEnvelope(response);
}

export async function getExpenseSummary(petId: string, year: number, month: number): Promise<ExpenseSummary> {
  const response = await apiRequest<unknown>(`/api/v1/pets/${numericId(petId)}/expenses/summary?${query({ month, year })}`);
  const result = readRecord(readEnvelope(response));
  return { monthlyTotalAmount: readNumber(result.monthlyTotalAmount), totalAmount: readNumber(result.totalAmount) };
}
