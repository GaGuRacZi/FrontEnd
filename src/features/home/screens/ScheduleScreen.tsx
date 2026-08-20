import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/src/components/common/AppIcon';
import { BrandLogoButton } from '@/src/components/common/BrandLogoButton';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, SIZE, SPACING } from '@/src/constants';
import { useScheduleTodoStore } from '../ScheduleTodoStore';
import type { ScheduleTodo } from '../ScheduleTodoStore';
import type { TodoCategory } from '../types';
import {
  CATEGORY_META,
  DAYS_KO,
  PROTECTED_TAGS,
  RECOMMENDED_TAGS,
  STATIC_MODAL_TAGS,
  STATIC_TAG_CONFIG,
  TAG_COLOR_PAIRS,
  getTagCategory,
  getTagColorPair,
  getTagCfg,
} from '../utils/scheduleConfig';
import {
  buildCalendarWeeks,
  formatDate,
  formatFullDate,
  generateRoutineTodos,
  getDayOfWeekKo,
  getDaysInMonth,
  getRoutineDatesInMonth,
} from '../utils/scheduleHelpers';
import { styles } from './ScheduleScreen.styles';

// ─── Screen ──────────────────────────────────────────────────────────────────

export function ScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const today = new Date();

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedTag, setSelectedTag] = useState<string>('전체');
  const { todos, customTags, setTodos, setCustomTags } = useScheduleTodoStore();

  // ── 모달 visible
  const [addVisible, setAddVisible] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [routinePickerVisible, setRoutinePickerVisible] = useState(false);

  // ── 루틴
  const [routineType, setRoutineType] = useState<'매일' | '특정요일' | '매월'>('특정요일');
  const [routineDays, setRoutineDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [routineStart, setRoutineStart] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [routineEnd, setRoutineEnd] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), getDaysInMonth(today.getFullYear(), today.getMonth())),
  );
  const [routinePickerFor, setRoutinePickerFor] = useState<'start' | 'end'>('start');
  const [routineViewYear, setRoutineViewYear] = useState(today.getFullYear());
  const [routineViewMonth, setRoutineViewMonth] = useState(today.getMonth());
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth());

  // ── 할일 추가 입력
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTag, setNewTag] = useState<string>('복약');
  const [newTimeHour, setNewTimeHour] = useState(20);
  const [newTimeMinute, setNewTimeMinute] = useState(0);

  // ── 태그 모달 입력
  const [newTagName, setNewTagName] = useState('');
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);

  // ── 애니메이션
  const addSheetY = useRef(new Animated.Value(500)).current;
  const tagSheetY = useRef(new Animated.Value(500)).current;
  const routineSheetY = useRef(new Animated.Value(500)).current;
  const timeSheetY = useRef(new Animated.Value(500)).current;
  const routinePickerSheetY = useRef(new Animated.Value(500)).current;

  const openSheet = (anim: Animated.Value, setVisible: (v: boolean) => void) => {
    setVisible(true);
    anim.setValue(500);
    Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };
  const closeSheet = (anim: Animated.Value, setVisible: (v: boolean) => void) => {
    Animated.timing(anim, { toValue: 500, duration: 220, useNativeDriver: true }).start(() => setVisible(false));
  };

  const formattedTime = `${String(newTimeHour).padStart(2, '0')}:${String(newTimeMinute).padStart(2, '0')}`;
  const amPm = newTimeHour < 12 ? '오전' : '오후';

  // ── 동적 태그 목록
  const allFilterTags: string[] = ['전체', '복약', '병원', '산책', ...customTags.map((ct) => ct.name)];
  const allModalTags: string[] = ['복약', '병원', '산책', ...customTags.map((ct) => ct.name)];
  const tabBarHeight = SIZE.tabBarHeight + Math.max(0, insets.bottom - SPACING.xl);
  const fabBottom = tabBarHeight + SIZE.tabBarHeight - SPACING.jumbo;
  const sheetPaddingBottom = Math.max(SPACING.jumbo, insets.bottom + SPACING.xxl);
  const tallSheetPaddingBottom = Math.max(SPACING.jumbo + 16, sheetPaddingBottom);

  // ── 캘린더 데이터 (연·월 포함 필터링)
  const dayTodos = todos.filter((t) => t.day === selectedDay && t.month === viewMonth && t.year === viewYear);
  const filtered = selectedTag === '전체' ? dayTodos : dayTodos.filter((t) => t.tag === selectedTag);
  const doneCount = dayTodos.filter((t) => t.status === 'done').length;
  const totalCount = dayTodos.length;

  const dayTodoProgress = new Map<number, { done: number; total: number }>();
  todos
    .filter((t) => t.month === viewMonth && t.year === viewYear)
    .forEach((t) => {
      const progress = dayTodoProgress.get(t.day) ?? { done: 0, total: 0 };
      progress.total += 1;
      if (t.status === 'done') progress.done += 1;
      dayTodoProgress.set(t.day, progress);
    });

  const weeks = buildCalendarWeeks(viewYear, viewMonth);
  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); } else setViewMonth((m) => m - 1);
    setSelectedDay(1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); } else setViewMonth((m) => m + 1);
    setSelectedDay(1);
  };

  // ── 루틴 미니 캘린더
  const routineWeeks = buildCalendarWeeks(routineViewYear, routineViewMonth);
  const routineDatesSet = getRoutineDatesInMonth(routineViewYear, routineViewMonth, routineType, routineDays, routineStart, routineEnd);
  const isRoutineToday = (d: number) =>
    d === today.getDate() && routineViewMonth === today.getMonth() && routineViewYear === today.getFullYear();
  const prevRoutineMonth = () => {
    if (routineViewMonth === 0) { setRoutineViewYear((y) => y - 1); setRoutineViewMonth(11); } else setRoutineViewMonth((m) => m - 1);
  };
  const nextRoutineMonth = () => {
    if (routineViewMonth === 11) { setRoutineViewYear((y) => y + 1); setRoutineViewMonth(0); } else setRoutineViewMonth((m) => m + 1);
  };

  // ── 날짜 피커
  const pickerWeeks = buildCalendarWeeks(pickerYear, pickerMonth);
  const prevPickerMonth = () => {
    if (pickerMonth === 0) { setPickerYear((y) => y - 1); setPickerMonth(11); } else setPickerMonth((m) => m - 1);
  };
  const nextPickerMonth = () => {
    if (pickerMonth === 11) { setPickerYear((y) => y + 1); setPickerMonth(0); } else setPickerMonth((m) => m + 1);
  };
  const handlePickerSelect = (day: number) => {
    const selected = new Date(pickerYear, pickerMonth, day);
    if (routinePickerFor === 'start') {
      setRoutineStart(selected);
      if (selected > routineEnd) setRoutineEnd(selected);
    } else {
      if (selected >= routineStart) setRoutineEnd(selected);
      else setRoutineStart(selected);
    }
    closeSheet(routinePickerSheetY, setRoutinePickerVisible);
  };
  const openDatePicker = (target: 'start' | 'end') => {
    const ref = target === 'start' ? routineStart : routineEnd;
    setRoutinePickerFor(target);
    setPickerYear(ref.getFullYear());
    setPickerMonth(ref.getMonth());
    openSheet(routinePickerSheetY, setRoutinePickerVisible);
  };

  // ── 할일 토글
  const handleToggle = (id: string) => {
    setTodos((prev) => prev.map((t) => t.id === id ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t));
  };

  // ── 할일 추가 (루틴 설정 적용 → 해당하는 모든 날짜에 생성)
  const handleAdd = () => {
    if (!newTitle.trim()) return;
    const cat: TodoCategory = getTagCategory(newTag);

    const base: Omit<ScheduleTodo, 'id' | 'day' | 'month' | 'year'> = {
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      timeLabel: formattedTime,
      status: 'pending',
      category: cat,
      tag: newTag,
    };

    const newTodos = generateRoutineTodos(base, routineType, routineDays, routineStart, routineEnd);

    // 루틴 날짜가 없으면 (기간이 비어있는 경우) 선택된 날 하나만 추가
    if (newTodos.length === 0) {
      newTodos.push({ ...base, id: `st-${Date.now()}`, day: selectedDay, month: viewMonth, year: viewYear });
    }

    setTodos((prev) => [...prev, ...newTodos]);
    setNewTitle('');
    setNewDesc('');
    closeSheet(addSheetY, setAddVisible);
  };

  // ── 태그 저장
  const handleSaveTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    if (PROTECTED_TAGS.includes(name) || customTags.some((ct) => ct.name === name)) return;
    setCustomTags((prev) => [...prev, { id: `ct-${Date.now()}`, name, colorIdx: selectedColorIdx }]);
    setNewTagName('');
    setSelectedColorIdx(0);
    closeSheet(tagSheetY, setTagModalVisible);
  };

  const handleDeleteCustomTag = (tagId: string) => {
    const ct = customTags.find((c) => c.id === tagId);
    if (!ct) return;
    setCustomTags((prev) => prev.filter((c) => c.id !== tagId));
    setTodos((prev) => prev.filter((t) => t.tag !== ct.name));
    if (selectedTag === ct.name) setSelectedTag('전체');
  };

  return (
    <>
      <ScreenLayout
        headerFullWidth
        leftContent={<BrandLogoButton />}
        rightContent={
          <Pressable accessibilityLabel="알림" hitSlop={8} onPress={() => router.push('/notifications')} style={styles.bellBtn}>
            <AppIcon color={COLORS.gray600} name="notifications-outline" size={22} />
          </Pressable>
        }
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={styles.scroll}>
          {/* ── 서브 헤더 */}
          <View style={styles.subHeader}>
            <Pressable hitSlop={8} onPress={() => router.back()} style={styles.backBtn}>
              <AppIcon color={COLORS.black} name="chevron-back" size={22} />
            </Pressable>
            <View style={styles.titleBlock}>
              <Text style={styles.pageTitle}>오늘의 할 일</Text>
              <Text style={styles.pageDate}>{formatFullDate(today)}</Text>
            </View>
          </View>

          {/* ── 캘린더 카드 */}
          <View style={styles.calendarCard}>
            <View style={styles.calMonthRow}>
              <Text style={styles.calMonthText}>{viewYear}년 {viewMonth + 1}월</Text>
              <View style={styles.calArrowGroup}>
                <Pressable hitSlop={12} onPress={prevMonth}><AppIcon color={COLORS.gray500} name="chevron-back" size={16} /></Pressable>
                <Pressable hitSlop={12} onPress={nextMonth}><AppIcon color={COLORS.gray500} name="chevron-forward" size={16} /></Pressable>
              </View>
            </View>
            <View style={styles.calWeekRow}>
              {DAYS_KO.map((d, i) => (
                <Text key={d} style={[styles.calWeekDay, i === 5 && styles.calWeekDaySat, i === 6 && styles.calWeekDaySun]}>{d}</Text>
              ))}
            </View>
            <View style={styles.calGrid}>
              {weeks.map((week, wi) => (
                <View key={wi} style={styles.calRow}>
                  {week.map((d, di) => {
                    if (d === null) return <View key={`e-${wi}-${di}`} style={styles.calCell} />;
                    const todayCell = isToday(d);
                    const isSelected = d === selectedDay;
                    const progress = dayTodoProgress.get(d);
                    const dotColor = progress
                      ? progress.done === 0
                        ? COLORS.danger
                        : progress.done === progress.total
                          ? COLORS.success
                          : COLORS.starWarm
                      : null;
                    const isSat = di === 5;
                    const isSun = di === 6;
                    return (
                      <Pressable key={d} onPress={() => setSelectedDay(d)} style={styles.calCell}>
                        <View style={[styles.calBubble, isSelected ? styles.calBubbleSelected : (todayCell ? styles.calBubbleToday : null)]}>
                          <Text style={[
                            styles.calDateText,
                            isSat && !isSelected && !todayCell && styles.calDateTextSat,
                            isSun && !isSelected && !todayCell && styles.calDateTextSun,
                            isSelected ? styles.calDateTextSelected : (todayCell ? styles.calDateTextToday : null),
                          ]}>{d}</Text>
                        </View>
                        <View style={styles.dotRow}>
                          {dotColor ? <View style={[styles.calDot, { backgroundColor: dotColor }]} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            <View style={styles.calProgressRow}>
              <View style={styles.calProgressBadge}>
                <Text style={styles.calProgressText}>완료 {doneCount}/{totalCount}</Text>
              </View>
            </View>
          </View>

          {/* ── 섹션 타이틀 */}
          <Text style={styles.sectionTitle}>{viewMonth + 1}월 {selectedDay}일 할 일</Text>

          {/* ── 태그 필터 */}
          <View style={styles.tagRow}>
            {allFilterTags.map((tag) => {
              const active = selectedTag === tag;
              const cfg = tag !== '전체' ? getTagCfg(tag, customTags) : null;
              const bg = active ? (cfg ? cfg.color : COLORS.primary) : (cfg ? cfg.bg : COLORS.primarySoft);
              const textColor = active ? COLORS.background : (cfg ? cfg.color : COLORS.primary);
              return (
                <Pressable key={tag} onPress={() => setSelectedTag(tag)} style={[styles.tagChip, { backgroundColor: bg }]}>
                  <Text style={[styles.tagChipText, { color: textColor }]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── 할일 목록 */}
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{'이 날의 할 일이 없어요.\n+ 버튼으로 추가해보세요.'}</Text>
            </View>
          ) : (
            <View style={styles.taskList}>
              {filtered.map((todo) => {
                const isDone = todo.status === 'done';
                const meta = CATEGORY_META[todo.category];
                const tagCfg = getTagCfg(todo.tag, customTags);
                return (
                  <View key={todo.id} style={styles.taskCard}>
                    <View style={[styles.taskIconWrap, { backgroundColor: meta.tint }]}>
                      <Image source={meta.icon} style={{ height: meta.iconSize, resizeMode: 'contain', width: meta.iconSize }} />
                    </View>
                    <View style={styles.taskBody}>
                      <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>{todo.title}</Text>
                      {todo.description ? <Text numberOfLines={1} style={styles.taskDesc}>{todo.description}</Text> : null}
                    </View>
                    <View style={[styles.taskTagBadge, { backgroundColor: tagCfg.bg }]}>
                      <Text style={[styles.taskTagText, { color: tagCfg.color }]}>{todo.tag}</Text>
                    </View>
                    <Text style={styles.taskTime}>{todo.timeLabel}</Text>
                    <Pressable onPress={() => handleToggle(todo.id)} style={[styles.checkbox, isDone && styles.checkboxDone]}>
                      {isDone ? <AppIcon color={COLORS.background} name="checkmark" size={13} /> : null}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* FAB */}
        <Pressable accessibilityLabel="할일 추가" onPress={() => openSheet(addSheetY, setAddVisible)} style={[styles.fab, { bottom: fabBottom }]}>
          <AppIcon color={COLORS.background} name="add" size={30} />
        </Pressable>
      </ScreenLayout>

      {/* ── 할일 추가 모달 */}
      <Modal animationType="none" onRequestClose={() => closeSheet(addSheetY, setAddVisible)} statusBarTranslucent transparent visible={addVisible}>
        <Pressable onPress={() => closeSheet(addSheetY, setAddVisible)} style={styles.overlay}>
          <Animated.View onStartShouldSetResponder={() => true} style={[styles.sheet, { paddingBottom: sheetPaddingBottom, transform: [{ translateY: addSheetY }] }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>할일 추가</Text>
              <Pressable hitSlop={8} onPress={() => closeSheet(addSheetY, setAddVisible)} style={styles.closeCircleBtn}>
                <AppIcon color={COLORS.gray600} name="close" size={18} />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>할 일</Text>
              {/* lineHeight 제거로 플레이스홀더 흔들림 방지 */}
              <TextInput
                onChangeText={setNewTitle}
                placeholder="예: 저녁 심장약 복용"
                placeholderTextColor={COLORS.gray500}
                style={styles.input}
                value={newTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>세부 내용</Text>
              <TextInput
                multiline
                numberOfLines={3}
                onChangeText={setNewDesc}
                placeholder="예: 카미녹스 저녁 식후"
                placeholderTextColor={COLORS.gray500}
                style={[styles.input, styles.inputMulti]}
                textAlignVertical="top"
                value={newDesc}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>태그</Text>
              <View style={styles.tagSelectRow}>
                {allModalTags.map((tag) => {
                  const cfg = getTagCfg(tag, customTags);
                  const active = newTag === tag;
                  return (
                    <Pressable key={tag} onPress={() => setNewTag(tag)} style={[styles.tagChip, { backgroundColor: active ? cfg.color : cfg.bg }]}>
                      <Text style={[styles.tagChipText, { color: active ? COLORS.background : cfg.color }]}>{tag}</Text>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => openSheet(tagSheetY, setTagModalVisible)} style={styles.tagAddBtn}>
                  <AppIcon color={COLORS.gray500} name="add" size={18} />
                </Pressable>
              </View>
            </View>

            {/* 시간 + 루틴: 같은 높이 */}
            <View style={styles.timeRoutineRow}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.inputLabel}>시간</Text>
                <Pressable onPress={() => openSheet(timeSheetY, setTimePickerVisible)} style={styles.rowField}>
                  <AppIcon color={COLORS.primary} name="time-outline" size={16} />
                  <View style={styles.flex1}>
                    <Text style={styles.routineDateText}>{formattedTime}</Text>
                    <Text style={styles.routineDayText}>{amPm}</Text>
                  </View>
                </Pressable>
              </View>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.inputLabel}>루틴 설정</Text>
                <Pressable onPress={() => openSheet(routineSheetY, setRoutineModalVisible)} style={[styles.rowField, styles.routineField]}>
                  <AppIcon color={COLORS.primary} name="calendar-outline" size={16} />
                  <View style={styles.flex1}>
                    <Text style={styles.routineDateText}>{routineStart.getMonth() + 1}월 {routineStart.getDate()}일</Text>
                    <Text style={styles.routineDayText}>{getDayOfWeekKo(routineStart.getFullYear(), routineStart.getMonth(), routineStart.getDate())}</Text>
                  </View>
                  <AppIcon color={COLORS.gray500} name="chevron-forward" size={14} />
                </Pressable>
              </View>
            </View>

            <Pressable onPress={handleAdd} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>추가하기</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── 시간 선택 모달 */}
      <Modal animationType="none" onRequestClose={() => closeSheet(timeSheetY, setTimePickerVisible)} statusBarTranslucent transparent visible={timePickerVisible}>
        <Pressable onPress={() => closeSheet(timeSheetY, setTimePickerVisible)} style={styles.overlay}>
          <Animated.View onStartShouldSetResponder={() => true} style={[styles.sheet, { paddingBottom: sheetPaddingBottom, transform: [{ translateY: timeSheetY }] }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>시간 설정</Text>
              <Pressable hitSlop={8} onPress={() => closeSheet(timeSheetY, setTimePickerVisible)} style={styles.closeCircleBtn}>
                <AppIcon color={COLORS.gray600} name="close" size={18} />
              </Pressable>
            </View>
            <View style={styles.timePickerWrap}>
              <View style={styles.timePickerCol}>
                <Pressable onPress={() => setNewTimeHour((h) => (h + 1) % 24)} style={styles.timeArrowBtn}>
                  <AppIcon color={COLORS.primary} name="chevron-up" size={28} />
                </Pressable>
                <View style={styles.timeValueBox}>
                  <Text style={styles.timePickerValue}>{String(newTimeHour).padStart(2, '0')}</Text>
                </View>
                <Pressable onPress={() => setNewTimeHour((h) => (h - 1 + 24) % 24)} style={styles.timeArrowBtn}>
                  <AppIcon color={COLORS.primary} name="chevron-down" size={28} />
                </Pressable>
                <Text style={styles.timePickerUnit}>시</Text>
              </View>
              <Text style={styles.timeColon}>:</Text>
              <View style={styles.timePickerCol}>
                <Pressable onPress={() => setNewTimeMinute((m) => (m + 5) % 60)} style={styles.timeArrowBtn}>
                  <AppIcon color={COLORS.primary} name="chevron-up" size={28} />
                </Pressable>
                <View style={styles.timeValueBox}>
                  <Text style={styles.timePickerValue}>{String(newTimeMinute).padStart(2, '0')}</Text>
                </View>
                <Pressable onPress={() => setNewTimeMinute((m) => (m - 5 + 60) % 60)} style={styles.timeArrowBtn}>
                  <AppIcon color={COLORS.primary} name="chevron-down" size={28} />
                </Pressable>
                <Text style={styles.timePickerUnit}>분</Text>
              </View>
            </View>
            <Pressable onPress={() => closeSheet(timeSheetY, setTimePickerVisible)} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>확인</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── 태그 추가/수정 모달 */}
      <Modal animationType="none" onRequestClose={() => closeSheet(tagSheetY, setTagModalVisible)} statusBarTranslucent transparent visible={tagModalVisible}>
        <Pressable onPress={() => closeSheet(tagSheetY, setTagModalVisible)} style={styles.overlay}>
          <Animated.View onStartShouldSetResponder={() => true} style={[styles.sheet, { paddingBottom: sheetPaddingBottom, transform: [{ translateY: tagSheetY }] }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>태그 추가/수정</Text>
              <Pressable hitSlop={8} onPress={() => closeSheet(tagSheetY, setTagModalVisible)} style={styles.closeCircleBtn}>
                <AppIcon color={COLORS.gray600} name="close" size={18} />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.tagSectionLabel}>현재 태그</Text>
              <View style={styles.tagSelectRow}>
                {STATIC_MODAL_TAGS.map((tag) => {
                  const cfg = STATIC_TAG_CONFIG[tag];
                  return (
                    <View key={tag} style={[styles.tagChipWithX, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.tagChipText, { color: cfg.color }]}>{tag}</Text>
                    </View>
                  );
                })}
                {customTags.map((ct) => {
                  const cfg = getTagColorPair(ct.colorIdx);
                  return (
                    <Pressable key={ct.id} onPress={() => handleDeleteCustomTag(ct.id)} style={[styles.tagChipWithX, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.tagChipText, { color: cfg.color }]}>{ct.name}</Text>
                      <AppIcon color={cfg.color} name="close" size={11} />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.tagSectionLabel}>태그 이름</Text>
                <Text style={styles.counterText}>{newTagName.length}/10</Text>
              </View>
              <TextInput
                maxLength={10}
                onChangeText={setNewTagName}
                placeholder="태그 이름 입력"
                placeholderTextColor={COLORS.gray500}
                style={styles.input}
                value={newTagName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.tagSectionLabel}>태그 색상</Text>
              <View style={styles.colorRow}>
                {TAG_COLOR_PAIRS.map((pair, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setSelectedColorIdx(idx)}
                    style={[styles.colorDot, { backgroundColor: pair.bg, borderColor: pair.color }]}
                  >
                    {selectedColorIdx === idx && (
                      <AppIcon color={pair.color} name="checkmark" size={14} />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.tagSectionLabel}>추천 태그</Text>
              <View style={styles.tagSelectRow}>
                {RECOMMENDED_TAGS.map((t) => (
                  <Pressable key={t} onPress={() => setNewTagName(t)} style={styles.suggTagChip}>
                    <Text style={styles.suggTagChipText}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.tagFooter}>
              <Pressable onPress={() => closeSheet(tagSheetY, setTagModalVisible)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>취소</Text>
              </Pressable>
              <Pressable onPress={handleSaveTag} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>저장하기</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── 루틴 날짜 설정 모달 */}
      <Modal animationType="none" onRequestClose={() => closeSheet(routineSheetY, setRoutineModalVisible)} statusBarTranslucent transparent visible={routineModalVisible}>
        <Pressable onPress={() => closeSheet(routineSheetY, setRoutineModalVisible)} style={styles.overlay}>
          <Animated.View onStartShouldSetResponder={() => true} style={[styles.sheet, styles.sheetTall, { paddingBottom: tallSheetPaddingBottom, transform: [{ translateY: routineSheetY }] }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>루틴 날짜 설정</Text>
                <Text style={styles.sheetSubtitle}>루틴으로 설정할 날짜를 모두 체크해주세요.</Text>
              </View>
              <Pressable hitSlop={8} onPress={() => closeSheet(routineSheetY, setRoutineModalVisible)} style={styles.closeCircleBtn}>
                <AppIcon color={COLORS.gray600} name="close" size={18} />
              </Pressable>
            </View>

            <View style={styles.routineCalCard}>
              <View style={styles.calMonthRow}>
                <Text style={styles.calMonthText}>{routineViewYear}년 {routineViewMonth + 1}월</Text>
                <View style={styles.calArrowGroup}>
                  <Pressable hitSlop={12} onPress={prevRoutineMonth}><AppIcon color={COLORS.gray500} name="chevron-back" size={16} /></Pressable>
                  <Pressable hitSlop={12} onPress={nextRoutineMonth}><AppIcon color={COLORS.gray500} name="chevron-forward" size={16} /></Pressable>
                </View>
              </View>
              <View style={styles.calWeekRow}>
                {DAYS_KO.map((d, i) => (
                  <Text key={d} style={[styles.calWeekDay, i === 5 && styles.calWeekDaySat, i === 6 && styles.calWeekDaySun]}>{d}</Text>
                ))}
              </View>
              <View style={styles.calGrid}>
                {routineWeeks.map((week, wi) => (
                  <View key={wi} style={styles.calRow}>
                    {week.map((d, di) => {
                      if (d === null) return <View key={`re-${wi}-${di}`} style={styles.calCell} />;
                      const todayMark = isRoutineToday(d);
                      const isRoutineDate = routineDatesSet.has(d);
                      const isSat = di === 5;
                      const isSun = di === 6;
                      return (
                        <View key={`r${d}`} style={styles.calCell}>
                          <View style={[
                            styles.calBubble,
                            isRoutineDate && styles.routineHighlightBubble,
                            todayMark && !isRoutineDate && styles.calBubbleToday,
                          ]}>
                            <Text style={[
                              styles.calDateText,
                              isSat && !isRoutineDate && !todayMark && styles.calDateTextSat,
                              isSun && !isRoutineDate && !todayMark && styles.calDateTextSun,
                              todayMark && !isRoutineDate && styles.calDateTextToday,
                              isRoutineDate && styles.routineHighlightText,
                            ]}>{d}</Text>
                          </View>
                          <View style={styles.dotRow} />
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>간편 설정</Text>
              <View style={styles.routineTypeRow}>
                {(['매일', '특정요일', '매월'] as const).map((type) => {
                  const active = routineType === type;
                  return (
                    <Pressable key={type} onPress={() => setRoutineType(type)} style={[styles.routineTypeChip, active && styles.routineTypeChipActive]}>
                      {active ? <AppIcon color={COLORS.primary} name="checkmark" size={12} /> : null}
                      <Text style={[styles.routineTypeText, active && styles.routineTypeTextActive]}>{type}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {routineType === '특정요일' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>특정 요일</Text>
                <View style={styles.routineDayRow}>
                  {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => {
                    const active = routineDays.includes(i);
                    return (
                      <Pressable
                        key={day}
                        onPress={() => setRoutineDays((prev) => active ? prev.filter((d) => d !== i) : [...prev, i])}
                        style={[styles.routineDayChip, active && styles.routineDayChipActive]}
                      >
                        <Text style={[styles.routineDayChipText, active && styles.routineDayChipTextActive]}>{day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>루틴 기간</Text>
              <View style={styles.routinePeriodRow}>
                <Pressable onPress={() => openDatePicker('start')} style={[styles.rowField, styles.flex1]}>
                  <AppIcon color={COLORS.primary} name="calendar-outline" size={15} />
                  <View style={styles.flex1}>
                    <Text style={styles.periodLabel}>시작일</Text>
                    <Text style={styles.rowFieldText}>{formatDate(routineStart)}</Text>
                  </View>
                  <AppIcon color={COLORS.gray500} name="chevron-forward" size={14} />
                </Pressable>
                <Pressable onPress={() => openDatePicker('end')} style={[styles.rowField, styles.flex1]}>
                  <AppIcon color={COLORS.primary} name="calendar-outline" size={15} />
                  <View style={styles.flex1}>
                    <Text style={styles.periodLabel}>종료일</Text>
                    <Text style={styles.rowFieldText}>{formatDate(routineEnd)}</Text>
                  </View>
                  <AppIcon color={COLORS.gray500} name="chevron-forward" size={14} />
                </Pressable>
              </View>
            </View>

            <Pressable onPress={() => closeSheet(routineSheetY, setRoutineModalVisible)} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>선택 완료</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* ── 날짜 피커 모달 */}
      <Modal animationType="none" onRequestClose={() => closeSheet(routinePickerSheetY, setRoutinePickerVisible)} statusBarTranslucent transparent visible={routinePickerVisible}>
        <Pressable onPress={() => closeSheet(routinePickerSheetY, setRoutinePickerVisible)} style={styles.overlay}>
          <Animated.View onStartShouldSetResponder={() => true} style={[styles.sheet, { paddingBottom: sheetPaddingBottom, transform: [{ translateY: routinePickerSheetY }] }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{routinePickerFor === 'start' ? '시작일 선택' : '종료일 선택'}</Text>
              <Pressable hitSlop={8} onPress={() => closeSheet(routinePickerSheetY, setRoutinePickerVisible)} style={styles.closeCircleBtn}>
                <AppIcon color={COLORS.gray600} name="close" size={18} />
              </Pressable>
            </View>
            <View style={styles.pickerCalCard}>
              <View style={styles.calMonthRow}>
                <Text style={styles.calMonthText}>{pickerYear}년 {pickerMonth + 1}월</Text>
                <View style={styles.calArrowGroup}>
                  <Pressable hitSlop={12} onPress={prevPickerMonth}><AppIcon color={COLORS.gray500} name="chevron-back" size={16} /></Pressable>
                  <Pressable hitSlop={12} onPress={nextPickerMonth}><AppIcon color={COLORS.gray500} name="chevron-forward" size={16} /></Pressable>
                </View>
              </View>
              <View style={styles.calWeekRow}>
                {DAYS_KO.map((d, i) => (
                  <Text key={d} style={[styles.calWeekDay, i === 5 && styles.calWeekDaySat, i === 6 && styles.calWeekDaySun]}>{d}</Text>
                ))}
              </View>
              <View style={styles.calGrid}>
                {pickerWeeks.map((week, wi) => (
                  <View key={wi} style={styles.calRow}>
                    {week.map((d, di) => {
                      if (d === null) return <View key={`pe-${wi}-${di}`} style={styles.calCell} />;
                      const isSat = di === 5;
                      const isSun = di === 6;
                      const ref = routinePickerFor === 'start' ? routineStart : routineEnd;
                      const isSelected = d === ref.getDate() && pickerMonth === ref.getMonth() && pickerYear === ref.getFullYear();
                      return (
                        <Pressable key={d} onPress={() => handlePickerSelect(d)} style={styles.calCell}>
                          <View style={[styles.calBubble, isSelected && styles.calBubbleSelected]}>
                            <Text style={[
                              styles.calDateText,
                              isSat && !isSelected && styles.calDateTextSat,
                              isSun && !isSelected && styles.calDateTextSun,
                              isSelected && styles.calDateTextSelected,
                            ]}>{d}</Text>
                          </View>
                          <View style={styles.dotRow} />
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
            <Pressable onPress={() => closeSheet(routinePickerSheetY, setRoutinePickerVisible)} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>확인</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}
