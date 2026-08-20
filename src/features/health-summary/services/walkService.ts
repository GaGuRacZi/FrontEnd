import { apiRequest } from '@/src/services/apiClient';

// ─── 타입 ────────────────────────────────────────────────────────────────────

export type WeatherType = '맑음' | '흐림' | '비' | '눈' | '바람';
export type WalkType = '느긋' | '보통' | '활발';

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface WalkRecord {
  walkId: number | null;
  petId: number;
  walkDate: string;          // "2026-07-06"
  weatherType: WeatherType | null;
  temp: number | null;
  startTime: string;         // ISO 8601 datetime
  endTime: string | null;
  durationMinutes: number | null;
  walkingAmount: number;
  walkType: WalkType;
  isUrine: boolean;
  isStool: boolean;
  significant: string | null;
  walkStatus: 'IN_PROGRESS' | 'COMPLETED';
}

export interface WeeklySummary {
  weekStartDate: string;
  weekEndDate: string;
  averageMinutes: number;
  lastWeekAverageMinutes: number;
  diffMinutes: number;
  walkCount: number;
  totalMinutes: number;
  totalDistance: number;
}

export interface DailyStat {
  walkDate: string;
  dayOfWeek: string;
  totalMinutes: number;
  totalDistance: number;
  walkCount: number;
}

// ─── 응답 언래퍼 ──────────────────────────────────────────────────────────────

function extractResult<T>(response: unknown): T {
  if (
    response == null ||
    typeof response !== 'object' ||
    !('result' in (response as object))
  ) {
    throw new Error('Walk API 응답 형식이 올바르지 않아요.');
  }
  return (response as { result: T }).result;
}

// ─── API 함수 ─────────────────────────────────────────────────────────────────

/** 자동기록 시작 — petId만 필요 (startTime 생략 시 서버 현재 시각) */
export async function startWalk(petId: number) {
  const res = await apiRequest<unknown>('/api/walks/start', {
    method: 'POST',
    json: { petId },
  });
  return extractResult<{ petId: number; walkDate: string; startTime: string; walkStatus: string }>(res);
}

/** 자동기록 종료 — petId 필수, endTime 생략 시 서버 현재 시각 */
export async function finishWalk(body: {
  petId: number;
  weatherType: WeatherType;
  temp: number;
  walkingAmount: number;
  walkType: WalkType;
  isUrine?: boolean;
  isStool?: boolean;
  significant?: string;
}) {
  const res = await apiRequest<unknown>('/api/walks/finish', {
    method: 'PATCH',
    json: body,
  });
  return extractResult<WalkRecord>(res);
}

/** 진행 중 산책 조회 — WALK_404_3이면 null 반환 */
export async function getInProgressWalk(petId: number): Promise<WalkRecord | null> {
  try {
    const res = await apiRequest<unknown>(`/api/walks/in-progress?petId=${petId}`);
    return extractResult(res);
  } catch {
    return null;
  }
}

/** 수동 기록 저장 — walkDate는 startTime의 날짜와 동일하게 */
export async function createWalk(body: {
  petId: number;
  walkDate: string;          // "2026-08-21"
  weatherType: WeatherType;
  temp: number;
  startTime: string;         // "2026-08-21T18:00:00"
  endTime: string;           // "2026-08-21T18:45:00"
  walkingAmount: number;
  walkType: WalkType;
  isUrine?: boolean;
  isStool?: boolean;
  significant?: string;
}) {
  const res = await apiRequest<unknown>('/api/walks', {
    method: 'POST',
    json: body,
  });
  return extractResult<WalkRecord>(res);
}

/** 목록 조회 (완료 기록만) */
export async function getWalks(
  petId: number,
  options?: { date?: string; startDate?: string; endDate?: string },
) {
  const params = new URLSearchParams({ petId: String(petId) });
  if (options?.date) params.append('date', options.date);
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  const res = await apiRequest<unknown>(`/api/walks?${params.toString()}`);
  return extractResult<WalkRecord[]>(res);
}

/** 단건 조회 */
export async function getWalk(walkId: number) {
  const res = await apiRequest<unknown>(`/api/walks/${walkId}`);
  return extractResult<WalkRecord>(res);
}

/** 주간 요약 */
export async function getWeeklySummary(petId: number, baseDate?: string) {
  const params = new URLSearchParams({ petId: String(petId) });
  if (baseDate) params.append('baseDate', baseDate);
  const res = await apiRequest<unknown>(`/api/walks/statistics/weekly?${params.toString()}`);
  return extractResult<WeeklySummary>(res);
}

/** 일별 통계 */
export async function getDailyStats(
  petId: number,
  options?: { startDate?: string; endDate?: string },
) {
  const params = new URLSearchParams({ petId: String(petId) });
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  const res = await apiRequest<unknown>(`/api/walks/statistics/daily?${params.toString()}`);
  return extractResult<DailyStat[]>(res);
}

/** 수정 (보낸 필드만 반영) */
export async function updateWalk(
  walkId: number,
  body: Partial<{
    walkingAmount: number;
    weatherType: WeatherType;
    temp: number;
    walkType: WalkType;
    isUrine: boolean;
    isStool: boolean;
    significant: string;
  }>,
) {
  const res = await apiRequest<unknown>(`/api/walks/${walkId}`, {
    method: 'PATCH',
    json: body,
  });
  return extractResult<WalkRecord>(res);
}

/** 삭제 */
export async function deleteWalk(walkId: number) {
  await apiRequest<unknown>(`/api/walks/${walkId}`, { method: 'DELETE' });
}

// ─── Haversine 거리 계산 ──────────────────────────────────────────────────────

/** GPS 좌표 배열로 총 이동거리(km) 계산, 소수점 1자리 반올림 */
export function calcDistanceKm(points: RoutePoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversine(points[i], points[i + 1]);
  }
  return Math.min(99.9, Math.round(total * 10) / 10);
}

function haversine(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinDLng * sinDLng;
  return R * 2 * Math.asin(Math.sqrt(c));
}
