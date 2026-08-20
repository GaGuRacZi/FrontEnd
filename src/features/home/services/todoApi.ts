import { apiRequest } from '@/src/services/apiClient';

export type TodoTagColor =
  | 'GREEN'
  | 'ORANGE'
  | 'PINK'
  | 'PURPLE'
  | 'RED'
  | 'SKYBLUE'
  | 'YELLOW';

export type RemoteTodoTag = {
  color: TodoTagColor;
  id: string;
  name: string;
};

export type RemoteTodo = {
  completed: boolean;
  date: string;
  description?: string;
  id: string;
  tag: RemoteTodoTag;
  timeLabel: string;
  title: string;
};

export type RemoteTodoDetail = {
  description?: string;
  endDate?: string;
  id: string;
  routineEnabled: boolean;
  startDate?: string;
  tag: RemoteTodoTag;
  timeLabel: string;
  title: string;
  week?: RemoteTodoInput['week'];
};

export type TodoCalendarDay = {
  completed: number;
  date: string;
  total: number;
};

type RemoteTodoInput = {
  date?: string;
  description?: string;
  endDate?: string;
  routineEnabled: boolean;
  startDate?: string;
  tagId: string;
  timeLabel?: string;
  title: string;
  week?: 'FRI' | 'MON' | 'SAT' | 'SUN' | 'THU' | 'TUE' | 'WED';
};

export class TodoApiContractError extends Error {
  constructor() {
    super('Invalid todo API response.');
    this.name = 'TodoApiContractError';
  }
}

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TodoApiContractError();
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new TodoApiContractError();
  return value.trim();
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readId(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  throw new TodoApiContractError();
}

function readSuccessResult(value: unknown) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true || !('result' in envelope)) {
    throw new TodoApiContractError();
  }
  return envelope.result;
}

function readTag(value: unknown): RemoteTodoTag {
  const tag = readRecord(value);
  const color = tag.tagColorEnum;
  if (
    color !== 'SKYBLUE' &&
    color !== 'PINK' &&
    color !== 'RED' &&
    color !== 'YELLOW' &&
    color !== 'GREEN' &&
    color !== 'PURPLE' &&
    color !== 'ORANGE'
  ) {
    throw new TodoApiContractError();
  }

  return {
    color,
    id: readId(tag.tagId),
    name: readString(tag.tagName),
  };
}

function readTodo(value: unknown, date?: string): RemoteTodo {
  const todo = readRecord(value);
  return {
    completed: todo.completed === true,
    date: readOptionalString(todo.date) ?? date ?? readOptionalString(todo.startDate) ?? '',
    description: readOptionalString(todo.subTodo),
    id: readId(todo.todoId),
    tag: readTag(todo),
    timeLabel: readOptionalString(todo.todoTime) ?? '',
    title: readString(todo.todo),
  };
}

function readOptionalDate(value: unknown) {
  const date = readOptionalString(value);
  if (!date) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TodoApiContractError();
  return date;
}

function readTodoDetail(value: unknown): RemoteTodoDetail {
  const todo = readRecord(value);
  const week = todo.week;
  if (
    week !== undefined &&
    week !== 'MON' &&
    week !== 'TUE' &&
    week !== 'WED' &&
    week !== 'THU' &&
    week !== 'FRI' &&
    week !== 'SAT' &&
    week !== 'SUN'
  ) {
    throw new TodoApiContractError();
  }

  return {
    description: readOptionalString(todo.subTodo),
    endDate: readOptionalDate(todo.endDate),
    id: readId(todo.todoId),
    routineEnabled: todo.routineEnabled === true,
    startDate: readOptionalDate(todo.startDate),
    tag: readTag(todo),
    timeLabel: readOptionalString(todo.todoTime) ?? '',
    title: readString(todo.todo),
    week,
  };
}

function readCalendarDay(value: unknown): TodoCalendarDay {
  const day = readRecord(value);
  const total = day.totalCount;
  const completed = day.completedCount;
  if (
    typeof total !== 'number' ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    typeof completed !== 'number' ||
    !Number.isSafeInteger(completed) ||
    completed < 0 ||
    completed > total
  ) {
    throw new TodoApiContractError();
  }
  return { completed, date: readString(day.date), total };
}

function toRequestBody(input: RemoteTodoInput) {
  const tagId = Number(input.tagId);
  if (!Number.isSafeInteger(tagId) || tagId < 0 || !input.title.trim()) {
    throw new TodoApiContractError();
  }

  return {
    date: input.date,
    endDate: input.endDate,
    routineEnabled: input.routineEnabled,
    startDate: input.startDate,
    subTodo: input.description,
    tagId,
    todo: input.title.trim(),
    todoTime: input.timeLabel,
    week: input.week,
  };
}

export function formatTodoApiDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function getRemoteTodoTags() {
  const result = readSuccessResult(await apiRequest<unknown>('/api/tags'));
  if (!Array.isArray(result)) throw new TodoApiContractError();
  return result.map(readTag);
}

export async function createRemoteTodoTag(name: string, color: TodoTagColor) {
  return readTag(
    readSuccessResult(
      await apiRequest<unknown>('/api/tags', {
        json: { tagColorEnum: color, tagName: name.trim() },
        method: 'POST',
      }),
    ),
  );
}

export async function getRemoteTodoTag(tagId: string) {
  const id = Number(tagId);
  if (!Number.isSafeInteger(id) || id < 0) throw new TodoApiContractError();
  return readTag(readSuccessResult(await apiRequest<unknown>(`/api/tags/${id}`)));
}

export async function updateRemoteTodoTag(
  tagId: string,
  name: string,
  color: TodoTagColor,
) {
  const id = Number(tagId);
  if (!Number.isSafeInteger(id) || id < 0 || !name.trim()) {
    throw new TodoApiContractError();
  }
  return readTag(
    readSuccessResult(
      await apiRequest<unknown>(`/api/tags/${id}`, {
        json: { tagColorEnum: color, tagName: name.trim() },
        method: 'PATCH',
      }),
    ),
  );
}

export async function deleteRemoteTodoTag(tagId: string) {
  const id = Number(tagId);
  if (!Number.isSafeInteger(id) || id < 0) throw new TodoApiContractError();
  readSuccessResult(
    await apiRequest<unknown>(`/api/tags/${id}?force=true`, { method: 'DELETE' }),
  );
}

export async function getRemoteTodos(date: string) {
  const result = readSuccessResult(
    await apiRequest<unknown>(`/api/todos?${new URLSearchParams({ date }).toString()}`),
  );
  if (!Array.isArray(result)) throw new TodoApiContractError();
  return result.map((value) => readTodo(value, date));
}

export async function getRemoteTodoCalendar(year: number, month: number) {
  const query = new URLSearchParams({ month: String(month), year: String(year) });
  const result = readRecord(readSuccessResult(await apiRequest<unknown>(`/api/todos/calendar?${query.toString()}`)));
  if (!Array.isArray(result.days)) throw new TodoApiContractError();
  return result.days.map(readCalendarDay);
}

export async function createRemoteTodo(input: RemoteTodoInput) {
  return readTodo(readSuccessResult(await apiRequest<unknown>('/api/todos', {
    json: toRequestBody(input),
    method: 'POST',
  })), input.date ?? input.startDate);
}

export async function completeRemoteTodo(todoId: string, date: string, completed: boolean) {
  const id = Number(todoId);
  if (!Number.isSafeInteger(id) || id < 0) throw new TodoApiContractError();
  const query = new URLSearchParams({ completed: String(completed), date });
  return readTodo(
    readSuccessResult(
      await apiRequest<unknown>(`/api/todos/${id}/complete?${query.toString()}`, {
        method: 'PATCH',
      }),
    ),
    date,
  );
}

export async function getRemoteTodoDetail(todoId: string) {
  const id = Number(todoId);
  if (!Number.isSafeInteger(id) || id < 0) throw new TodoApiContractError();
  return readTodoDetail(
    readSuccessResult(await apiRequest<unknown>(`/api/todos/${id}`)),
  );
}

export async function updateRemoteTodo(todoId: string, input: RemoteTodoInput) {
  const id = Number(todoId);
  if (!Number.isSafeInteger(id) || id < 0) throw new TodoApiContractError();
  readSuccessResult(
    await apiRequest<unknown>(`/api/todos/${id}`, {
      json: toRequestBody(input),
      method: 'PUT',
    }),
  );
}

export async function deleteRemoteTodo(todoId: string, date: string) {
  const id = Number(todoId);
  if (!Number.isSafeInteger(id) || id < 0) throw new TodoApiContractError();
  const query = new URLSearchParams({ date, deleteAll: 'false' });
  readSuccessResult(
    await apiRequest<unknown>(`/api/todos/${id}?${query.toString()}`, { method: 'DELETE' }),
  );
}
