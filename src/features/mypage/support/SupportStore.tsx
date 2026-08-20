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

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';

import {
  clearQueuedSupportImageRemovals,
  clearDraftInquiryImages,
  flushQueuedSupportImageRemovals,
  persistDraftInquiryImage,
  queueSupportImageRemovals,
  removeDraftInquiryImage,
  removeUserInquiryImages,
} from './services/supportImageStorage';
import { supportRepository } from './services/supportRepository';
import {
  createEmptyInquiryDraft,
  getInquiryDraftError,
  getRetainedInquiryImageAssetKeys,
  MAX_INQUIRY_BODY_LENGTH,
  MAX_INQUIRY_IMAGES,
} from './supportValidation';
import type {
  Inquiry,
  InquiryDraft,
  InquiryImage,
  Notice,
  StoredSupportState,
  SupportStatus,
} from './types';

type MutationResult =
  | { ok: true }
  | { ok: false; reason: 'error' | 'limit' | 'not-ready' };

type SubmitResult =
  | { inquiryId: string; ok: true }
  | { ok: false; reason: 'error' | 'invalid' | 'not-ready' };

type SupportStoreValue = {
  addDraftImages: (sourceUris: string[]) => Promise<MutationResult>;
  clearScreenSession: () => Promise<void>;
  deleteUserSupportData: (userId?: string) => Promise<void>;
  draft: InquiryDraft;
  getInquiry: (inquiryId: string) => Inquiry | undefined;
  getNotice: (noticeId: string) => Notice | undefined;
  inquiries: Inquiry[];
  inquiriesLoadError: boolean;
  loadInquiry: (inquiryId: string) => Promise<Inquiry | null>;
  loadNotice: (noticeId: string) => Promise<Notice | null>;
  notices: Notice[];
  removeDraftImage: (assetId: string) => Promise<MutationResult>;
  reloadSupport: () => void;
  saveDraft: () => Promise<MutationResult>;
  searchNotices: (query: string) => Promise<Notice[]>;
  status: SupportStatus;
  submitInquiry: () => Promise<SubmitResult>;
  updateDraft: (patch: Partial<Pick<InquiryDraft, 'body' | 'type'>>) => void;
};

const SupportStoreContext = createContext<SupportStoreValue | null>(null);
const EMPTY_INQUIRIES: Inquiry[] = [];
const EMPTY_NOTICES: Notice[] = [];

export function SupportProvider({ children }: PropsWithChildren) {
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const [state, setState] = useState<StoredSupportState | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [status, setStatus] = useState<SupportStatus>('loading');
  const [loadRequest, setLoadRequest] = useState(0);
  const [inquiriesLoadError, setInquiriesLoadError] = useState(false);
  const activeUserRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);
  const stateRef = useRef<StoredSupportState | null>(null);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const sessionGeneration = loadGenerationRef.current;

  const enqueueMutation = useCallback(<T,>(operation: () => Promise<T>) => {
    const result = mutationQueueRef.current.then(operation, operation);
    mutationQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  const applyState = useCallback((nextState: StoredSupportState | null) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  useEffect(() => {
    if (!sessionReady) return;

    let active = true;
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    activeUserRef.current = currentUserId;
    applyState(null);
    setNotices([]);
    setInquiriesLoadError(false);

    if (!currentUserId) {
      setStatus('ready');
      return () => {
        active = false;
      };
    }

    const userId = currentUserId;
    setStatus('loading');

    void supportRepository.getNotices()
      .then((loadedNotices) => {
        if (
          !active ||
          activeUserRef.current !== userId ||
          loadGenerationRef.current !== generation
        ) return;
        setNotices(loadedNotices);
      })
      .catch(() => undefined);

    Promise.allSettled([supportRepository.loadState(userId), supportRepository.getInquiries(userId)])
      .then(([storedState, remoteInquiries]) => {
        if (
          !active ||
          activeUserRef.current !== userId ||
          loadGenerationRef.current !== generation
        ) return;
        const loadedState = storedState.status === 'fulfilled'
          ? storedState.value
          : { draft: createEmptyInquiryDraft(userId), inquiries: [] };
        const inquiries = remoteInquiries.status === 'fulfilled'
          ? remoteInquiries.value
          : loadedState.inquiries;
        setInquiriesLoadError(remoteInquiries.status === 'rejected');
        applyState({ ...loadedState, inquiries });
        setStatus('ready');
        void enqueueMutation(async () => {
          if (!loadedState.draft.images.length) {
            await clearDraftInquiryImages(userId).catch(() => undefined);
          }
          await flushQueuedSupportImageRemovals(
            userId,
            getRetainedInquiryImageAssetKeys({ ...loadedState, inquiries }),
          ).catch(() => undefined);
        });
      });

    return () => {
      active = false;
    };
  }, [applyState, currentUserId, enqueueMutation, loadRequest, sessionReady]);

  const applyDraftMutationState = useCallback(
    (
      userId: string,
      previousState: StoredSupportState,
      nextState: StoredSupportState,
    ) => {
      if (
        activeUserRef.current !== userId ||
        loadGenerationRef.current !== sessionGeneration
      ) return;
      const latest = stateRef.current;
      if (!latest) return;
      if (latest === previousState) {
        applyState(nextState);
        return;
      }
      applyState({
        ...nextState,
        draft: {
          ...nextState.draft,
          body: latest.draft.body,
          type: latest.draft.type,
          updatedAt: latest.draft.updatedAt,
        },
      });
    },
    [applyState, sessionGeneration],
  );

  const updateDraft = useCallback(
    (patch: Partial<Pick<InquiryDraft, 'body' | 'type'>>) => {
      const userId = currentUserId;
      const current = stateRef.current;
      if (
        !userId ||
        activeUserRef.current !== userId ||
        loadGenerationRef.current !== sessionGeneration ||
        !current
      ) return;

      const nextDraft: InquiryDraft = {
        ...current.draft,
        ...patch,
        body:
          patch.body === undefined
            ? current.draft.body
            : patch.body.slice(0, MAX_INQUIRY_BODY_LENGTH),
        updatedAt: new Date().toISOString(),
      };
      applyState({ ...current, draft: nextDraft });
    },
    [applyState, currentUserId, sessionGeneration],
  );

  const saveDraft = useCallback(
    () =>
      enqueueMutation(async (): Promise<MutationResult> => {
        const userId = currentUserId;
        const current = stateRef.current;
        if (
          !userId ||
          activeUserRef.current !== userId ||
          loadGenerationRef.current !== sessionGeneration ||
          !current
        ) {
          return { ok: false, reason: 'not-ready' };
        }

        try {
          await supportRepository.saveState(userId, current);
          return { ok: true };
        } catch {
          return { ok: false, reason: 'error' };
        }
      }),
    [currentUserId, enqueueMutation, sessionGeneration],
  );

  const addDraftImages = useCallback(
    (sourceUris: string[]) =>
      enqueueMutation(async (): Promise<MutationResult> => {
        const userId = currentUserId;
          const current = stateRef.current;
          if (
            !userId ||
            activeUserRef.current !== userId ||
            loadGenerationRef.current !== sessionGeneration ||
            !current
          ) {
            return { ok: false, reason: 'not-ready' };
          }
          const remaining = MAX_INQUIRY_IMAGES - current.draft.images.length;
          if (!sourceUris.length) return { ok: true };
          if (remaining <= 0 || sourceUris.length > remaining) {
            return { ok: false, reason: 'limit' };
          }

          const persistedImages: InquiryImage[] = [];
          try {
            for (const sourceUri of sourceUris) {
              persistedImages.push(await persistDraftInquiryImage(userId, sourceUri));
            }
            const latest = stateRef.current;
            if (
              !latest ||
              activeUserRef.current !== userId ||
              loadGenerationRef.current !== sessionGeneration
            ) throw new Error('inactive-user');
            const nextState = {
              ...latest,
              draft: {
                ...latest.draft,
                images: [...latest.draft.images, ...persistedImages],
                updatedAt: new Date().toISOString(),
              },
            };
            await supportRepository.saveState(userId, nextState);
            applyDraftMutationState(userId, latest, nextState);
            return { ok: true };
          } catch {
            try {
              await queueSupportImageRemovals(userId, persistedImages);
              await flushQueuedSupportImageRemovals(
                userId,
                getRetainedInquiryImageAssetKeys(stateRef.current ?? current),
              );
            } catch {
              await Promise.allSettled(
                persistedImages.map((image) => removeDraftInquiryImage(userId, image)),
              );
            }
            return { ok: false, reason: 'error' };
          }
      }),
    [
      applyDraftMutationState,
      currentUserId,
      enqueueMutation,
      sessionGeneration,
    ],
  );

  const removeDraftImage = useCallback(
    (assetId: string) =>
      enqueueMutation(async (): Promise<MutationResult> => {
        const userId = currentUserId;
        const current = stateRef.current;
        if (
          !userId ||
          activeUserRef.current !== userId ||
          loadGenerationRef.current !== sessionGeneration ||
          !current
        ) {
          return { ok: false, reason: 'not-ready' };
        }
        const image = current.draft.images.find((item) => item.assetId === assetId);
        if (!image) return { ok: true };

        const nextState = {
          ...current,
          draft: {
            ...current.draft,
            images: current.draft.images.filter((item) => item.assetId !== assetId),
            updatedAt: new Date().toISOString(),
          },
        };
        try {
          await queueSupportImageRemovals(userId, [image]);
          if (loadGenerationRef.current !== sessionGeneration) {
            throw new Error('inactive-support-session');
          }
          await supportRepository.saveState(userId, nextState);
          applyDraftMutationState(userId, current, nextState);
          await flushQueuedSupportImageRemovals(
            userId,
            getRetainedInquiryImageAssetKeys(nextState),
          ).catch(() => undefined);
          return { ok: true };
        } catch {
          await flushQueuedSupportImageRemovals(
            userId,
            getRetainedInquiryImageAssetKeys(current),
          ).catch(() => undefined);
          return { ok: false, reason: 'error' };
        }
      }),
    [
      applyDraftMutationState,
      currentUserId,
      enqueueMutation,
      sessionGeneration,
    ],
  );

  const submitInquiry = useCallback(
    () =>
      enqueueMutation(async (): Promise<SubmitResult> => {
        const userId = currentUserId;
        const current = stateRef.current;
        if (
          !userId ||
          activeUserRef.current !== userId ||
          loadGenerationRef.current !== sessionGeneration ||
          !current
        ) {
          return { ok: false, reason: 'not-ready' };
        }
        if (getInquiryDraftError(current.draft)) {
          return { ok: false, reason: 'invalid' };
        }

        try {
          const inquiry = await supportRepository.submitInquiry(current.draft, userId);
          if (loadGenerationRef.current !== sessionGeneration) {
            throw new Error('inactive-support-session');
          }
          const nextState = {
            draft: createEmptyInquiryDraft(userId),
            inquiries: [
              inquiry,
              ...current.inquiries.filter(({ id }) => id !== inquiry.id),
            ],
          };
          if (
            activeUserRef.current === userId &&
            loadGenerationRef.current === sessionGeneration
          ) applyState(nextState);
          await Promise.all([
            supportRepository.saveState(userId, nextState),
            queueSupportImageRemovals(userId, current.draft.images),
          ]).catch(() => undefined);
          void clearDraftInquiryImages(userId).catch(() => undefined);
          void flushQueuedSupportImageRemovals(
            userId,
            getRetainedInquiryImageAssetKeys(nextState),
          ).catch(() => undefined);
          return { inquiryId: inquiry.id, ok: true };
        } catch {
          await flushQueuedSupportImageRemovals(
            userId,
            getRetainedInquiryImageAssetKeys(current),
          ).catch(() => undefined);
          return { ok: false, reason: 'error' };
        }
      }),
    [applyState, currentUserId, enqueueMutation, sessionGeneration],
  );

  const clearScreenSession = useCallback(
    () => {
      if (currentUserId) loadGenerationRef.current += 1;
      const invalidatedGeneration = loadGenerationRef.current;
      return enqueueMutation(async () => {
        const userId = currentUserId;
        if (!userId) return;
        const current = stateRef.current ?? await supportRepository.loadState(userId);
        const nextState = {
          ...current,
          draft: createEmptyInquiryDraft(userId),
        };
        await queueSupportImageRemovals(userId, current.draft.images);
        await supportRepository.saveState(userId, nextState);
        await clearDraftInquiryImages(userId).catch(() => undefined);
        await flushQueuedSupportImageRemovals(
          userId,
          getRetainedInquiryImageAssetKeys(nextState),
        ).catch(() => undefined);
        if (activeUserRef.current === userId) {
          applyState(nextState);
        }
      }).catch((sessionError: unknown) => {
        if (
          currentUserId &&
          activeUserRef.current === currentUserId &&
          loadGenerationRef.current === invalidatedGeneration
        ) setLoadRequest((current) => current + 1);
        throw sessionError;
      });
    },
    [applyState, currentUserId, enqueueMutation],
  );

  const reloadSupport = useCallback(() => {
    setLoadRequest((current) => current + 1);
  }, []);

  const deleteUserSupportData = useCallback(
    (userId = currentUserId ?? undefined) => {
      const invalidatesActiveSession = Boolean(userId && userId === currentUserId);
      if (invalidatesActiveSession) loadGenerationRef.current += 1;
      const invalidatedGeneration = loadGenerationRef.current;
      return enqueueMutation(async () => {
        if (!userId) return;
        const current =
          activeUserRef.current === userId && stateRef.current
            ? stateRef.current
            : await supportRepository.loadState(userId);
        const images = [
          ...current.draft.images,
          ...current.inquiries.flatMap(({ images: inquiryImages }) => inquiryImages),
        ];
        await queueSupportImageRemovals(userId, images);
        await supportRepository.deleteUser(userId);
        try {
          await removeUserInquiryImages(userId);
          await clearQueuedSupportImageRemovals(userId);
        } catch (deleteError) {
          await flushQueuedSupportImageRemovals(userId, new Set()).catch(() => undefined);
          throw deleteError;
        }
        if (activeUserRef.current === userId) applyState(null);
      }).catch((deleteError: unknown) => {
        if (
          invalidatesActiveSession &&
          userId &&
          activeUserRef.current === userId &&
          loadGenerationRef.current === invalidatedGeneration
        ) setLoadRequest((current) => current + 1);
        throw deleteError;
      });
    },
    [applyState, currentUserId, enqueueMutation],
  );

  const visibleState = currentUserId && activeUserRef.current === currentUserId ? state : null;
  const draft = visibleState?.draft ?? createEmptyInquiryDraft(currentUserId ?? '');

  const getNotice = useCallback(
    (noticeId: string) => (currentUserId ? notices.find(({ id }) => id === noticeId) : undefined),
    [currentUserId, notices],
  );
  const getInquiry = useCallback(
    (inquiryId: string) => visibleState?.inquiries.find(({ id }) => id === inquiryId),
    [visibleState?.inquiries],
  );

  const loadInquiry = useCallback(
    (inquiryId: string) =>
      enqueueMutation(async () => {
        const userId = currentUserId;
        if (!userId || activeUserRef.current !== userId) return null;
        const inquiry = await supportRepository.getInquiry(inquiryId, userId);
        const current = stateRef.current;
        if (!current || activeUserRef.current !== userId) return null;
        applyState({
          ...current,
          inquiries: [
            inquiry,
            ...current.inquiries.filter(({ id }) => id !== inquiry.id),
          ],
        });
        return inquiry;
      }).catch(() => null),
    [applyState, currentUserId, enqueueMutation],
  );

  const loadNotice = useCallback(
    (noticeId: string) =>
      enqueueMutation(async () => {
        const notice = await supportRepository.getNotice(noticeId);
        setNotices((current) => {
          const previous = current.find(({ id }) => id === notice.id);
          return [
            { ...notice, isNew: previous?.isNew ?? notice.isNew },
            ...current.filter(({ id }) => id !== notice.id),
          ];
        });
        return notice;
      }).catch(() => null),
    [enqueueMutation],
  );

  const searchNotices = useCallback(
    (query: string) => supportRepository.getNotices(query),
    [],
  );

  const value = useMemo<SupportStoreValue>(
    () => ({
      addDraftImages,
      clearScreenSession,
      deleteUserSupportData,
      draft,
      getInquiry,
      getNotice,
      inquiries: visibleState?.inquiries ?? EMPTY_INQUIRIES,
      inquiriesLoadError,
      loadInquiry,
      loadNotice,
      notices: currentUserId ? notices : EMPTY_NOTICES,
      removeDraftImage,
      reloadSupport,
      saveDraft,
      searchNotices,
      status,
      submitInquiry,
      updateDraft,
    }),
    [
      addDraftImages,
      clearScreenSession,
      currentUserId,
      deleteUserSupportData,
      draft,
      getInquiry,
      getNotice,
      inquiriesLoadError,
      loadInquiry,
      loadNotice,
      notices,
      removeDraftImage,
      reloadSupport,
      saveDraft,
      searchNotices,
      status,
      submitInquiry,
      updateDraft,
      visibleState?.inquiries,
    ],
  );

  return <SupportStoreContext.Provider value={value}>{children}</SupportStoreContext.Provider>;
}

export function useSupportStore() {
  const context = useContext(SupportStoreContext);
  if (!context) throw new Error('useSupportStore must be used inside SupportProvider.');
  return context;
}
