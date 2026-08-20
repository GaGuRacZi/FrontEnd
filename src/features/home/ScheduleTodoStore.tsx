import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';

import type { RoutineType } from './utils/scheduleHelpers';

import {
  completeRemoteTodo,
  createRemoteTodo,
  createRemoteTodoTag,
  deleteRemoteTodo,
  deleteRemoteTodoTag,
  formatTodoApiDate,
  getRemoteTodoTag,
  getRemoteTodoDetail,
  getRemoteTodoCalendar,
  getRemoteTodoTags,
  getRemoteTodos,
  updateRemoteTodoTag,
  updateRemoteTodo,
  type RemoteTodo,
  type RemoteTodoDetail,
  type TodoCalendarDay,
  type TodoTagColor,
} from './services/todoApi';
import type { TodoCategory } from './types';

export type CustomTag = { colorIdx: number; id: string; name: string };

export type ScheduleTodo = {
  category: TodoCategory;
  date: string;
  day: number;
  description?: string;
  id: string;
  month: number;
  status: 'done' | 'pending';
  tag: string;
  tagId: string;
  timeLabel: string;
  title: string;
  year: number;
};

type ScheduleTodoInput = {
  description?: string;
  endDate: Date;
  routineDays: number[];
  routineType: RoutineType;
  startDate: Date;
  tag: string;
  timeLabel: string;
  title: string;
};

export type ScheduleTodoDetail = {
  description?: string;
  endDate?: string;
  routineEnabled: boolean;
  startDate?: string;
  tag: string;
  timeLabel: string;
  title: string;
  week?: number;
};

type TodoDayProgress = { completed: number; total: number };

type ScheduleTodoStoreContextValue = {
  createScheduleTodos: (input: ScheduleTodoInput) => Promise<'ok' | 'partial'>;
  createTag: (name: string, colorIdx: number) => Promise<CustomTag>;
  customTags: CustomTag[];
  deleteTag: (tagId: string) => Promise<void>;
  deleteScheduleTodo: (todoId: string, date: string) => Promise<void>;
  getTag: (tagId: string) => Promise<CustomTag>;
  getScheduleTodoDetail: (todoId: string) => Promise<ScheduleTodoDetail>;
  getDayProgress: (date: string) => TodoDayProgress | undefined;
  getTodosForDate: (date: string) => ScheduleTodo[];
  hasLoadError: boolean;
  isReady: boolean;
  loadCalendarMonth: (year: number, month: number) => Promise<void>;
  loadTodosForDate: (date: string) => Promise<void>;
  reloadSchedule: () => void;
  toggleTodo: (todoId: string, date: string) => Promise<void>;
  updateTag: (tagId: string, name: string, colorIdx: number) => Promise<CustomTag>;
  updateScheduleTodo: (todoId: string, input: ScheduleTodoInput) => Promise<void>;
};

const ScheduleTodoStoreContext = createContext<ScheduleTodoStoreContextValue | null>(null);

const TODO_TAG_COLORS: TodoTagColor[] = ['SKYBLUE', 'PURPLE', 'PINK', 'YELLOW', 'ORANGE', 'GREEN'];
const TAG_COLOR_INDEX: Record<TodoTagColor, number> = {
  GREEN: 5,
  ORANGE: 4,
  PINK: 2,
  PURPLE: 1,
  RED: 4,
  SKYBLUE: 0,
  YELLOW: 3,
};
const WEEK_CODES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

function mapRemoteTodo(todo: RemoteTodo): ScheduleTodo {
  const [year, month, day] = todo.date.split('-').map(Number);
  return {
    category: 'hospital',
    date: todo.date,
    day,
    description: todo.description,
    id: todo.id,
    month: month - 1,
    status: todo.completed ? 'done' : 'pending',
    tag: todo.tag.name,
    tagId: todo.tag.id,
    timeLabel: todo.timeLabel,
    title: todo.title,
    year,
  };
}

function mapRemoteTag(tag: { color: TodoTagColor; id: string; name: string }): CustomTag {
  return { colorIdx: TAG_COLOR_INDEX[tag.color], id: tag.id, name: tag.name };
}

function mapRemoteTodoDetail(todo: RemoteTodoDetail): ScheduleTodoDetail {
  return {
    description: todo.description,
    endDate: todo.endDate,
    routineEnabled: todo.routineEnabled,
    startDate: todo.startDate,
    tag: todo.tag.name,
    timeLabel: todo.timeLabel,
    title: todo.title,
    week: todo.week ? WEEK_CODES.indexOf(todo.week) : undefined,
  };
}

function mapCalendarDay(day: TodoCalendarDay): [string, TodoDayProgress] {
  return [day.date, { completed: day.completed, total: day.total }];
}

function updateCachedTodo(cache: Record<string, ScheduleTodo[]>, todo: ScheduleTodo) {
  const current = cache[todo.date] ?? [];
  return {
    ...cache,
    [todo.date]: current.map((item) => (item.id === todo.id ? todo : item)),
  };
}

export function ScheduleTodoProvider({ children }: PropsWithChildren) {
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [todosByDate, setTodosByDate] = useState<Record<string, ScheduleTodo[]>>({});
  const [dayProgress, setDayProgress] = useState<Record<string, TodoDayProgress>>({});
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadRequest, setLoadRequest] = useState(0);
  const activeUserRef = useRef(currentUserId);
  const todosByDateRef = useRef<Record<string, ScheduleTodo[]>>({});
  const customTagsRef = useRef<CustomTag[]>([]);
  activeUserRef.current = currentUserId;

  const applyTodos = useCallback((date: string, todos: ScheduleTodo[]) => {
    setTodosByDate((current) => {
      const next = { ...current, [date]: todos };
      todosByDateRef.current = next;
      return next;
    });
  }, []);

  const loadTodosForDate = useCallback(async (date: string) => {
    const userId = currentUserId;
    try {
      const todos = (await getRemoteTodos(date)).map(mapRemoteTodo);
      if (!userId || activeUserRef.current !== userId) return;
      applyTodos(date, todos);
    } catch (error) {
      setHasLoadError(true);
      throw error;
    }
  }, [applyTodos, currentUserId]);

  const loadCalendarMonth = useCallback(async (year: number, month: number) => {
    const userId = currentUserId;
    try {
      const days = await getRemoteTodoCalendar(year, month);
      if (!userId || activeUserRef.current !== userId) return;
      setDayProgress((current) => ({ ...current, ...Object.fromEntries(days.map(mapCalendarDay)) }));
    } catch (error) {
      setHasLoadError(true);
      throw error;
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!sessionReady) return;

    let active = true;
    setIsReady(false);
    setHasLoadError(false);
    setCustomTags([]);
    customTagsRef.current = [];
    setTodosByDate({});
    todosByDateRef.current = {};
    setDayProgress({});

    if (!currentUserId) {
      setIsReady(true);
      return () => {
        active = false;
      };
    }

    const today = new Date();
    const date = formatTodoApiDate(today);
    void Promise.allSettled([
      getRemoteTodoTags(),
      getRemoteTodos(date),
      getRemoteTodoCalendar(today.getFullYear(), today.getMonth() + 1),
    ])
      .then(([tags, todos, calendar]) => {
        if (!active) return;
        if (tags.status === 'fulfilled') {
          const nextTags = tags.value.map(mapRemoteTag);
          customTagsRef.current = nextTags;
          setCustomTags(nextTags);
        }
        if (todos.status === 'fulfilled') applyTodos(date, todos.value.map(mapRemoteTodo));
        if (calendar.status === 'fulfilled') {
          setDayProgress(Object.fromEntries(calendar.value.map(mapCalendarDay)));
        }
        setHasLoadError([tags, todos, calendar].some(({ status }) => status === 'rejected'));
      })
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [applyTodos, currentUserId, loadRequest, sessionReady]);

  const reloadSchedule = useCallback(() => {
    setLoadRequest((current) => current + 1);
  }, []);

  const createTag = useCallback(async (name: string, colorIdx: number) => {
    const userId = currentUserId;
    const color = TODO_TAG_COLORS[colorIdx] ?? TODO_TAG_COLORS[0];
    const tag = mapRemoteTag(await createRemoteTodoTag(name, color));
    if (!userId || activeUserRef.current !== userId) return tag;
    setCustomTags((current) => {
      const next = [...current, tag];
      customTagsRef.current = next;
      return next;
    });
    return tag;
  }, [currentUserId]);

  const deleteTag = useCallback(async (tagId: string) => {
    const userId = currentUserId;
    await deleteRemoteTodoTag(tagId);
    if (!userId || activeUserRef.current !== userId) return;
    setCustomTags((current) => {
      const next = current.filter((tag) => tag.id !== tagId);
      customTagsRef.current = next;
      return next;
    });
    setTodosByDate((current) => {
      const next = Object.fromEntries(
        Object.entries(current).map(([date, todos]) => [
          date,
          todos.filter((todo) => todo.tagId !== tagId),
        ]),
      );
      todosByDateRef.current = next;
      return next;
    });
  }, [currentUserId]);

  const getTag = useCallback(async (tagId: string) => (
    mapRemoteTag(await getRemoteTodoTag(tagId))
  ), []);

  const updateTag = useCallback(async (tagId: string, name: string, colorIdx: number) => {
    const userId = currentUserId;
    const color = TODO_TAG_COLORS[colorIdx] ?? TODO_TAG_COLORS[0];
    const tag = mapRemoteTag(await updateRemoteTodoTag(tagId, name, color));
    if (!userId || activeUserRef.current !== userId) return tag;
    setCustomTags((current) => {
      const next = current.map((item) => (item.id === tag.id ? tag : item));
      customTagsRef.current = next;
      return next;
    });
    setTodosByDate((current) => {
      const next = Object.fromEntries(
        Object.entries(current).map(([date, todos]) => [
          date,
          todos.map((todo) => todo.tagId === tag.id ? { ...todo, tag: tag.name } : todo),
        ]),
      );
      todosByDateRef.current = next;
      return next;
    });
    return tag;
  }, [currentUserId]);

  const createScheduleTodos = useCallback(async (input: ScheduleTodoInput) => {
    const tag = customTagsRef.current.find((item) => item.name === input.tag);
    if (!tag) throw new Error('todo-tag-required');
    const startDate = formatTodoApiDate(input.startDate);
    const endDate = formatTodoApiDate(input.endDate);
    const weeks = input.routineType === '매일'
      ? WEEK_CODES
      : input.routineDays.map((day) => WEEK_CODES[day]).filter((week): week is typeof WEEK_CODES[number] => Boolean(week));
    if (weeks.length === 0) throw new Error('todo-week-required');
    let created = 0;
    try {
      for (const week of weeks) {
        await createRemoteTodo({
          description: input.description,
          endDate,
          routineEnabled: true,
          startDate,
          tagId: tag.id,
          timeLabel: input.timeLabel,
          title: input.title,
          week,
        });
        created += 1;
      }
    } catch (error) {
      if (created > 0) return 'partial' as const;
      throw error;
    }
    return 'ok' as const;
  }, []);

  const toggleTodo = useCallback(async (todoId: string, date: string) => {
    const userId = currentUserId;
    const current = todosByDateRef.current[date]?.find((todo) => todo.id === todoId);
    if (!current) throw new Error('todo-not-found');
    const next = mapRemoteTodo(await completeRemoteTodo(todoId, date, current.status !== 'done'));
    if (!userId || activeUserRef.current !== userId) return;
    setTodosByDate((cache) => {
      const updated = updateCachedTodo(cache, next);
      todosByDateRef.current = updated;
      return updated;
    });
    setDayProgress((progress) => {
      const previous = progress[date];
      if (!previous) return progress;
      return {
        ...progress,
        [date]: {
          ...previous,
          completed: next.status === 'done' ? previous.completed + 1 : previous.completed - 1,
        },
      };
    });
  }, [currentUserId]);

  const getScheduleTodoDetail = useCallback(async (todoId: string) => (
    mapRemoteTodoDetail(await getRemoteTodoDetail(todoId))
  ), []);

  const updateScheduleTodo = useCallback(async (todoId: string, input: ScheduleTodoInput) => {
    const tag = customTagsRef.current.find((item) => item.name === input.tag);
    if (!tag) throw new Error('todo-tag-required');
    const week = input.routineType === '매일'
      ? WEEK_CODES[0]
      : input.routineDays.map((day) => WEEK_CODES[day]).find(Boolean);
    if (!week) throw new Error('todo-week-required');

    await updateRemoteTodo(todoId, {
      description: input.description,
      endDate: formatTodoApiDate(input.endDate),
      routineEnabled: true,
      startDate: formatTodoApiDate(input.startDate),
      tagId: tag.id,
      timeLabel: input.timeLabel,
      title: input.title,
      week,
    });
  }, []);

  const deleteScheduleTodo = useCallback(async (todoId: string, date: string) => {
    const userId = currentUserId;
    await deleteRemoteTodo(todoId, date);
    if (!userId || activeUserRef.current !== userId) return;
    const deleted = todosByDateRef.current[date]?.find((todo) => todo.id === todoId);
    setTodosByDate((cache) => {
      const next = {
        ...cache,
        [date]: (cache[date] ?? []).filter((todo) => todo.id !== todoId),
      };
      todosByDateRef.current = next;
      return next;
    });
    setDayProgress((progress) => {
      const previous = progress[date];
      if (!previous) return progress;
      return {
        ...progress,
        [date]: {
          completed: previous.completed - Number(deleted?.status === 'done'),
          total: previous.total - 1,
        },
      };
    });
  }, [currentUserId]);

  const getTodosForDate = useCallback((date: string) => todosByDate[date] ?? [], [todosByDate]);
  const getDayProgress = useCallback((date: string) => dayProgress[date], [dayProgress]);

  return (
    <ScheduleTodoStoreContext.Provider
      value={{
        createScheduleTodos,
        createTag,
        customTags,
        deleteTag,
        deleteScheduleTodo,
        getTag,
        getScheduleTodoDetail,
        getDayProgress,
        getTodosForDate,
        hasLoadError,
        isReady,
        loadCalendarMonth,
        loadTodosForDate,
        reloadSchedule,
        toggleTodo,
        updateTag,
        updateScheduleTodo,
      }}
    >
      {children}
    </ScheduleTodoStoreContext.Provider>
  );
}

export function useScheduleTodoStore(): ScheduleTodoStoreContextValue {
  const ctx = useContext(ScheduleTodoStoreContext);
  if (!ctx) throw new Error('useScheduleTodoStore must be used inside ScheduleTodoProvider');
  return ctx;
}
