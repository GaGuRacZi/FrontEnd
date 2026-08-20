import type { ScheduleTodo } from '../ScheduleTodoStore';

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayIndex(year: number, month: number) {
  const jsDay = new Date(year, month, 1).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function formatFullDate(date: Date) {
  const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}`;
}

export function getDayOfWeekKo(year: number, month: number, day: number) {
  return ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][new Date(year, month, day).getDay()];
}

export function formatDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 루틴 기간·타입에 해당하는 날짜 집합 계산
export function getRoutineDatesInMonth(
  year: number,
  month: number,
  routineType: '매일' | '특정요일' | '매월',
  routineDays: number[],
  startDate: Date,
  endDate: Date,
): Set<number> {
  const result = new Set<number>();
  const daysInMonth = getDaysInMonth(year, month);
  const startOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date < startOnly || date > endOnly) continue;
    if (routineType === '매일') {
      result.add(day);
    } else if (routineType === '특정요일') {
      const jsDay = date.getDay();
      const ourDay = jsDay === 0 ? 6 : jsDay - 1;
      if (routineDays.includes(ourDay)) result.add(day);
    } else if (routineType === '매월') {
      if (day === startDate.getDate()) result.add(day);
    }
  }
  return result;
}

export function buildCalendarWeeks(year: number, month: number): (number | null)[][] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstIdx = getFirstDayIndex(year, month);
  const cells: (number | null)[] = [
    ...Array<null>(firstIdx).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// 루틴 범위 내 전체 날짜 생성
export function generateRoutineTodos(
  base: Omit<ScheduleTodo, 'id' | 'day' | 'month' | 'year'>,
  routineType: '매일' | '특정요일' | '매월',
  routineDays: number[],
  startDate: Date,
  endDate: Date,
): ScheduleTodo[] {
  const todos: ScheduleTodo[] = [];
  const ts = Date.now();
  let idx = 0;

  let curY = startDate.getFullYear();
  let curM = startDate.getMonth();
  const endY = endDate.getFullYear();
  const endM = endDate.getMonth();

  while (curY < endY || (curY === endY && curM <= endM)) {
    const datesSet = getRoutineDatesInMonth(curY, curM, routineType, routineDays, startDate, endDate);
    datesSet.forEach((day) => {
      todos.push({ ...base, id: `st-${ts}-${idx++}`, day, month: curM, year: curY });
    });
    if (curM === 11) { curY++; curM = 0; } else curM++;
  }
  return todos;
}
