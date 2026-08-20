import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import { SupportBadge } from '../components/SupportBadge';
import { SupportScreen } from '../components/SupportScreen';
import { useSupportStore } from '../SupportStore';
import { formatSupportDate, getInquiryTypeLabel } from '../supportValidation';

export function InquiryDetailScreen() {
  const params = useLocalSearchParams<{ inquiryId?: string | string[] }>();
  const inquiryId = Array.isArray(params.inquiryId) ? params.inquiryId[0] : params.inquiryId;
  const { getInquiry, loadInquiry } = useSupportStore();
  const inquiry = inquiryId ? getInquiry(inquiryId) : undefined;
  const [loading, setLoading] = useState(Boolean(inquiryId));
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadRequest, setReloadRequest] = useState(0);

  useEffect(() => {
    if (!inquiryId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadFailed(false);
    void loadInquiry(inquiryId)
      .then((loadedInquiry) => {
        if (active && !loadedInquiry) setLoadFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [inquiryId, loadInquiry, reloadRequest]);

  return (
    <SupportScreen
      fallbackRoute="/mypage/inquiries"
      loadingLabel="문의 내용을 불러오고 있어요."
      title="문의 상세"
    >
      {inquiry ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.questionCard}>
            <View style={styles.cardTop}>
              <Text style={styles.type}>{getInquiryTypeLabel(inquiry.type)}</Text>
              <SupportBadge kind={inquiry.status} />
            </View>
            <Text style={styles.date}>{formatSupportDate(inquiry.createdAt)}</Text>
            <View style={styles.divider} />
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              문의 내용
            </Text>
            <Text selectable style={styles.body}>
              {inquiry.body}
            </Text>
            {inquiry.images.length ? (
              <ScrollView
                contentContainerStyle={styles.images}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {inquiry.images.map((image, index) => (
                  <Image
                    accessibilityLabel={`문의 첨부 사진 ${index + 1}`}
                    key={image.assetId}
                    source={{ uri: image.localUri }}
                    style={styles.image}
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>

          {inquiry.status === 'answered' && inquiry.answer ? (
            <View style={styles.answerCard}>
              <View style={styles.answerHeading}>
                <View style={styles.answerIcon}>
                  <AppIcon color={COLORS.primary} name="paw" size={18} />
                </View>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  PAW 답변
                </Text>
              </View>
              <Text selectable style={styles.body}>
                {inquiry.answer}
              </Text>
            </View>
          ) : (
            <View style={styles.waitingCard}>
              <AppIcon color={COLORS.primary} name="time-outline" size={22} />
              <View style={styles.waitingText}>
                <Text style={styles.waitingTitle}>답변 대기 중이에요.</Text>
                <Text style={styles.waitingDescription}>
                  답변 상태는 이 화면에서 확인할 수 있어요.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      ) : loading ? (
        <LoadingView label="문의 내용을 불러오고 있어요." />
      ) : loadFailed ? (
        <View style={styles.empty}>
          <EmptyState
            actionLabel="다시 시도"
            description="네트워크 상태를 확인한 뒤 다시 불러와주세요."
            onActionPress={() => setReloadRequest((current) => current + 1)}
            title="문의 내용을 불러오지 못했어요."
          />
        </View>
      ) : (
        <View style={styles.empty}>
          <EmptyState
            description="목록으로 돌아가 최근 문의를 확인해주세요."
            title="문의 내역을 찾을 수 없어요."
          />
        </View>
      )}
    </SupportScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.xxl,
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.xxl,
  },
  questionCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xxxl,
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
  date: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    marginTop: SPACING.md,
  },
  divider: {
    backgroundColor: COLORS.borderSoft,
    height: 1,
    marginVertical: SPACING.xxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  body: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray800,
    marginTop: SPACING.xl,
  },
  images: {
    gap: SPACING.xl,
    paddingRight: SPACING.sm,
    paddingTop: SPACING.xxl,
  },
  image: {
    borderRadius: RADIUS.md,
    height: 104,
    width: 104,
  },
  answerCard: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    padding: SPACING.xxxl,
  },
  answerHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  answerIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.round,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  waitingCard: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    gap: SPACING.xl,
    padding: SPACING.xxl,
  },
  waitingText: {
    flex: 1,
  },
  waitingTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  waitingDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
});
