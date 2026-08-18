import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/common';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import { SupportBadge } from '../components/SupportBadge';
import { SupportScreen } from '../components/SupportScreen';
import { useSupportStore } from '../SupportStore';
import { formatSupportDate } from '../supportValidation';

export function NoticeDetailScreen() {
  const params = useLocalSearchParams<{ noticeId?: string | string[] }>();
  const noticeId = Array.isArray(params.noticeId) ? params.noticeId[0] : params.noticeId;
  const { getNotice } = useSupportStore();
  const notice = noticeId ? getNotice(noticeId) : undefined;

  return (
    <SupportScreen
      fallbackRoute="/mypage/notices"
      loadingLabel="공지사항을 불러오고 있어요."
      title="공지사항"
    >
      {notice ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.badges}>
              {notice.important ? <SupportBadge kind="important" /> : null}
              {notice.isNew ? <SupportBadge kind="new" /> : null}
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {notice.title}
            </Text>
            <Text style={styles.date}>{formatSupportDate(notice.createdAt)}</Text>
            <View style={styles.divider} />
            <Text selectable style={styles.body}>
              {notice.body}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <EmptyState
            description="목록으로 돌아가 다른 공지사항을 확인해주세요."
            title="공지사항을 찾을 수 없어요."
          />
        </View>
      )}
    </SupportScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xxxl,
  },
  badges: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
  },
  date: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    marginTop: SPACING.md,
  },
  divider: {
    backgroundColor: COLORS.borderSoft,
    height: 1,
    marginVertical: SPACING.xxxl,
  },
  body: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray800,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
});
