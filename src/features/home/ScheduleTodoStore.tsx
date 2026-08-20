import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useState } from 'react';

import type { TodoCategory } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CustomTag = { id: string; name: string; colorIdx: number };

export type ScheduleTodo = {
  id: string;
  title: string;
  description?: string;
  timeLabel: string;
  status: 'done' | 'pending';
  category: TodoCategory;
  tag: string;
  day: number;
  month: number; // 0-indexed
  year: number;
};

// ─── Initial Data ─────────────────────────────────────────────────────────────

const _now = new Date();
const _d = _now.getDate();
const _m = _now.getMonth();
const _y = _now.getFullYear();

const INITIAL_TODOS: ScheduleTodo[] = [
  { id: 'st-1', title: '심장약 복용', description: '카미녹스 1정', timeLabel: '20:00', status: 'pending', category: 'medication', tag: '복약', day: _d, month: _m, year: _y },
  { id: 'st-2', title: '병원 진료', description: '심장 초음파 관련', timeLabel: '14:00', status: 'pending', category: 'hospital', tag: '병원', day: _d, month: _m, year: _y },
  { id: 'st-3', title: '기분전환 산책', description: '부담없이 30분 걷기', timeLabel: '20:55', status: 'pending', category: 'walk', tag: '산책', day: _d, month: _m, year: _y },
  { id: 'st-4', title: '영양제 복용', description: '하루 1정씩', timeLabel: '08:00', status: 'done', category: 'medication', tag: '복약', day: _d, month: _m, year: _y },
  { id: 'st-5', title: '정기 검진', description: '동물 병원 예약', timeLabel: '10:00', status: 'pending', category: 'hospital', tag: '병원', day: Math.min(_d + 4, 28), month: _m, year: _y },
  { id: 'st-6', title: '심장약 복용', description: '카미녹스 1정', timeLabel: '20:00', status: 'pending', category: 'medication', tag: '복약', day: Math.min(_d + 7, 28), month: _m, year: _y },
];

// ─── Context ─────────────────────────────────────────────────────────────────

type ScheduleTodoStoreContextValue = {
  todos: ScheduleTodo[];
  customTags: CustomTag[];
  setTodos: React.Dispatch<React.SetStateAction<ScheduleTodo[]>>;
  setCustomTags: React.Dispatch<React.SetStateAction<CustomTag[]>>;
  toggleTodo: (id: string) => void;
};

const ScheduleTodoStoreContext = createContext<ScheduleTodoStoreContextValue | null>(null);

export function ScheduleTodoProvider({ children }: PropsWithChildren) {
  const [todos, setTodos] = useState<ScheduleTodo[]>(INITIAL_TODOS);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => t.id === id ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t),
    );
  }, []);

  return (
    <ScheduleTodoStoreContext.Provider value={{ todos, customTags, setTodos, setCustomTags, toggleTodo }}>
      {children}
    </ScheduleTodoStoreContext.Provider>
  );
}

export function useScheduleTodoStore(): ScheduleTodoStoreContextValue {
  const ctx = useContext(ScheduleTodoStoreContext);
  if (!ctx) throw new Error('useScheduleTodoStore must be used inside ScheduleTodoProvider');
  return ctx;
}
