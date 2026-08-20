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
  getRemoteTodoDetail,
  getRemoteTodoCalendar,
  getRemoteTodoTags,
  getRemoteTodos,
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
  createScheduleTodos: (input: ScheduleTodoInput) => Promise<'ok'>;
  createTag: (name: string, colorIdx: number) => Promise<CustomTag>;
  customTags: CustomTag[];
  deleteTag: (tagId: string) => Promise<void>;
  deleteScheduleTodo: (todoId: string, date: string) => Promise<void>;
  getScheduleTodoDetail: (todoId: string) => Promise<ScheduleTodoDetail>;
  getDayProgress: (date: string) => TodoDayProgress | undefined;
  getTodosForDate: (date: string) => ScheduleTodo[];
  hasLoadError: boolean;
  isReady: boolean;
  loadCalendarMonth: (year: number, month: number) => Promise<void>;
  loadTodosForDate: (date: string) => Promise<void>;
  toggleTodo: (todoId: string, date: string) => Promise<void>;
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
  const todosByDateRef = useRef<Record<string, ScheduleTodo[]>>({});
  const customTagsRef = useRef<CustomTag[]>([]);

  const applyTodos = useCallback((date: string, todos: ScheduleTodo[]) => {
    setTodosByDate((current) => {
      const next = { ...current, [date]: todos };
      todosByDateRef.current = next;
      return next;
    });
  }, []);

  const loadTodosForDate = useCallback(async (date: string) => {
    const todos = (await getRemoteTodos(date)).map(mapRemoteTodo);
    applyTodos(date, todos);
  }, [applyTodos]);

  const loadCalendarMonth = useCallback(async (year: number, month: number) => {
    const days = await getRemoteTodoCalendar(year, month);
    setDayProgress((current) => ({ ...current, ...Object.fromEntries(days.map(mapCalendarDay)) }));
  }, []);

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
    void Promise.all([
      getRemoteTodoTags(),
      getRemoteTodos(date),
      getRemoteTodoCalendar(today.getFullYear(), today.getMonth() + 1),
    ])
      .then(([tags, todos, calendar]) => {
        if (!active) return;
        const nextTags = tags.map(mapRemoteTag);
        customTagsRef.current = nextTags;
        setCustomTags(nextTags);
        applyTodos(date, todos.map(mapRemoteTodo));
        setDayProgress(Object.fromEntries(calendar.map(mapCalendarDay)));
      })
      .catch(() => {
        if (active) setHasLoadError(true);
      })
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [applyTodos, currentUserId, sessionReady]);

  const createTag = useCallback(async (name: string, colorIdx: number) => {
    const color = TODO_TAG_COLORS[colorIdx] ?? TODO_TAG_COLORS[0];
    const tag = mapRemoteTag(await createRemoteTodoTag(name, color));
    setCustomTags((current) => {
      const next = [...current, tag];
      customTagsRef.current = next;
      return next;
    });
    return tag;
  }, []);

  const deleteTag = useCallback(async (tagId: string) => {
    await deleteRemoteTodoTag(tagId);
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
  }, []);

  const createScheduleTodos = useCallback(async (input: ScheduleTodoInput) => {
    const tag = customTagsRef.current.find((item) => item.name === input.tag);
    if (!tag) throw new Error('todo-tag-required');
    const startDate = formatTodoApiDate(input.startDate);
    const endDate = formatTodoApiDate(input.endDate);
    const weeks = input.routineType === '매일'
      ? WEEK_CODES
      : input.routineDays.map((day) => WEEK_CODES[day]).filter((week): week is typeof WEEK_CODES[number] => Boolean(week));
    if (weeks.length === 0) throw new Error('todo-week-required');
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
    }
    return 'ok' as const;
  }, []);

  const toggleTodo = useCallback(async (todoId: string, date: string) => {
    const current = todosByDateRef.current[date]?.find((todo) => todo.id === todoId);
    if (!current) throw new Error('todo-not-found');
    const next = mapRemoteTodo(await completeRemoteTodo(todoId, date, current.status !== 'done'));
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
  }, []);

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
    await deleteRemoteTodo(todoId, date);
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
  }, []);

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
        getScheduleTodoDetail,
        getDayProgress,
        getTodosForDate,
        hasLoadError,
        isReady,
        loadCalendarMonth,
        loadTodosForDate,
        toggleTodo,
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
