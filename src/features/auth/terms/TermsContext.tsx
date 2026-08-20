import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { ConsentStore } from './ConsentStore';
import { consentStore as defaultConsentStore } from './ConsentStore';
import {
  getRemoteMyPageTerms,
  termsRepository as defaultTermsRepository,
  type RemoteMyPageTerm,
  type TermsRepository,
} from './TermsRepository';
import {
  changeMarketingConsent,
  getLatestConsent,
  hasCurrentRequiredSignupConsents,
  hasCurrentTermConsent,
  recordTermDecision,
} from './termsCommands';
import type { ConsentRecord, TermDefinition, TermId } from './types';
import { REQUIRED_SIGNUP_TERM_IDS, TERM_IDS } from './types';
const EMPTY_CONSENT_HISTORY: ConsentRecord[] = [];
const EMPTY_SIGNUP_SELECTIONS: Partial<Record<TermId, boolean>> = {};

type TermsStatus = 'error' | 'loading' | 'ready';

type TermsContextValue = {
  allSignupTermsSelected: boolean;
  commitSignupConsents: () => Promise<void>;
  deleteConsentHistory: () => Promise<void>;
  error: string | null;
  getLatestConsentRecord: (termId: TermId) => ConsentRecord | undefined;
  getTerm: (termId: TermId) => TermDefinition | undefined;
  loadTerm: (termId: TermId) => Promise<TermDefinition | null>;
  hasCurrentConsent: (termId: TermId) => boolean;
  hasRequiredSignupConsents: boolean;
  hasRequiredSignupSelections: boolean;
  finalizeSignupConsents: (userId: string) => Promise<void>;
  marketingConsent: boolean;
  recordConsent: (termId: TermId, agreed: boolean) => Promise<void>;
  reload: () => Promise<void>;
  requiredReconsentTerms: TermDefinition[];
  requiredSignupTermsReady: boolean;
  setSignupSelection: (termId: TermId, selected: boolean) => void;
  signupIdentityFinalized: boolean;
  signupSelections: Partial<Record<TermId, boolean>>;
  signupTerms: TermDefinition[];
  status: TermsStatus;
  terms: TermDefinition[];
  toggleAllSignupTerms: (selected: boolean) => void;
  updateMarketingConsent: (agreed: boolean) => Promise<void>;
};

const TermsContext = createContext<TermsContextValue | null>(null);

type TermsProviderProps = PropsWithChildren<{
  consentStore?: ConsentStore;
  repository?: TermsRepository;
  scope: 'session' | 'signup';
  userId: string | null;
}>;

export function TermsProvider({
  children,
  consentStore = defaultConsentStore,
  repository = defaultTermsRepository,
  scope,
  userId,
}: TermsProviderProps) {
  const requestId = useRef(0);
  const skipNextLoadUserId = useRef<string | null>(null);
  const [linkedIdentity, setLinkedIdentity] = useState<{
    sourceUserId: string;
    targetUserId: string;
  } | null>(null);
  const targetUserId =
    linkedIdentity?.sourceUserId === userId ? linkedIdentity.targetUserId : userId;
  const targetUserIdRef = useRef(targetUserId);
  const [terms, setTerms] = useState<TermDefinition[]>([]);
  const [consentHistory, setConsentHistory] = useState<ConsentRecord[]>([]);
  const [remoteTerms, setRemoteTerms] = useState<RemoteMyPageTerm[]>([]);
  const [signupSelections, setSignupSelections] = useState<
    Partial<Record<TermId, boolean>>
  >({});
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<TermsStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    targetUserIdRef.current = targetUserId;
  }, [targetUserId]);

  const load = useCallback(async () => {
    const requestedUserId = targetUserId;

    if (requestedUserId && skipNextLoadUserId.current === requestedUserId) {
      skipNextLoadUserId.current = null;
      return;
    }

    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    setLoadedUserId(null);
    setTerms([]);
    setConsentHistory([]);
    setRemoteTerms([]);
    setSignupSelections({});
    setStatus('loading');
    setError(null);

    if (!requestedUserId) return;

    try {
      const [loadedTerms, loadedHistory, loadedRemoteTerms] = await Promise.all([
        repository.getTerms(),
        consentStore.getHistory(requestedUserId),
        scope === 'session' ? getRemoteMyPageTerms() : Promise.resolve([]),
      ]);

      if (requestId.current !== currentRequestId) return;

      setTerms(loadedTerms);
      setConsentHistory(loadedHistory);
      setRemoteTerms(loadedRemoteTerms);
      setSignupSelections(
        Object.fromEntries(
          loadedTerms
            .filter(({ scope }) => scope === 'signup')
            .map((term) => [term.id, hasCurrentTermConsent(loadedHistory, term)]),
        ),
      );
      setLoadedUserId(requestedUserId);
      setStatus('ready');

      if (scope === 'signup' && requestedUserId === userId) {
        void consentStore.deleteExpiredSignupHistories(requestedUserId).catch(() => undefined);
      }
    } catch {
      if (requestId.current !== currentRequestId) return;

      setConsentHistory([]);
      setRemoteTerms([]);
      setSignupSelections({});
      setLoadedUserId(requestedUserId);
      setError('약관을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
      setStatus('error');
    }
  }, [consentStore, repository, scope, targetUserId, userId]);

  useEffect(() => {
    void load();

    return () => {
      requestId.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (scope !== 'signup' || !userId) return undefined;

    const signupUserId = userId;
    return () => {
      void consentStore.deleteHistory(signupUserId).catch(() => undefined);
    };
  }, [consentStore, scope, userId]);

  const identityLoaded = Boolean(targetUserId) && loadedUserId === targetUserId;
  const currentConsentHistory = identityLoaded ? consentHistory : EMPTY_CONSENT_HISTORY;
  const currentSignupSelections = identityLoaded
    ? signupSelections
    : EMPTY_SIGNUP_SELECTIONS;
  const currentStatus: TermsStatus = identityLoaded ? status : 'loading';
  const currentError = identityLoaded ? error : null;
  const signupIdentityFinalized = scope === 'signup' && linkedIdentity !== null;

  const signupTerms = useMemo(
    () => terms.filter(({ scope }) => scope === 'signup'),
    [terms],
  );
  const requiredSignupTerms = useMemo(
    () => signupTerms.filter(({ required }) => required),
    [signupTerms],
  );
  const requiredSignupTermsReady =
    currentStatus === 'ready' &&
    REQUIRED_SIGNUP_TERM_IDS.every((termId) =>
      requiredSignupTerms.some(({ id }) => id === termId),
    );

  const getTerm = useCallback(
    (termId: TermId) => terms.find(({ id }) => id === termId),
    [terms],
  );

  const loadTerm = useCallback(
    async (termId: TermId) => {
      const term = await repository.getTerm(termId);
      if (!term) return null;

      setTerms((current) => current.map((item) => (item.id === term.id ? term : item)));
      return term;
    },
    [repository],
  );

  const getLatestConsentRecord = useCallback(
    (termId: TermId) => getLatestConsent(currentConsentHistory, termId),
    [currentConsentHistory],
  );

  const hasCurrentConsent = useCallback(
    (termId: TermId) => {
      const term = terms.find(({ id }) => id === termId);
      if (!term) return false;

      const remoteTerm = remoteTerms.find(({ id }) => id === termId);
      return remoteTerm
        ? remoteTerm.agreed && remoteTerm.version === term.version
        : hasCurrentTermConsent(currentConsentHistory, term);
    },
    [currentConsentHistory, remoteTerms, terms],
  );

  const setSignupSelection = useCallback((termId: TermId, selected: boolean) => {
    setSignupSelections((current) => ({ ...current, [termId]: selected }));
  }, []);

  const toggleAllSignupTerms = useCallback(
    (selected: boolean) => {
      setSignupSelections((current) => {
        const next = { ...current };
        signupTerms.forEach(({ id }) => {
          next[id] = selected;
        });
        return next;
      });
    },
    [signupTerms],
  );

  const allSignupTermsSelected =
    signupTerms.length > 0 &&
    signupTerms.every(({ id }) => currentSignupSelections[id] === true);
  const hasRequiredSignupSelections =
    requiredSignupTermsReady &&
    requiredSignupTerms.every(({ id }) => currentSignupSelections[id] === true);
  const hasRequiredSignupConsents =
    requiredSignupTermsReady &&
    hasCurrentRequiredSignupConsents(currentConsentHistory, signupTerms);
  const requiredReconsentTerms = useMemo(
    () =>
      terms.filter(
        (term) =>
          term.required &&
          term.scope === 'signup' &&
          !hasCurrentConsent(term.id),
      ),
    [hasCurrentConsent, terms],
  );
  const marketingConsent = hasCurrentConsent(TERM_IDS.marketing);
  const deleteConsentHistory = useCallback(async () => {
    if (scope !== 'session') {
      throw new Error('로그인한 계정의 동의 이력만 삭제할 수 있습니다.');
    }

    if (!targetUserId) return;

    const operationUserId = targetUserId;
    await consentStore.deleteHistory(operationUserId);

    if (targetUserIdRef.current !== operationUserId) return;

    setConsentHistory([]);
    setSignupSelections({});
  }, [consentStore, scope, targetUserId]);

  const mergeDecisionRecords = useCallback(
    (
      results: Awaited<ReturnType<typeof recordTermDecision>>[],
      expectedUserId: string,
    ) => {
      const decisionRecords = results.filter(
        ({ userId: recordUserId }) => recordUserId === expectedUserId,
      );

      if (decisionRecords.length === 0 || targetUserIdRef.current !== expectedUserId) return;

      setConsentHistory((current) => {
        if (targetUserIdRef.current !== expectedUserId) return current;

        const currentIds = new Set(current.map(({ id }) => id));
        const missingRecords = decisionRecords.filter(({ id }) => !currentIds.has(id));
        return missingRecords.length > 0 ? [...current, ...missingRecords] : current;
      });
    },
    [],
  );

  const commitSignupConsents = useCallback(async () => {
    if (scope !== 'signup') {
      throw new Error('회원가입 약관 범위에서만 가입 동의를 저장할 수 있습니다.');
    }

    if (currentStatus !== 'ready' || !targetUserId) {
      throw new Error('약관을 불러온 뒤 다시 시도해주세요.');
    }

    const operationUserId = targetUserId;

    const missingRequired = signupTerms.some(
      ({ id, required }) => required && currentSignupSelections[id] !== true,
    );

    if (!requiredSignupTermsReady || missingRequired) {
      throw new Error('필수 약관에 모두 동의해주세요.');
    }

    const occurredAt = new Date().toISOString();
    const settledResults = await Promise.allSettled(
      signupTerms.map((term) =>
        recordTermDecision({
          agreed: currentSignupSelections[term.id] === true,
          consentStore,
          occurredAt,
          term,
          userId: operationUserId,
        }),
      ),
    );
    const results = settledResults.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );

    mergeDecisionRecords(results, operationUserId);

    const failedResult = settledResults.find((result) => result.status === 'rejected');
    if (failedResult?.status === 'rejected') throw failedResult.reason;
  }, [
    consentStore,
    currentSignupSelections,
    currentStatus,
    mergeDecisionRecords,
    requiredSignupTermsReady,
    scope,
    signupTerms,
    targetUserId,
  ]);

  const recordConsent = useCallback(
    async (termId: TermId, agreed: boolean) => {
      if (currentStatus !== 'ready' || !targetUserId) {
        throw new Error('약관을 불러온 뒤 다시 시도해주세요.');
      }

      const operationUserId = targetUserId;

      const term = terms.find(({ id }) => id === termId);

      if (!term) {
        throw new Error('약관을 찾을 수 없습니다.');
      }

      const result = await recordTermDecision({
        agreed,
        consentStore,
        term,
        userId: operationUserId,
      });

      mergeDecisionRecords([result], operationUserId);

      if (scope === 'signup' && term.scope === 'signup') {
        setSignupSelections((current) => ({ ...current, [term.id]: agreed }));
      }
    },
    [
      consentStore,
      currentStatus,
      mergeDecisionRecords,
      scope,
      targetUserId,
      terms,
    ],
  );

  const updateMarketingConsent = useCallback(
    async (agreed: boolean) => {
      if (currentStatus !== 'ready' || !targetUserId) {
        throw new Error('약관을 불러온 뒤 다시 시도해주세요.');
      }

      const operationUserId = targetUserId;
      const result = await changeMarketingConsent({
        agreed,
        consentStore,
        repository,
        userId: operationUserId,
      });

      mergeDecisionRecords([result], operationUserId);
    },
    [
      consentStore,
      currentStatus,
      mergeDecisionRecords,
      repository,
      targetUserId,
    ],
  );

  const finalizeSignupConsents = useCallback(
    async (completedUserId: string) => {
      if (scope !== 'signup') {
        throw new Error('회원가입 약관 범위에서만 동의를 연결할 수 있습니다.');
      }

      if (currentStatus !== 'ready' || !targetUserId || !userId) {
        throw new Error('약관을 불러온 뒤 다시 시도해주세요.');
      }

      const normalizedTargetUserId = completedUserId.trim();
      const linkedHistory = await consentStore.transferSignupHistoryToUser(
        targetUserId,
        normalizedTargetUserId,
      );

      if (targetUserId !== normalizedTargetUserId) {
        skipNextLoadUserId.current = normalizedTargetUserId;
      }

      setLinkedIdentity({ sourceUserId: userId, targetUserId: normalizedTargetUserId });
      setConsentHistory(linkedHistory);
      setSignupSelections(
        Object.fromEntries(
          terms
            .filter(({ scope: termScope }) => termScope === 'signup')
            .map((term) => [term.id, hasCurrentTermConsent(linkedHistory, term)]),
        ),
      );
      setLoadedUserId(normalizedTargetUserId);
      setError(null);
      setStatus('ready');
    },
    [consentStore, currentStatus, scope, targetUserId, terms, userId],
  );

  const value = useMemo<TermsContextValue>(
    () => ({
      allSignupTermsSelected,
      commitSignupConsents,
      deleteConsentHistory,
      error: currentError,
      finalizeSignupConsents,
      getLatestConsentRecord,
      getTerm,
      loadTerm,
      hasCurrentConsent,
      hasRequiredSignupConsents,
      hasRequiredSignupSelections,
      marketingConsent,
      recordConsent,
      reload: load,
      requiredReconsentTerms,
      requiredSignupTermsReady,
      setSignupSelection,
      signupIdentityFinalized,
      signupSelections: currentSignupSelections,
      signupTerms,
      status: currentStatus,
      terms,
      toggleAllSignupTerms,
      updateMarketingConsent,
    }),
    [
      allSignupTermsSelected,
      commitSignupConsents,
      currentError,
      currentSignupSelections,
      currentStatus,
      deleteConsentHistory,
      finalizeSignupConsents,
      getLatestConsentRecord,
      getTerm,
      loadTerm,
      hasCurrentConsent,
      hasRequiredSignupConsents,
      hasRequiredSignupSelections,
      load,
      marketingConsent,
      recordConsent,
      requiredReconsentTerms,
      requiredSignupTermsReady,
      setSignupSelection,
      signupIdentityFinalized,
      signupTerms,
      terms,
      toggleAllSignupTerms,
      updateMarketingConsent,
    ],
  );

  return <TermsContext.Provider value={value}>{children}</TermsContext.Provider>;
}

export function useTerms() {
  const context = useContext(TermsContext);

  if (!context) {
    throw new Error('useTerms must be used inside TermsProvider.');
  }

  return context;
}
