import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppChip } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { NotificationCard } from '../components/NotificationCard';
import { MOCK_NOTIFICATIONS } from '../mock';
import type { NotificationFilterValue } from '../types';

const FILTER_OPTIONS: { label: string; value: NotificationFilterValue }[] = [
  { value: 'all', label: '전체' },
  { value: 'schedule', label: '일정' },
  { value: 'ai', label: 'AI' },
  { value: 'community', label: '커뮤니티' },
  { value: 'blood-donation', label: '긴급' },
];

export function NotificationScreen() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [filterValue, setFilterValue] = useState<NotificationFilterValue>('all');

  const filteredNotifications =
    filterValue === 'all'
      ? notifications
      : notifications.filter((notification) => notification.category === filterValue);

  const groupOrder = Array.from(
    new Set(filteredNotifications.map((notification) => notification.dateGroupLabel)),
  );

  const handleMarkAllRead = () => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    );
  };

  return (
    <ScreenLayout
      headerVariant="auth"
      rightContent={
        <Pressable
          accessibilityLabel="모두 읽음으로 표시"
          accessibilityRole="button"
          hitSlop={SPACING.md}
          onPress={handleMarkAllRead}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.markAllLabel}>모두 읽음</Text>
        </Pressable>
      }
      title="알림"
    >
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((option) => (
          <AppChip
            key={option.value}
            label={option.label}
            onPress={() => setFilterValue(option.value)}
            selected={option.value === filterValue}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        {groupOrder.map((groupLabel) => (
          <View key={groupLabel} style={styles.group}>
            <Text style={styles.groupTitle}>{groupLabel}</Text>
            <View style={styles.list}>
              {filteredNotifications
                .filter((notification) => notification.dateGroupLabel === groupLabel)
                .map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onPress={() => {
                      // TODO: 알림 유형별 상세 화면 라우팅 연결
                    }}
                  />
                ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.65 },
  markAllLabel: { ...TYPOGRAPHY.label, color: COLORS.gray600 },
  filterRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  scroll: { flex: 1 },
  content: { gap: SPACING.xxl, paddingBottom: SPACING.xxxl, paddingTop: SPACING.xl },
  group: { gap: SPACING.md },
  groupTitle: { ...TYPOGRAPHY.title3, color: COLORS.black },
  list: { gap: SPACING.md },
});