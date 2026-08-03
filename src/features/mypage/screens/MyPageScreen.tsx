import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingView } from '@/src/components/common';
import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';
import { formatCompactRegion } from '@/src/utils/location';

import { getPlan } from '../mypageData';
import { useMyPageStore } from '../MyPageStore';
import {
  ComingSoonModal,
  MyPageCard,
  MyPageDivider,
  MyPageHeader,
  MyPageRow,
  ProfileAvatar,
} from '../components';

export function MyPageScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { hasLoadError, isReady, profile, reloadMyPage, subscription } = useMyPageStore();
  const [comingSoonTitle, setComingSoonTitle] = useState<string | null>(null);
  const plan = subscription ? getPlan(subscription.currentPlanId) : null;

  if (!isReady) {
    return (
      <MyPageHeader variant="root">
        <LoadingView label="마이페이지를 불러오고 있어요." />
      </MyPageHeader>
    );
  }

  if (hasLoadError) {
    return (
      <MyPageHeader variant="root">
        <EmptyState
          actionLabel="다시 시도"
          description="잠시 후 다시 마이페이지를 열어주세요."
          icon={<AppIcon color={COLORS.primary} name="person-circle-outline" size={32} />}
          onActionPress={reloadMyPage}
          title="마이페이지를 불러오지 못했어요."
        />
      </MyPageHeader>
    );
  }

  if (!profile || !plan) {
    return (
      <MyPageHeader variant="root">
        <EmptyState
          description="다시 로그인한 뒤 마이페이지를 확인해주세요."
          icon={<AppIcon color={COLORS.primary} name="person-circle-outline" size={32} />}
          title="프로필을 불러오지 못했어요."
        />
      </MyPageHeader>
    );
  }

  return (
    <MyPageHeader variant="root">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => navigateOnce(() => router.push('/mypage/settings'))}
          style={({ pressed }) => [styles.ownerCard, pressed && styles.pressed]}
        >
          <ProfileAvatar size={72} uri={profile.profileImageUri} />
          <View style={styles.ownerText}>
            <Text numberOfLines={1} style={styles.ownerName}>
              {profile.nickname}
            </Text>
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.ownerMeta}>
              {formatCompactRegion(profile.location) || '지역 미설정'}
            </Text>
          </View>
          <AppIcon name="chevron-forward" size={22} />
        </Pressable>

        <View style={styles.subscriptionBanner}>
          <View style={styles.planStatus}>
            <View style={styles.planBadge}>
              <Image source={plan.icon} style={styles.planIcon} />
              <Text style={styles.planBadgeText}>{plan.name}</Text>
            </View>
            <Text style={styles.planStatusText}>이용 중</Text>
          </View>
          <Text style={styles.bannerDescription}>
            업그레이드 하고 AI 진료 요약과 녹음 무제한 기능을 이용해보세요
          </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={SPACING.sm}
            onPress={() => navigateOnce(() => router.push('/mypage/subscription'))}
            style={({ pressed }) => [styles.bannerButton, pressed && styles.pressed]}
          >
            <Text style={styles.bannerButtonText}>구독 살펴보기</Text>
          </Pressable>
        </View>

        <MyPageCard title="커뮤니티">
          <MyPageRow
            description="내가 남긴 커뮤니티 활동"
            iconName="create-outline"
            onPress={() => setComingSoonTitle('작성글 보기')}
            title="작성글 보기"
          />
          <MyPageDivider />
          <MyPageRow
            description="내가 찜한 커뮤니티 기록"
            iconName="heart-outline"
            onPress={() => setComingSoonTitle('찜 보기')}
            title="찜 보기"
          />
          <MyPageDivider />
          <MyPageRow
            description="내가 남긴 댓글 기록"
            iconName="chatbubble-ellipses-outline"
            onPress={() => setComingSoonTitle('댓글 보기')}
            title="댓글 보기"
          />
        </MyPageCard>

        <MyPageCard title="앱 설정">
          <MyPageRow
            description="할 일, 커뮤니티, AI 분석 알림 관리"
            iconName="notifications-outline"
            onPress={() => navigateOnce(() => router.push('/mypage/notifications'))}
            title="알림 설정"
          />
        </MyPageCard>

        <MyPageCard title="고객지원">
          <MyPageRow
            description="PAW 소식과 업데이트"
            iconName="megaphone-outline"
            onPress={() => setComingSoonTitle('공지사항')}
            title="공지사항"
          />
          <MyPageDivider />
          <MyPageRow
            description="서비스 이용 및 개인정보 약관"
            iconName="document-text-outline"
            onPress={() => setComingSoonTitle('이용약관')}
            title="이용약관"
          />
          <MyPageDivider />
          <MyPageRow
            description="궁금한 점을 PAW 팀에게"
            iconName="help-circle-outline"
            onPress={() => setComingSoonTitle('문의하기')}
            title="문의하기"
          />
        </MyPageCard>
      </ScrollView>

      <ComingSoonModal
        onClose={() => setComingSoonTitle(null)}
        title={comingSoonTitle ?? ''}
        visible={Boolean(comingSoonTitle)}
      />
    </MyPageHeader>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.xl,
    paddingBottom: SIZE.tabBarHeight + SPACING.xl,
    paddingTop: SPACING.xl,
  },
  ownerCard: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xxl,
    minHeight: 100,
    paddingHorizontal: 20,
  },
  ownerText: {
    flex: 1,
  },
  ownerName: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
  },
  ownerMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    marginTop: SPACING.xxs,
  },
  subscriptionBanner: {
    backgroundColor: COLORS.cream,
    borderRadius: 24,
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.xxl,
  },
  planStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  planBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    height: 34,
    paddingHorizontal: SPACING.lg,
  },
  planIcon: {
    height: 22,
    width: 22,
  },
  planBadgeText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.black,
  },
  planStatusText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  bannerDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  bannerButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    height: 34,
    justifyContent: 'center',
    width: 124,
  },
  bannerButtonText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.background,
  },
  pressed: {
    opacity: 0.65,
  },
});
