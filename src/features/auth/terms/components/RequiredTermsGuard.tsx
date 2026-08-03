import { usePreventRemove } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton, EmptyState, LoadingView } from '@/src/components/common';
import { AppScreen, FormScreen } from '@/src/components/layout';
import { COLORS, LAYOUT, SPACING, TYPOGRAPHY } from '@/src/constants';
import { SIGNUP_COMPLETION_PATHS } from '@/src/features/auth/session/AuthSessionGuard';
import { useAccountLifecycle } from '@/src/hooks/useAccountLifecycle';

import { useTerms } from '../TermsContext';
import type { TermDefinition, TermId } from '../types';
import { TermAgreementRow } from './TermAgreementRow';
import { TermDetailScreen } from '../screens/TermDetailScreen';

type RequiredTermsGuardProps = PropsWithChildren<{
  userId: string | null;
}>;

type RequiredTermsPromptProps = {
  loggingOut: boolean;
  logoutError?: string;
  onLogout: () => Promise<void>;
  terms: TermDefinition[];
};

function RequiredTermsPrompt({
  loggingOut,
  logoutError,
  onLogout,
  terms,
}: RequiredTermsPromptProps) {
  const { recordConsent } = useTerms();
  const [selectedTermIds, setSelectedTermIds] = useState<Set<TermId>>(new Set());
  const [detailTermId, setDetailTermId] = useState<TermId>();
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  usePreventRemove(true, () => undefined);

  if (detailTermId) {
    return (
      <TermDetailScreen
        fallbackRoute="/home"
        onBack={() => setDetailTermId(undefined)}
        termId={detailTermId}
      />
    );
  }

  const allSelected = terms.every(({ id }) => selectedTermIds.has(id));
  const busy = saving || loggingOut;

  const toggleTerm = (termId: TermId, selected: boolean) => {
    setSelectedTermIds((current) => {
      const next = new Set(current);
      if (selected) next.add(termId);
      else next.delete(termId);
      return next;
    });
  };

  const save = async () => {
    if (savingRef.current || !allSelected) return;

    savingRef.current = true;
    setSaving(true);
    setSaveError(undefined);

    try {
      for (const { id } of terms) {
        await recordConsent(id, true);
      }
    } catch {
      setSaveError('동의 내용을 저장하지 못했어요. 다시 시도해주세요.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <FormScreen
      contentContainerStyle={styles.content}
      footer={
        <View style={styles.footer}>
          {saveError || logoutError ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {saveError ?? logoutError}
            </Text>
          ) : null}
          <AppButton
            disabled={!allSelected || loggingOut}
            loading={saving}
            onPress={() => void save()}
            title="동의하고 계속하기"
          />
          <AppButton
            disabled={saving}
            loading={loggingOut}
            onPress={() => void onLogout()}
            title="로그아웃"
            variant="ghost"
          />
        </View>
      }
    >
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {'변경된 필수 약관을\n확인해주세요'}
        </Text>
        <Text style={styles.description}>
          서비스를 계속 이용하려면 변경된 내용에 동의해야 해요.
        </Text>
      </View>

      <View pointerEvents={busy ? 'none' : 'auto'} style={styles.termList}>
        {terms.map((term) => (
          <TermAgreementRow
            checked={selectedTermIds.has(term.id)}
            disabled={busy}
            key={term.id}
            onChange={(selected) => toggleTerm(term.id, selected)}
            onDetailPress={() => setDetailTermId(term.id)}
            term={term}
          />
        ))}
      </View>
    </FormScreen>
  );
}

export function RequiredTermsGuard({
  children,
  userId,
}: RequiredTermsGuardProps) {
  const pathname = usePathname();
  const { logOut } = useAccountLifecycle();
  const {
    error,
    reload,
    requiredReconsentTerms,
    status,
  } = useTerms();
  const [logoutError, setLogoutError] = useState<string>();
  const [loggingOut, setLoggingOut] = useState(false);
  const loggingOutRef = useRef(false);
  const isSignupCompletionPath = SIGNUP_COMPLETION_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const exit = async () => {
    if (loggingOutRef.current) return;

    loggingOutRef.current = true;
    setLoggingOut(true);
    setLogoutError(undefined);

    try {
      await logOut();
    } catch {
      setLogoutError('로그아웃하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      loggingOutRef.current = false;
      setLoggingOut(false);
    }
  };

  if (!userId || isSignupCompletionPath) return children;

  if (status === 'loading') {
    return (
      <AppScreen contentContainerStyle={styles.centered}>
        <LoadingView label="약관 동의 상태를 확인하고 있어요." />
      </AppScreen>
    );
  }

  if (status === 'error') {
    return (
      <AppScreen contentContainerStyle={styles.centered}>
        <EmptyState
          actionLabel="다시 불러오기"
          description={error ?? undefined}
          onActionPress={() => void reload()}
          title="약관을 확인하지 못했어요."
        />
        <View style={styles.loadErrorActions}>
          {logoutError ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {logoutError}
            </Text>
          ) : null}
          <AppButton
            fullWidth={false}
            loading={loggingOut}
            onPress={() => void exit()}
            size="medium"
            title="로그아웃"
            variant="ghost"
          />
        </View>
      </AppScreen>
    );
  }

  if (requiredReconsentTerms.length === 0) return children;

  return (
    <RequiredTermsPrompt
      key={userId}
      loggingOut={loggingOut}
      logoutError={logoutError}
      onLogout={exit}
      terms={requiredReconsentTerms}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
  content: {
    paddingBottom: SPACING.jumbo,
    paddingHorizontal: LAYOUT.authContentPaddingHorizontal,
    paddingTop: 72,
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
  termList: {
    gap: SPACING.xl,
    marginTop: 42,
  },
  footer: {
    gap: SPACING.md,
  },
  error: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    textAlign: 'center',
  },
  loadErrorActions: {
    alignItems: 'center',
    gap: SPACING.md,
  },
});
