import { Link, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { EmptyState } from '@/src/components/common/EmptyState';
import { LoadingView } from '@/src/components/common/LoadingView';
import { AppCheckbox } from '@/src/components/form/AppCheckbox';
import { FormScreen } from '@/src/components/layout/FormScreen';
import { COLORS, LAYOUT, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { logoutRemoteSession } from '@/src/features/auth/services/kakaoAuthService';

import { useSignup } from '../../signup/SignupContext';
import { TermAgreementRow } from '../components/TermAgreementRow';
import { TermsHeader } from '../components/TermsHeader';
import { useTerms } from '../TermsContext';
import { TERM_IDS } from '../types';

export function TermsAgreementScreen() {
  const router = useRouter();
  const { clearSignupDraft, data, resumeSignupDraft } = useSignup();
  const { clearSession, pendingRemoteSignupUserId } = useAuthSession();
  const {
    allSignupTermsSelected,
    commitSignupConsents,
    error,
    hasRequiredSignupSelections,
    reload,
    requiredSignupTermsReady,
    setSignupSelection,
    signupSelections,
    signupTerms,
    status,
    toggleAllSignupTerms,
  } = useTerms();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string>();
  const hasSelectedSignupTerm = signupTerms.some(
    ({ id }) => signupSelections[id] === true,
  );

  const handleNext = async () => {
    if (savingRef.current || !hasRequiredSignupSelections) return;

    savingRef.current = true;
    setSaving(true);
    setSaveError(undefined);

    try {
      await commitSignupConsents();
      router.push('/signup');
    } catch {
      setSaveError('동의 내용을 저장하지 못했어요. 다시 시도해주세요.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleSignupBack = useCallback(async () => {
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setSaveError(undefined);

    try {
      if (pendingRemoteSignupUserId) {
        await logoutRemoteSession().catch(() => undefined);
      }
      await clearSignupDraft();
      if (pendingRemoteSignupUserId) {
        await clearSession(pendingRemoteSignupUserId);
      }
      router.replace(data.method === 'kakao' ? '/' : '/login');
    } catch {
      resumeSignupDraft();
      setSaveError('회원가입을 종료하지 못했어요. 다시 시도해주세요.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [clearSession, clearSignupDraft, data.method, pendingRemoteSignupUserId, resumeSignupDraft, router]);

  return (
    <FormScreen
      contentContainerStyle={styles.content}
      footer={
        status === 'ready' && signupTerms.length > 0 && requiredSignupTermsReady ? (
          <View style={styles.footer}>
            {saveError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {saveError}
              </Text>
            ) : null}
            <AppButton
              disabled={!hasRequiredSignupSelections}
              loading={saving}
              onPress={() => void handleNext()}
              title="동의하고 시작하기"
            />
          </View>
        ) : undefined
      }
      header={
        <TermsHeader
          disabled={saving}
          fallbackRoute={data.method === 'kakao' ? '/' : '/login'}
          onBack={handleSignupBack}
        />
      }
    >
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {'서비스 이용을 위해\n약관에 동의해주세요'}
        </Text>
        <Text style={styles.description}>
          {'필수 항목에 모두 동의하면 PAW 회원가입을\n시작할 수 있어요.'}
        </Text>
      </View>

      {status === 'loading' ? <LoadingView label="약관을 불러오는 중이에요" /> : null}

      {status === 'error' ? (
        <EmptyState
          actionLabel="다시 불러오기"
          description={error ?? undefined}
          onActionPress={() => void reload()}
          title="약관을 불러오지 못했어요"
        />
      ) : null}

      {status === 'ready' && (signupTerms.length === 0 || !requiredSignupTermsReady) ? (
        <EmptyState
          actionLabel="다시 불러오기"
          description="필수 약관을 다시 불러온 뒤 회원가입을 진행해주세요."
          onActionPress={() => void reload()}
          title="필수 약관을 불러오지 못했어요"
        />
      ) : null}

      {status === 'ready' && signupTerms.length > 0 && requiredSignupTermsReady ? (
        <View pointerEvents={saving ? 'none' : 'auto'} style={styles.agreementSection}>
          <View style={styles.allAgreement}>
            <AppCheckbox
              accessibilityLabel="모든 회원가입 약관에 동의"
              checked={allSignupTermsSelected}
              disabled={saving}
              fullWidth
              indeterminate={hasSelectedSignupTerm && !allSignupTermsSelected}
              label="전체 동의"
              labelPosition="left"
              labelStyle={styles.allAgreementLabel}
              onChange={toggleAllSignupTerms}
            />
          </View>

          <View style={styles.termList}>
            {signupTerms.map((term) => (
              <TermAgreementRow
                checked={signupSelections[term.id] === true}
                disabled={saving}
                key={term.id}
                onChange={(selected) => setSignupSelection(term.id, selected)}
                term={term}
              />
            ))}
          </View>

          <Text style={styles.marketingNotice}>
            마케팅과 위치 약관에 동의하지 않아도 회원가입할 수 있어요.
          </Text>
          <Link
            asChild
            href={{
              pathname: '/signup/terms/[termId]',
              params: { termId: TERM_IDS.privacy },
            }}
          >
            <Pressable
              accessibilityRole="link"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              style={({ pressed }) => [
                styles.policyLinkButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.policyLink}>개인정보 처리방침 보기</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: SPACING.jumbo,
    paddingHorizontal: LAYOUT.authContentPaddingHorizontal,
    paddingTop: 38,
  },
  heading: {
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.authTitle,
    color: COLORS.black,
    textAlign: 'center',
  },
  description: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    marginTop: SPACING.xxl,
    textAlign: 'center',
  },
  agreementSection: {
    marginTop: 42,
  },
  allAgreement: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray800,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
  },
  allAgreementLabel: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  termList: {
    gap: SPACING.xl,
    marginTop: SPACING.xxl,
  },
  marketingNotice: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    marginTop: SPACING.xxl,
    textAlign: 'center',
  },
  policyLink: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  policyLinkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
    minHeight: SIZE.touchTarget,
  },
  footer: {
    gap: SPACING.md,
  },
  error: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
});
