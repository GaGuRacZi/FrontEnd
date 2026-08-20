import { apiRequest, ApiError } from '@/src/services/apiClient';

export { ApiError };

// ─── Response wrapper ────────────────────────────────────────────────────────

type ApiResponse<T> = {
	code: string;
	isSuccess: boolean;
	message: string;
	result: T;
};

// ─── Backend types ───────────────────────────────────────────────────────────

export type Prescription = {
	caution: string | null;
	dosageAmount: number;
	dosageUnit: string;
	frequency: string;
	ingredient: string | null;
	mealTiming: string;
	nameKo: string;
	prescriptionId: number;
	takeTimes: string[] | null;
};

export type VisitDetail = {
	aiSummaryMd: string | null;
	aiSummaryStatus: 'DONE' | 'GENERATING' | 'NONE';
	careNotes: string | null;
	findings: string | null;
	prescriptions: Prescription[];
	status: string;
	visitId: number;
	visitName: string | null;
	visitedAt: string; // ISO 8601
};

export type AiSummaryResult = {
	aiSummaryMd: string;
	coin: number;
	usedCoin: number;
	visitId: number;
};

// ─── API functions ───────────────────────────────────────────────────────────

export async function getVisitDetail(visitId: string): Promise<VisitDetail> {
	const res = await apiRequest<ApiResponse<VisitDetail>>(`/visits/${visitId}`);
	return res.result;
}

export async function generateAiSummary(visitId: string): Promise<AiSummaryResult> {
	const res = await apiRequest<ApiResponse<AiSummaryResult>>(`/visits/${visitId}/summary`, {
		method: 'POST',
	});
	return res.result;
}
