import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon, EmptyState } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import { SupportBadge } from '../components/SupportBadge';
import { SupportScreen } from '../components/SupportScreen';
import { useSupportStore } from '../SupportStore';
import {
  formatSupportDate,
  getSupportBadgeLabel,
  normalizeSupportSearch,
} from '../supportValidation';

export function NoticeListScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { notices } = useSupportStore();
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSupportSearch(query);
  const filteredNotices = useMemo(
    () =>
      normalizedQuery
        ? notices.filter(({ title }) => normalizeSupportSearch(title).includes(normalizedQuery))
        : notices,
    [normalizedQuery, notices],
  );

  return (
    <SupportScreen loadingLabel="공지사항을 불러오고 있어요." title="공지사항">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppInput
          accessibilityLabel="공지 제목 검색"
          leftElement={<AppIcon color={COLORS.gray500} name="search-outline" size={20} />}
          onChangeText={setQuery}
          placeholder="공지 제목을 검색해보세요"
          rightElement={
            query ? (
              <Pressable
                accessibilityLabel="검색어 지우기"
                accessibilityRole="button"
                hitSlop={SPACING.xl}
                onPress={() => setQuery('')}
              >
                <AppIcon color={COLORS.gray500} name="close-circle" size={20} />
              </Pressable>
            ) : null
          }
          value={query}
        />

        {filteredNotices.length ? (
          <View accessibilityRole="list" style={styles.list}>
            {filteredNotices.map((notice) => {
              const date = formatSupportDate(notice.createdAt);
              const status = [
                notice.important ? getSupportBadgeLabel('important') : '',
                notice.isNew ? getSupportBadgeLabel('new') : '',
              ].filter(Boolean).join(', ');

              return (
                <Pressable
                  accessibilityHint="공지사항 상세 내용을 엽니다."
                  accessibilityLabel={[status, notice.title, date].filter(Boolean).join(', ')}
                  accessibilityRole="button"
                  key={notice.id}
                  onPress={() =>
                    navigateOnce(() =>
                      router.push({
                        pathname: '/mypage/notices/[noticeId]',
                        params: { noticeId: notice.id },
                      }))
                  }
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <View style={styles.badges}>
                    {notice.important ? <SupportBadge kind="important" /> : null}
                    {notice.isNew ? <SupportBadge kind="new" /> : null}
                  </View>
                  <View style={styles.row}>
                    <View style={styles.textContent}>
                      <Text numberOfLines={2} style={styles.title}>
                        {notice.title}
                      </Text>
                      <Text style={styles.date}>{date}</Text>
                    </View>
                    <AppIcon
                      accessible={false}
                      color={COLORS.gray500}
                      name="chevron-forward"
                      size={20}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            description={normalizedQuery ? '다른 검색어로 다시 찾아보세요.' : undefined}
            title={normalizedQuery ? '검색 결과가 없어요.' : '등록된 공지사항이 없어요.'}
          />
        )}
      </ScrollView>
    </SupportScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.xxl,
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.xxl,
  },
  list: {
    gap: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
    padding: SPACING.xxl,
  },
  badges: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  textContent: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  date: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    marginTop: SPACING.sm,
  },
  pressed: {
    opacity: 0.7,
  },
});
