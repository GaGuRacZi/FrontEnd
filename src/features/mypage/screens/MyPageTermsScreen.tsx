import { Fragment } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { TermDetailScreen } from '@/src/features/auth/terms/screens/TermDetailScreen';
import { getTermDateLabel, getTermLabel, useTerms } from '@/src/features/auth/terms';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import { MyPageCard, MyPageDivider, MyPageHeader, MyPageRow } from '../components';

export function MyPageTermsScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { error, reload, status, terms } = useTerms();

  if (status === 'loading') {
    return (
      <MyPageHeader title="이용약관">
        <LoadingView label="약관을 불러오는 중이에요." />
      </MyPageHeader>
    );
  }

  if (status === 'error') {
    return (
      <MyPageHeader title="이용약관">
        <EmptyState
          actionLabel="다시 불러오기"
          description={error ?? undefined}
          onActionPress={() => void reload()}
          title="약관을 불러오지 못했어요."
        />
      </MyPageHeader>
    );
  }

  if (terms.length === 0) {
    return (
      <MyPageHeader title="이용약관">
        <EmptyState title="확인할 수 있는 약관이 없어요." />
      </MyPageHeader>
    );
  }

  return (
    <MyPageHeader title="이용약관">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.title}>
            약관과 정책을 확인해주세요
          </Text>
          <Text style={styles.description}>
            현재 적용 중인 약관의 버전과 시행일을 확인할 수 있어요.
          </Text>
        </View>

        <MyPageCard title="약관 및 정책">
          {terms.map((term, index) => (
            <Fragment key={term.id}>
              {index > 0 ? <MyPageDivider /> : null}
              <MyPageRow
                description={getTermDateLabel(term)}
                onPress={() =>
                  navigateOnce(() =>
                    router.push({ pathname: '/mypage/terms/[termId]', params: { termId: term.id } }),
                  )
                }
                rightElement={
                  <View style={styles.rowMeta}>
                    <Text style={styles.kind}>{getTermLabel(term)}</Text>
                    <AppIcon name="chevron-forward" size={20} />
                  </View>
                }
                title={term.title}
              />
            </Fragment>
          ))}
        </MyPageCard>
      </ScrollView>
    </MyPageHeader>
  );
}

export function MyPageTermDetailScreen() {
  return (
    <TermDetailScreen
      fallbackRoute="/mypage/terms"
      headerTitle="이용약관"
      showMarketingConsent
    />
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.xxl,
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.xl,
  },
  intro: {
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  description: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  rowMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  kind: {
    ...TYPOGRAPHY.small,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    color: COLORS.primary,
    overflow: 'hidden',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
});
