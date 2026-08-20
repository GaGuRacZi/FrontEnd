import { apiRequest } from '@/src/services/apiClient';
import { appendMultipartImage, appendMultipartJson } from '@/src/utils/file';

// ─── 타입 ────────────────────────────────────────────────────────────────────

export type BodyType = 'SKINNY' | 'HEALTHY' | 'OVER_WEIGHT';
export type AppetiteType = 'LOW' | 'MIDDLE' | 'HIGH';
export type WeightPeriod = 'ONE_MONTH' | 'SIX_MONTHS';

export interface WeightPhoto {
  photoId: number;
  url: string;
  sortOrder: number;
}

export interface ApiWeightRecord {
  petWeightId: number;
  petId: number;
  weight: number;
  bodyType: BodyType;
  appetiteType: AppetiteType;
  memoContent: string | null;
  recordedAt: string; // "2026-07-06T20:30:00"
  photos: WeightPhoto[];
}

export interface WeightSummary {
  petId: number;
  currentWeight: number;
  lastRecordedAt: string | null;
  monthChange: number | null;
}

export interface WeightGraphPoint {
  date: string;
  weight: number;
}

export interface WeightGraph {
  period: WeightPeriod;
  startDate: string;
  endDate: string;
  minWeight: number | null;
  maxWeight: number | null;
  points: WeightGraphPoint[];
}

// ─── 응답 언래퍼 ─────────────────────────────────────────────────────────────

function extractResult<T>(response: unknown): T {
  if (
    response == null ||
    typeof response !== 'object' ||
    !('result' in (response as object))
  ) {
    throw new Error('Weight API 응답 형식이 올바르지 않아요.');
  }
  return (response as { result: T }).result;
}

// ─── API 함수 ─────────────────────────────────────────────────────────────────

/** 체중 요약 (상단 카드) */
export async function getWeightSummary(petId: number): Promise<WeightSummary> {
  const res = await apiRequest<unknown>(`/pets/${petId}/weights/summary`);
  return extractResult<WeightSummary>(res);
}

/** 체중 그래프 (날짜별) */
export async function getWeightGraph(
  petId: number,
  period: WeightPeriod = 'ONE_MONTH',
): Promise<WeightGraph> {
  const res = await apiRequest<unknown>(
    `/pets/${petId}/weights/graph?period=${period}`,
  );
  return extractResult<WeightGraph>(res);
}

/** 월별 체중 기록 목록 */
export async function getWeights(
  petId: number,
  options?: { year?: number; month?: number },
): Promise<ApiWeightRecord[]> {
  const params = new URLSearchParams();
  if (options?.year != null) params.append('year', String(options.year));
  if (options?.month != null) params.append('month', String(options.month));
  const query = params.toString();
  const res = await apiRequest<unknown>(
    `/pets/${petId}/weights${query ? `?${query}` : ''}`,
  );
  return extractResult<ApiWeightRecord[]>(res);
}

/** 체중 단건 조회 */
export async function getWeight(
  petId: number,
  petWeightId: number,
): Promise<ApiWeightRecord> {
  const res = await apiRequest<unknown>(`/pets/${petId}/weights/${petWeightId}`);
  return extractResult<ApiWeightRecord>(res);
}

/** 체중 기록 저장 (multipart/form-data) */
export async function createWeight(
  petId: number,
  data: {
    weight: number;
    bodyType: BodyType;
    appetiteType: AppetiteType;
    memoContent?: string;
    recordedAt: string; // "yyyy-MM-ddTHH:mm:ss"
  },
  imageUris: string[] = [],
): Promise<ApiWeightRecord> {
  const formData = new FormData();
  appendMultipartJson(formData, data);
  for (const uri of imageUris) {
    appendMultipartImage(formData, 'images', uri);
  }
  const res = await apiRequest<unknown>(`/pets/${petId}/weights`, {
    method: 'POST',
    body: formData,
  });
  return extractResult<ApiWeightRecord>(res);
}

/** 체중 기록 수정 (multipart/form-data) */
export async function updateWeight(
  petId: number,
  petWeightId: number,
  data: {
    weight?: number;
    bodyType?: BodyType;
    appetiteType?: AppetiteType;
    memoContent?: string;
    recordedAt?: string;
    keepPhotoUrls?: string[];
  },
  imageUris: string[] = [],
): Promise<ApiWeightRecord> {
  const formData = new FormData();
  if (Object.keys(data).length > 0) {
    appendMultipartJson(formData, data);
  }
  for (const uri of imageUris) {
    appendMultipartImage(formData, 'images', uri);
  }
  const res = await apiRequest<unknown>(
    `/pets/${petId}/weights/${petWeightId}`,
    { method: 'PUT', body: formData },
  );
  return extractResult<ApiWeightRecord>(res);
}

/** 체중 기록 삭제 */
export async function deleteWeight(
  petId: number,
  petWeightId: number,
): Promise<void> {
  await apiRequest<unknown>(`/pets/${petId}/weights/${petWeightId}`, {
    method: 'DELETE',
  });
}
