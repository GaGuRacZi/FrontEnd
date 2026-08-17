import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppIcon, EmptyState } from '@/src/components/common';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import { SupportBadge } from '../components/SupportBadge';
import { SupportScreen } from '../components/SupportScreen';
import { useSupportStore } from '../SupportStore';
import {
  formatSupportDate,
  getInquiryTypeLabel,
  getSupportBadgeLabel,
} from '../supportValidation';

export function InquiryListScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { inquiries } = useSupportStore();

  return (
    <SupportScreen loadingLabel="문의 내역을 불러오고 있어요." title="문의하기">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <AppIcon color={COLORS.primary} name="help-circle-outline" size={26} />
          </View>
          <View style={styles.introText}>
            <Text accessibilityRole="header" style={styles.introTitle}>
              무엇을 도와드릴까요?
            </Text>
            <Text style={styles.introDescription}>
              작성한 문의와 답변 상태를 이 기기에서 확인할 수 있어요.
            </Text>
          </View>
          <AppButton
            fullWidth={false}
            onPress={() => navigateOnce(() => router.push('/mypage/inquiries/write'))}
            size="medium"
            style={styles.writeButton}
            title="문의 작성"
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            최근 문의
          </Text>
          <Text style={styles.count}>{inquiries.length}</Text>
        </View>

        {inquiries.length ? (
          <View accessibilityRole="list" style={styles.list}>
            {inquiries.map((inquiry) => {
              const date = formatSupportDate(inquiry.createdAt);
              const normalizedBody = inquiry.body.trim().replace(/\s+/g, ' ');
              const bodyPreview = `${normalizedBody.slice(0, 80)}${normalizedBody.length > 80 ? '…' : ''}`;

              return (
                <Pressable
                  accessibilityHint="문의와 답변 상세를 엽니다."
                  accessibilityLabel={[
                    getInquiryTypeLabel(inquiry.type),
                    getSupportBadgeLabel(inquiry.status),
                    bodyPreview,
                    date,
                  ].join(', ')}
                  accessibilityRole="button"
                  key={inquiry.id}
                  onPress={() =>
                    navigateOnce(() =>
                      router.push({
                        pathname: '/mypage/inquiries/[inquiryId]',
                        params: { inquiryId: inquiry.id },
                      }))
                  }
                  style={({ pressed }) => [styles.inquiryCard, pressed && styles.pressed]}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.type}>{getInquiryTypeLabel(inquiry.type)}</Text>
                    <SupportBadge kind={inquiry.status} />
                  </View>
                  <Text numberOfLines={2} style={styles.preview}>
                    {inquiry.body}
                  </Text>
                  <View style={styles.cardBottom}>
                    <Text style={styles.date}>{date}</Text>
                    <AppIcon
                      accessible={false}
                      color={COLORS.gray500}
                      name="chevron-forward"
                      size={19}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            description="궁금한 점이 생기면 문의를 남겨주세요."
            title="아직 문의 내역이 없어요."
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
  introCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    gap: SPACING.xl,
    padding: SPACING.xxl,
  },
  introIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.round,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  introText: {
    flex: 1,
  },
  introTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  introDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  writeButton: {
    paddingHorizontal: SPACING.xxl,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  count: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
  },
  list: {
    gap: SPACING.xl,
  },
  inquiryCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.xl,
    padding: SPACING.xxl,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  type: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
  },
  preview: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
  },
  cardBottom: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  date: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
  },
  pressed: {
    opacity: 0.7,
  },
});
