import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import type { AppIconName } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { TodoCategory, TodoSummaryItem } from '../types';

type TodaySummaryCardProps = {
  onPressMore: () => void;
  onToggleTodo: (todoId: string) => void;
  todos: readonly TodoSummaryItem[];
};

const CATEGORY_META: Record<TodoCategory, { icon: ImageSourcePropType; iconSize: number; tint: string }> = {
  medication: { icon: require('../../../../assets/images/home/pill.png'), iconSize: 20, tint: COLORS.primarySoft },
  hospital: { icon: require('../../../../assets/images/home/diagnosis.png'), iconSize: 24, tint: COLORS.yellow },
  walk: { icon: require('../../../../assets/images/home/walk.png'), iconSize: 18, tint: COLORS.greenSoft }, 
};

export function TodaySummaryCard({ onPressMore, onToggleTodo, todos }: TodaySummaryCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>오늘의 할 일</Text>
        <Pressable
          accessibilityLabel="오늘의 할 일 전체보기"
          accessibilityRole="button"
          hitSlop={SPACING.md}
          onPress={onPressMore}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
        >
          <Text style={styles.headerActionLabel}>전체보기</Text>
          <AppIcon color={COLORS.gray500} name="chevron-forward" size={16} />
        </Pressable>
      </View>

      <View style={styles.list}>
        {todos.map((todo) => {
          const isDone = todo.status === 'done';
          const meta = CATEGORY_META[todo.category];

          return (
            <Pressable
              accessibilityLabel={`${todo.title} ${isDone ? '완료됨' : '미완료'}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone }}
              key={todo.id}
              onPress={() => onToggleTodo(todo.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.iconContainer, { backgroundColor: meta.tint }]}>
                  <Image
                    accessibilityIgnoresInvertColors
                    source={meta.icon}
                    style={[styles.categoryIcon, { height: meta.iconSize, width: meta.iconSize }]}
                  />
              </View>

              <View style={styles.textGroup}>
                <Text style={[styles.title, isDone && styles.titleDone]}>{todo.title}</Text>
                {todo.description ? (
                  <Text numberOfLines={1} style={styles.description}>
                    {todo.description}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.time}>{todo.timeLabel}</Text>

              <View style={[styles.checkBox, isDone && styles.checkBoxDone]}>
                {isDone ? <AppIcon color={COLORS.background} name="checkmark" size={14} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    gap: SPACING.lg,
    padding: SPACING.xxl,
  },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerTitle: { ...TYPOGRAPHY.title3, color: COLORS.black },
  headerAction: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  headerActionLabel: { ...TYPOGRAPHY.label, color: COLORS.gray600 },
  list: { gap: SPACING.md },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  pressed: { opacity: 0.65 },
  iconContainer: {
    alignItems: 'center',
    borderRadius: RADIUS.round,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  categoryIcon: { resizeMode: 'contain' },
  textGroup: { flex: 1, gap: 2 },
  title: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
  titleDone: { color: COLORS.gray500, textDecorationLine: 'line-through' },
  description: { ...TYPOGRAPHY.small, color: COLORS.gray600 },
  time: { ...TYPOGRAPHY.body2, color: COLORS.primary, fontFamily: TYPOGRAPHY.button.fontFamily },
  checkBox: {
    alignItems: 'center',
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkBoxDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});