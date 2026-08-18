import AsyncStorage from '@react-native-async-storage/async-storage';

import { consentStore, getSignupConsentUserId } from '../../terms/ConsentStore';
import { removeUserProfileImages } from '../../../mypage/services/profileImageStorage';
import {
  createSignupDraft,
  isCurrentSignupDraft,
  parseStoredSignupDraft,
  type PersistedSignupData,
  type SignupDraftMethod,
} from './signupDraftContract';

const ACTIVE_SIGNUP_DRAFT_KEY = 'paw:signup-draft:active';
let mutationQueue: Promise<void> = Promise.resolve();

function enqueueMutation<T>(operation: () => Promise<T>) {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function clearDraftArtifacts(sessionId: string) {
  const temporaryUserId = getSignupConsentUserId(sessionId);
  const results = await Promise.allSettled([
    consentStore.deleteHistory(temporaryUserId),
    removeUserProfileImages(temporaryUserId),
  ]);
  if (results[0].status === 'rejected') throw results[0].reason;
}

export function loadActiveSignupDraft() {
  return enqueueMutation(async () => {
    const stored = await AsyncStorage.getItem(ACTIVE_SIGNUP_DRAFT_KEY);
    const draft = parseStoredSignupDraft(stored);

    if (!draft || !isCurrentSignupDraft(draft)) {
      const cleanupError = draft
        ? await clearDraftArtifacts(draft.sessionId).then(
            () => undefined,
            (error: unknown) => error,
          )
        : undefined;
      if (stored !== null) await AsyncStorage.removeItem(ACTIVE_SIGNUP_DRAFT_KEY);
      if (cleanupError) throw cleanupError;
      return null;
    }

    return draft;
  });
}

export function saveActiveSignupDraft(input: {
  data: PersistedSignupData;
  method: SignupDraftMethod;
  remoteUserId: string | null;
  sessionId: string;
}) {
  return enqueueMutation(async () => {
    const draft = createSignupDraft(input);
    const stored = await AsyncStorage.getItem(ACTIVE_SIGNUP_DRAFT_KEY);
    const activeDraft = parseStoredSignupDraft(stored);

    if (activeDraft && activeDraft.sessionId !== draft.sessionId) {
      await AsyncStorage.setItem(ACTIVE_SIGNUP_DRAFT_KEY, JSON.stringify(draft));
      await clearDraftArtifacts(activeDraft.sessionId).catch(() => undefined);
      return draft;
    }

    await AsyncStorage.setItem(ACTIVE_SIGNUP_DRAFT_KEY, JSON.stringify(draft));
    return draft;
  });
}

export function attachActiveSignupDraftRemoteUserId(sessionId: string, remoteUserId: string) {
  return enqueueMutation(async () => {
    const stored = await AsyncStorage.getItem(ACTIVE_SIGNUP_DRAFT_KEY);
    const draft = parseStoredSignupDraft(stored);

    if (
      !draft ||
      draft.sessionId !== sessionId ||
      draft.method !== 'local' ||
      draft.remoteUserId !== null
    ) {
      return false;
    }

    const nextDraft = createSignupDraft({
      ...draft,
      remoteUserId,
    });
    await AsyncStorage.setItem(ACTIVE_SIGNUP_DRAFT_KEY, JSON.stringify(nextDraft));
    return true;
  });
}

export function clearActiveSignupDraft(expectedSessionId?: string) {
  return enqueueMutation(async () => {
    const stored = await AsyncStorage.getItem(ACTIVE_SIGNUP_DRAFT_KEY);
    const draft = parseStoredSignupDraft(stored);

    if (expectedSessionId && draft && draft.sessionId !== expectedSessionId) {
      await clearDraftArtifacts(expectedSessionId);
      return false;
    }

    const sessionId = draft?.sessionId ?? expectedSessionId;
    if (sessionId) await clearDraftArtifacts(sessionId);
    await AsyncStorage.removeItem(ACTIVE_SIGNUP_DRAFT_KEY);
    return true;
  });
}
