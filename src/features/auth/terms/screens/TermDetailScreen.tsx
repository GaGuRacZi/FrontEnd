import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { EmptyState } from '@/src/components/common/EmptyState';
import { LoadingView } from '@/src/components/common/LoadingView';
import { FormScreen } from '@/src/components/layout/FormScreen';
import { COLORS, LAYOUT, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { TermsHeader } from '../components/TermsHeader';
import { useTerms } from '../TermsContext';
import {
  formatTermDecisionDate,
  getTermDateLabel,
  getTermLabel,
  isTermId,
  TERM_IDS,
  type TermId,
} from '../types';

type TermDetailScreenProps = {
  action?: 'acknowledge' | 'consent';
  fallbackRoute?: Href;
  headerTitle?: string;
  onBack?: () => void;
  onConsentComplete?: () => void;
  showMarketingConsent?: boolean;
  termId?: TermId;
};

export function TermDetailScreen({
  action: actionOverride,
  fallbackRoute = '/signup/terms',
  headerTitle = '약관 상세',
  onBack,
  onConsentComplete,
  showMarketingConsent = false,
  termId: termIdOverride,
}: TermDetailScreenProps = {}) {
  const router = useRouter();
  const {
    action: actionParam,
    termId: termIdParam,
  } = useLocalSearchParams<{ action?: string; termId?: string }>();
  const {
    error,
    getLatestConsentRecord,
    getTerm,
    hasCurrentConsent,
    recordConsent,
    reload,
    status,
  } = useTerms();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const resolvedTermId =
    termIdOverride ?? (termIdParam && isTermId(termIdParam) ? termIdParam : undefined);
  const action = actionOverride ?? actionParam;
  const term = resolvedTermId ? getTerm(resolvedTermId) : undefined;
  const marketingConsentRecord =
    showMarketingConsent && term?.id === TERM_IDS.marketing
      ? getLatestConsentRecord(TERM_IDS.marketing)
      : undefined;
  const marketingAgreedAt = marketingConsentRecord?.agreedAt
    ? formatTermDecisionDate(marketingConsentRecord.agreedAt)
    : '';
  const hasCurrentMarketingConsent =
    term?.id === TERM_IDS.marketing && hasCurrentConsent(TERM_IDS.marketing);
  const isLocationConsent = action === 'consent' && term?.id === TERM_IDS.location;
  const isCommunityPolicyAcknowledgement =
    action === 'acknowledge' && term?.id === TERM_IDS.communityPolicy;
  const communityPolicyAcknowledged =
    isCommunityPolicyAcknowledgement && hasCurrentConsent(TERM_IDS.communityPolicy);

  const close = () => {
    if (onConsentComplete) {
      onConsentComplete();
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(fallbackRoute);
  };

  const handleTermAction = async () => {
    if (!term || saving) return;

    if (communityPolicyAcknowledged) {
      close();
      return;
    }

    setSaving(true);
    setSaveError(undefined);

    try {
      await recordConsent(term.id, true);
      close();
    } catch {
      setSaveError(
        isCommunityPolicyAcknowledgement
          ? '확인 상태를 저장하지 못했어요. 다시 시도해주세요.'
          : '동의 내용을 저장하지 못했어요. 다시 시도해주세요.',
      );
      setSaving(false);
    }
  };

  return (
    <FormScreen
      contentContainerStyle={styles.content}
      footer={
        isLocationConsent || isCommunityPolicyAcknowledgement ? (
          <View style={styles.footer}>
            {saveError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {saveError}
              </Text>
            ) : null}
            <AppButton
              accessibilityLabel={
                isCommunityPolicyAcknowledgement
                  ? communityPolicyAcknowledged
                    ? '커뮤니티 운영정책 확인 완료'
                    : '커뮤니티 운영정책 확인하기'
                  : '위치 약관에 동의하고 위치 설정으로 돌아가기'
              }
              loading={saving}
              onPress={() => void handleTermAction()}
              title={
                isCommunityPolicyAcknowledgement
                  ? communityPolicyAcknowledged
                    ? '확인 완료'
                    : '운영정책 확인하기'
                  : '동의하고 계속하기'
              }
            />
          </View>
        ) : undefined
      }
      header={
        <TermsHeader
          disabled={saving}
          fallbackRoute={fallbackRoute}
          onBack={onBack}
          title={headerTitle}
        />
      }
    >
      {status === 'loading' ? <LoadingView label="약관을 불러오는 중이에요" /> : null}

      {status === 'error' ? (
        <EmptyState
          actionLabel="다시 불러오기"
          description={error ?? undefined}
          onActionPress={() => void reload()}
          title="약관을 불러오지 못했어요"
        />
      ) : null}

      {status === 'ready' && !term ? (
        <EmptyState title="약관을 찾을 수 없어요" />
      ) : null}

      {status === 'ready' && term ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {term.title}
          </Text>
          <Text style={styles.requirement}>{getTermLabel(term)}</Text>
          <Text style={styles.metadata}>{getTermDateLabel(term)}</Text>
          {showMarketingConsent && term.id === TERM_IDS.marketing ? (
            <View style={styles.consentCard}>
              <Text style={styles.consentTitle}>마케팅 정보 수신 동의</Text>
              <Text style={styles.consentStatus}>
                {hasCurrentMarketingConsent &&
                marketingConsentRecord?.agreed &&
                marketingAgreedAt
                  ? `동의 버전 ${marketingConsentRecord.termVersion} · 동의일 ${marketingAgreedAt}`
                  : marketingConsentRecord?.agreed && marketingAgreedAt
                    ? `이전 동의 버전 ${marketingConsentRecord.termVersion} · 동의일 ${marketingAgreedAt} · 현재 약관은 재동의가 필요해요.`
                    : '현재 동의하지 않았어요.'}
              </Text>
              <Text style={styles.consentGuide}>동의 변경은 알림 설정에서 할 수 있어요.</Text>
            </View>
          ) : null}
          <Text selectable style={styles.body}>
            {term.body}
          </Text>
        </>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 48,
    paddingHorizontal: LAYOUT.authContentPaddingHorizontal,
    paddingTop: SPACING.xxxl,
  },
  title: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
  },
  requirement: {
    ...TYPOGRAPHY.label,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    color: COLORS.primary,
    marginTop: SPACING.xxl,
    overflow: 'hidden',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  metadata: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    marginTop: SPACING.xl,
  },
  consentCard: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    gap: SPACING.xs,
    marginTop: SPACING.xxl,
    padding: SPACING.xl,
  },
  consentTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  consentStatus: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray800,
  },
  consentGuide: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
  },
  body: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray800,
    marginTop: SPACING.xxxl,
  },
  footer: {
    gap: SPACING.md,
  },
  error: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    textAlign: 'center',
  },
});
