import { apiRequest } from '@/src/services/apiClient';

// ─── 타입 ────────────────────────────────────────────────────────────────────

export type PaymentType =
  | 'CARD'
  | 'TRANSFER'
  | 'VIRTUAL_ACCOUNT'
  | 'MOBILE'
  | 'EASY_PAY';

export interface ExpenseDetail {
  expenseDetailId: number;
  expenseDetailName: string;
  expenseAmount: number;
}

export interface ApiExpense {
  expenseId: number;
  petId: number;
  expenseAmount: number;
  expenseDate: string;        // "yyyy-MM-dd"
  paymentType: PaymentType;
  paymentTypeLabel: string;
  expenseName: string;
  expenseDetails: ExpenseDetail[];
}

export interface ExpenseSummary {
  year: number;
  month: number;
  monthlyTotalAmount: number;
  totalAmount: number;
}

export interface ExpenseListItem {
  expenseId: number;
  expenseName: string;
  expenseDate: string;        // "yyyy-MM-dd"
  expenseAmount: number;
}

export interface ExpenseList {
  year: number;
  month: number;
  monthlyTotalAmount: number;
  expenses: ExpenseListItem[];
}

// ─── 응답 언래퍼 ─────────────────────────────────────────────────────────────

function extractResult<T>(response: unknown): T {
  if (
    response == null ||
    typeof response !== 'object' ||
    !('result' in (response as object))
  ) {
    throw new Error('MedicalCost API 응답 형식이 올바르지 않아요.');
  }
  return (response as { result: T }).result;
}

// ─── API 함수 ─────────────────────────────────────────────────────────────────

/** 의료비 요약 (상단 카드) */
export async function getExpenseSummary(
  petId: number,
  options?: { year?: number; month?: number },
): Promise<ExpenseSummary> {
  const params = new URLSearchParams();
  if (options?.year != null) params.append('year', String(options.year));
  if (options?.month != null) params.append('month', String(options.month));
  const query = params.toString();
  const res = await apiRequest<unknown>(
    `/api/v1/pets/${petId}/expenses/summary${query ? `?${query}` : ''}`,
  );
  return extractResult<ExpenseSummary>(res);
}

/** 월별 의료비 내역 목록 */
export async function getExpenses(
  petId: number,
  options?: { year?: number; month?: number },
): Promise<ExpenseList> {
  const params = new URLSearchParams();
  if (options?.year != null) params.append('year', String(options.year));
  if (options?.month != null) params.append('month', String(options.month));
  const query = params.toString();
  const res = await apiRequest<unknown>(
    `/api/v1/pets/${petId}/expenses${query ? `?${query}` : ''}`,
  );
  return extractResult<ExpenseList>(res);
}

/** 의료비 상세 조회 */
export async function getExpense(expenseId: number): Promise<ApiExpense> {
  const res = await apiRequest<unknown>(`/api/v1/expenses/${expenseId}`);
  return extractResult<ApiExpense>(res);
}

/** 의료비 기록하기 */
export async function createExpense(
  petId: number,
  data: {
    expenseAmount: number;
    expenseDate: string;       // "yyyy-MM-dd"
    paymentType: PaymentType;
    expenseName: string;
    expenseDetails: { expenseDetailName: string; expenseAmount: number }[];
  },
): Promise<ApiExpense> {
  const res = await apiRequest<unknown>(`/api/v1/pets/${petId}/expenses`, {
    method: 'POST',
    json: data,
  });
  return extractResult<ApiExpense>(res);
}

/** 의료비 기록 수정 (보낸 필드만 반영) */
export async function updateExpense(
  expenseId: number,
  data: {
    expenseAmount?: number;
    expenseDate?: string;
    paymentType?: PaymentType;
    expenseName?: string;
    expenseDetails?: { expenseDetailName: string; expenseAmount: number }[];
  },
): Promise<ApiExpense> {
  const res = await apiRequest<unknown>(`/api/v1/expenses/${expenseId}`, {
    method: 'PUT',
    json: data,
  });
  return extractResult<ApiExpense>(res);
}

/** 의료비 기록 삭제 */
export async function deleteExpense(expenseId: number): Promise<void> {
  await apiRequest<unknown>(`/api/v1/expenses/${expenseId}`, {
    method: 'DELETE',
  });
}
