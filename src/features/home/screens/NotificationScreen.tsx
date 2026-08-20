import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppChip, EmptyState, LoadingView } from '@/src/components/common';
import { ScreenLayout } from '@/src/components/layout';
import { useAppAlert } from '@/src/components/modal';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { NotificationCard } from '../components/NotificationCard';
import {
  getRemoteNotifications,
  getRemoteUnreadNotificationCount,
  markAllRemoteNotificationsRead,
  markRemoteNotificationRead,
} from '../services/notificationApi';
import type {
  NotificationFilterValue,
  NotificationItem,
} from '../types';

type NotificationSection = {
  data: NotificationItem[];
  title: string;
};

const FILTER_OPTIONS: { label: string; value: NotificationFilterValue }[] = [
  { value: 'all', label: '전체' },
  { value: 'schedule', label: '할 일' },
  { value: 'ai', label: 'AI' },
  { value: 'community', label: '커뮤니티' },
  { value: 'emergency', label: '건강' },
];

function createSections(notifications: NotificationItem[]) {
  const sections = new Map<string, NotificationItem[]>();
  notifications.forEach((notification) => {
    const group = sections.get(notification.dateGroupLabel) ?? [];
    group.push(notification);
    sections.set(notification.dateGroupLabel, group);
  });
  return [...sections].map(([title, data]) => ({ data, title }));
}

function getTargetHref(notification: NotificationItem): Href | null {
  if (!notification.target) return null;

  switch (notification.target.type) {
    case 'todo':
      return '/schedule';
    case 'visit':
      return {
        pathname: '/dashboard/[diagnosisId]',
        params: { diagnosisId: notification.target.id },
      };
    case 'post':
      return {
        pathname: '/community/[postId]',
        params: { postId: notification.target.id },
      };
    default:
      return null;
  }
}

export function NotificationScreen() {
  const router = useRouter();
  const showAlert = useAppAlert();
  const notificationsRef = useRef<NotificationItem[]>([]);
  const requestIdRef = useRef(0);
  const nextCursorRef = useRef<string | null>(null);
  const hasNextRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const [filterValue, setFilterValue] = useState<NotificationFilterValue>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [status, setStatus] = useState<'error' | 'loading' | 'ready'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const setNotificationItems = useCallback((next: NotificationItem[]) => {
    notificationsRef.current = next;
    setNotifications(next);
  }, []);

  const loadFirstPage = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const isInitialLoad = notificationsRef.current.length === 0;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    if (isInitialLoad) setStatus('loading');
    else setRefreshing(true);

    try {
      const [page, remoteUnreadCount] = await Promise.all([
        getRemoteNotifications({
          category: filterValue === 'all' ? undefined : filterValue,
        }),
        getRemoteUnreadNotificationCount().catch(() => null),
      ]);
      if (requestId !== requestIdRef.current) return;

      hasNextRef.current = page.hasNext;
      nextCursorRef.current = page.nextCursor;
      setNotificationItems(page.notifications);
      setUnreadCount(
        remoteUnreadCount ?? page.notifications.filter(({ isRead }) => !isRead).length,
      );
      setStatus('ready');
    } catch {
      if (requestId !== requestIdRef.current) return;
      if (notificationsRef.current.length === 0) setStatus('error');
    } finally {
      if (requestId === requestIdRef.current) setRefreshing(false);
    }
  }, [filterValue, setNotificationItems]);

  const loadNextPage = useCallback(async () => {
    if (loadingMoreRef.current || !hasNextRef.current || !nextCursorRef.current) return;

    const requestId = ++requestIdRef.current;
    const cursor = nextCursorRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const page = await getRemoteNotifications({
        category: filterValue === 'all' ? undefined : filterValue,
        cursor,
      });
      if (requestId !== requestIdRef.current) return;

      const knownIds = new Set(notificationsRef.current.map(({ id }) => id));
      setNotificationItems([
        ...notificationsRef.current,
        ...page.notifications.filter(({ id }) => !knownIds.has(id)),
      ]);
      hasNextRef.current = page.hasNext;
      nextCursorRef.current = page.nextCursor;
    } catch {
      return;
    } finally {
      if (requestId === requestIdRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [filterValue, setNotificationItems]);

  useFocusEffect(
    useCallback(() => {
      void loadFirstPage();
    }, [loadFirstPage]),
  );

  const sections = useMemo<NotificationSection[]>(
    () => createSections(notifications),
    [notifications],
  );
  const hasUnreadNotifications = unreadCount > 0;

  const selectFilter = (nextFilter: NotificationFilterValue) => {
    if (nextFilter === filterValue) return;

    requestIdRef.current += 1;
    nextCursorRef.current = null;
    hasNextRef.current = false;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setNotificationItems([]);
    setUnreadCount(0);
    setStatus('loading');
    setFilterValue(nextFilter);
  };

  const markNotificationRead = async (notification: NotificationItem) => {
    if (notification.isRead) return;

    try {
      await markRemoteNotificationRead(notification.id);
      setNotificationItems(
        notificationsRef.current.map((current) =>
          current.id === notification.id ? { ...current, isRead: true } : current,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      return;
    }
  };

  const openNotification = (notification: NotificationItem) => {
    void markNotificationRead(notification);
    const target = getTargetHref(notification);
    if (target) router.push(target);
  };

  const markAllRead = async () => {
    if (markingAllRead || !hasUnreadNotifications) return;

    setMarkingAllRead(true);
    try {
      await markAllRemoteNotificationsRead();
      setNotificationItems(
        notificationsRef.current.map((notification) => ({ ...notification, isRead: true })),
      );
      setUnreadCount(0);
    } catch {
      showAlert('모두 읽음 처리하지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      setMarkingAllRead(false);
    }
  };

  const rightContent = (
    <Pressable
      accessibilityLabel="모두 읽음으로 표시"
      accessibilityRole="button"
      disabled={markingAllRead || !hasUnreadNotifications}
      hitSlop={SPACING.md}
      onPress={() => void markAllRead()}
      style={({ pressed }) => [
        styles.markAllButton,
        (pressed || markingAllRead || !hasUnreadNotifications) && styles.markAllButtonDisabled,
      ]}
    >
      <Text style={styles.markAllLabel}>모두 읽음</Text>
    </Pressable>
  );

  if (status === 'loading') {
    return (
      <ScreenLayout headerVariant="auth" rightContent={rightContent} title="알림">
        <LoadingView label="알림을 불러오고 있어요." />
      </ScreenLayout>
    );
  }

  if (status === 'error') {
    return (
      <ScreenLayout headerVariant="auth" rightContent={rightContent} title="알림">
        <EmptyState
          actionLabel="다시 시도"
          description="인터넷 연결을 확인한 뒤 다시 시도해주세요."
          onActionPress={() => void loadFirstPage()}
          title="알림을 불러오지 못했어요"
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout headerVariant="auth" rightContent={rightContent} title="알림">
      <SectionList
        ListEmptyComponent={<EmptyState title="받은 알림이 없어요" />}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.primary} style={styles.footerLoader} /> : null}
        ListHeaderComponent={(
          <View style={styles.filterRow}>
            {FILTER_OPTIONS.map((option) => (
              <AppChip
                key={option.value}
                label={option.label}
                onPress={() => selectFilter(option.value)}
                selected={option.value === filterValue}
              />
            ))}
          </View>
        )}
        contentContainerStyle={styles.content}
        keyExtractor={(item) => item.id}
        onEndReached={() => void loadNextPage()}
        onEndReachedThreshold={0.2}
        refreshControl={(
          <RefreshControl
            colors={[COLORS.primary]}
            onRefresh={() => void loadFirstPage()}
            refreshing={refreshing}
            tintColor={COLORS.primary}
          />
        )}
        renderItem={({ item }) => (
          <NotificationCard notification={item} onPress={() => openNotification(item)} />
        )}
        renderSectionHeader={({ section }) => <Text style={styles.groupTitle}>{section.title}</Text>}
        sections={sections}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        style={styles.list}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  markAllButton: { opacity: 1 },
  markAllButtonDisabled: { opacity: 0.45 },
  markAllLabel: { ...TYPOGRAPHY.label, color: COLORS.primary },
  list: { flex: 1 },
  content: { gap: SPACING.xxl, paddingBottom: SPACING.xxxl, paddingTop: SPACING.lg },
  filterRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xl },
  groupTitle: { ...TYPOGRAPHY.title3, color: COLORS.black, marginBottom: SPACING.md },
  footerLoader: { marginVertical: SPACING.xl },
});
