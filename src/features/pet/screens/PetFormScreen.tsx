import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { type NavigationAction, useNavigation, usePreventRemove } from '@react-navigation/native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';

import { AppButton, EmptyState, LoadingView } from '@/src/components/common';
import { FormScreen, TopHeader } from '@/src/components/layout';
import { AppModal, useAppAlert } from '@/src/components/modal';
import { COLORS, LAYOUT, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';

import { PetBreedPickerModal } from '../components/PetBreedPickerModal';
import { PetFormFields } from '../components/PetFormFields';
import { usePetImagePicker } from '../hooks/usePetImagePicker';
import { createPetDraft, petDraftToEntity } from '../petMappers';
import {
  formatBirthDate,
  formatBirthDateValue,
  getLatestBirthDate,
  hasValidPetForm,
  parseBirthDate,
  validatePetForm,
  type PetFormErrors,
} from '../petValidation';
import { MAX_PETS_PER_USER, usePetStore } from '../PetStore';
import {
  collectRetainedPetImageUris,
  flushQueuedPetImageRemovals,
  type PetImageField,
  persistPetImage,
  releasePersistedPetImage,
  queuePetImageRemovals,
} from '../services/petImageStorage';
import { petRepository } from '../services/petRepository';
import type { PetDraft, PetEntity, PetFormValues } from '../types';

type PetFormScreenProps =
  | { mode: 'add'; petId?: never }
  | { mode: 'edit'; petId: string };

type PendingPetCompletion = {
  draftId: string;
  entity: PetEntity;
  fallbackDraft: PetDraft;
};

const PET_DRAFT_FIELDS: readonly (keyof PetDraft)[] = [
  'birthDate',
  'breed',
  'gender',
  'id',
  'name',
  'neutered',
  'petId',
  'profileImageUri',
  'sourceUpdatedAt',
  'type',
  'userId',
  'weight',
];

function isSameDraft(left: PetDraft | null, right: PetDraft | null) {
  if (!left || !right) return left === right;

  return PET_DRAFT_FIELDS.every((field) => {
    const leftValue = left[field];
    const rightValue = right[field];

    if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
      return (
        leftValue.length === rightValue.length &&
        leftValue.every((value, index) => value === rightValue[index])
      );
    }

    return leftValue === rightValue;
  });
}

function getInvalidFields(values: PetFormValues) {
  return new Set(
    Object.entries(validatePetForm(values)).flatMap(([field, error]) =>
      error ? [field as keyof PetFormErrors] : [],
    ),
  );
}

export function PetFormScreen({ mode, petId }: PetFormScreenProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const showAlert = useAppAlert();
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const {
    addPet,
    hasLoadError,
    isReady: petsReady,
    pets,
    reloadPets,
    updatePet,
  } = usePetStore();
  const pet = mode === 'edit' ? pets.find((item) => item.id === petId) : undefined;
  const [draft, setDraft] = useState<PetDraft | null>(null);
  const [baseDraft, setBaseDraft] = useState<PetDraft | null>(null);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Set<keyof PetFormErrors>>(() => new Set());
  const [breedVisible, setBreedVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [isImageMutating, setIsImageMutating] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [pendingBirthDate, setPendingBirthDate] = useState(getLatestBirthDate);
  const [pendingExitAction, setPendingExitAction] = useState<NavigationAction | null>(null);
  const [pendingCompletion, setPendingCompletion] = useState<PendingPetCompletion | null>(null);
  const allowNavigation = useRef(false);
  const submitLocked = useRef(false);
  const draftCompleted = useRef(false);
  const draftRef = useRef<PetDraft | null>(null);
  const baseDraftRef = useRef<PetDraft | null>(null);
  const isDirtyRef = useRef(false);
  const imageMutationLock = useRef(false);
  const leavingRef = useRef(false);
  const initializedFormKeyRef = useRef<string | null>(null);
  const skipFocusedDraftReload = useRef(true);
  const reachedPetLimit = mode === 'add' && pets.length >= MAX_PETS_PER_USER;

  const draftId =
    mode === 'edit' && petId
      ? `edit-${petId}`
      : `add-${currentUserId ?? 'pending'}`;
  const formKey = `${currentUserId ?? 'signed-out'}:${mode}:${petId ?? 'new'}`;

  const goBack = useCallback(() => {
    if (imageMutationLock.current) {
      showAlert('사진을 처리 중이에요', '처리가 끝난 후 다시 시도해주세요.');
      return;
    }
    if (submitLocked.current) {
      showAlert('정보를 저장 중이에요', '저장이 끝날 때까지 잠시 기다려주세요.');
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/mypage');
  }, [router, showAlert]);

  const flushPetImageRemovals = useCallback(async () => {
    if (!currentUserId) return;
    const [state, drafts] = await Promise.all([
      petRepository.loadState(currentUserId),
      petRepository.loadDrafts(currentUserId),
    ]);
    const retainedUris = collectRetainedPetImageUris(state.pets, drafts);
    await flushQueuedPetImageRemovals(currentUserId, retainedUris);
  }, [currentUserId]);

  const queueDraftImagesForRemoval = useCallback(
    async (...uris: (string | null)[]) => {
      if (!currentUserId) return;
      await queuePetImageRemovals(currentUserId, uris);
    },
    [currentUserId],
  );

  useFocusEffect(
    useCallback(() => {
      allowNavigation.current = false;

      if (!isDraftReady || !currentUserId) return undefined;
      if (skipFocusedDraftReload.current) {
        skipFocusedDraftReload.current = false;
        return undefined;
      }
      let active = true;

      petRepository
        .loadDraft(currentUserId, draftId)
        .then((storedDraft) => {
          if (active && storedDraft) {
            draftRef.current = storedDraft;
            setDraft(storedDraft);
          }
        })
        .catch(() => undefined);

      return () => {
        active = false;
      };
    }, [currentUserId, draftId, isDraftReady]),
  );

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    baseDraftRef.current = baseDraft;
  }, [baseDraft]);

  const isDirty = useMemo(() => !isSameDraft(draft, baseDraft), [baseDraft, draft]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (!sessionReady || !petsReady) return;
    if (!currentUserId) {
      initializedFormKeyRef.current = null;
      baseDraftRef.current = null;
      draftRef.current = null;
      setBaseDraft(null);
      setDraft(null);
      setIsDraftReady(true);
      return;
    }
    if (hasLoadError) {
      initializedFormKeyRef.current = null;
      baseDraftRef.current = null;
      draftRef.current = null;
      setBaseDraft(null);
      setDraft(null);
      setIsDraftReady(true);
      return;
    }
    if (reachedPetLimit) {
      initializedFormKeyRef.current = null;
      baseDraftRef.current = null;
      draftRef.current = null;
      setBaseDraft(null);
      setDraft(null);
      setIsDraftReady(true);
      return;
    }
    if (mode === 'edit' && !pet) {
      initializedFormKeyRef.current = null;
      baseDraftRef.current = null;
      draftRef.current = null;
      setBaseDraft(null);
      setDraft(null);
      setIsDraftReady(true);
      return;
    }
    if (
      initializedFormKeyRef.current === formKey &&
      baseDraftRef.current &&
      draftRef.current
    ) {
      setIsDraftReady(true);
      return;
    }

    let active = true;
    initializedFormKeyRef.current = formKey;
    setIsDraftReady(false);
    setTouched(new Set());
    draftCompleted.current = false;
    setPendingCompletion(null);
    skipFocusedDraftReload.current = true;

    const initialDraft = createPetDraft(currentUserId, pet);
    petRepository
      .loadDraft(currentUserId, initialDraft.id)
      .then(async (storedDraft) => {
        if (!active) return;
        const canRestore = Boolean(
          storedDraft &&
            storedDraft.petId === initialDraft.petId &&
            (mode !== 'edit' || storedDraft.sourceUpdatedAt === initialDraft.sourceUpdatedAt),
        );
        const restoredDraft = canRestore && storedDraft ? storedDraft : initialDraft;

        if (storedDraft && !canRestore) {
          await queueDraftImagesForRemoval(
            storedDraft.profileImageUri !== initialDraft.profileImageUri
              ? storedDraft.profileImageUri
              : null,
          );
          await petRepository.deleteDraft(currentUserId, storedDraft.id);
          await flushPetImageRemovals().catch(() => undefined);
        }

        if (!active) return;
        baseDraftRef.current = initialDraft;
        draftRef.current = restoredDraft;
        setBaseDraft(initialDraft);
        setDraft(restoredDraft);
        setTouched(mode === 'edit' ? getInvalidFields(restoredDraft) : new Set());
      })
      .catch(() => {
        if (!active) return;
        baseDraftRef.current = initialDraft;
        draftRef.current = initialDraft;
        setBaseDraft(initialDraft);
        setDraft(initialDraft);
        setTouched(mode === 'edit' ? getInvalidFields(initialDraft) : new Set());
      })
      .finally(() => {
        if (active) setIsDraftReady(true);
      });

    return () => {
      active = false;
    };
  }, [
    currentUserId,
    formKey,
    hasLoadError,
    mode,
    pet,
    petsReady,
    reachedPetLimit,
    flushPetImageRemovals,
    sessionReady,
    queueDraftImagesForRemoval,
  ]);

  useEffect(() => {
    if (!isDraftReady || !draft || !currentUserId) return;

    if (!isDirty) {
      void petRepository
        .deleteDraft(currentUserId, draft.id)
        .then(flushPetImageRemovals)
        .catch(() => undefined);
      return;
    }

    const timeout = setTimeout(() => {
      if (
        draftRef.current === draft &&
        !draftCompleted.current &&
        !submitLocked.current &&
        !imageMutationLock.current
      ) {
        void petRepository.saveDraft(draft).catch(() => undefined);
      }
    }, 180);
    return () => clearTimeout(timeout);
  }, [currentUserId, draft, flushPetImageRemovals, isDirty, isDraftReady]);

  useEffect(
    () => () => {
      if (
        currentUserId &&
        !draftCompleted.current &&
        !isDirtyRef.current
      ) {
        void petRepository.deleteDraft(currentUserId, draftId).catch(() => undefined);
      }
    },
    [currentUserId, draftId],
  );

  const queueUnusedDraftImages = useCallback(async () => {
    const current = draftRef.current;
    const base = baseDraftRef.current;
    if (!current || !currentUserId) return;

    await queueDraftImagesForRemoval(
      current.profileImageUri !== base?.profileImageUri ? current.profileImageUri : null,
    );
  }, [currentUserId, queueDraftImagesForRemoval]);

  const discardDraftAndLeave = useCallback(() => {
    const exitAction = pendingExitAction;
    if (!exitAction || leavingRef.current) return;

    leavingRef.current = true;
    setIsLeaving(true);
    void (async () => {
      draftCompleted.current = true;
      let discarded = !currentUserId;

      if (currentUserId) {
        const imagesQueued = await queueUnusedDraftImages()
          .then(() => true)
          .catch(() => false);
        if (imagesQueued) {
          try {
            await petRepository.deleteDraft(currentUserId, draftId);
            discarded = true;
          } catch {
            const fallbackDraft =
              mode === 'add'
                ? createPetDraft(currentUserId)
                : baseDraftRef.current;
            if (fallbackDraft) {
              discarded = await petRepository
                .saveDraft(fallbackDraft)
                .then(() => true)
                .catch(() => false);
            }
          }
        }
      }

      if (!discarded) {
        draftCompleted.current = false;
        leavingRef.current = false;
        setIsLeaving(false);
        showAlert(
          '작성 화면을 종료하지 못했어요',
          '잠시 후 다시 시도해주세요.',
        );
        return;
      }

      await flushPetImageRemovals().catch(() => undefined);
      allowNavigation.current = true;
      setPendingExitAction(null);
      navigation.dispatch(exitAction);
    })();
  }, [
    currentUserId,
    draftId,
    flushPetImageRemovals,
    mode,
    navigation,
    pendingExitAction,
    queueUnusedDraftImages,
    showAlert,
  ]);

  usePreventRemove(
    isDirty || isImageMutating || isSubmitting || Boolean(pendingCompletion),
    ({ data }) => {
      if (allowNavigation.current) {
        navigation.dispatch(data.action);
        return;
      }

      if (imageMutationLock.current) {
        showAlert('사진을 처리 중이에요', '처리가 끝난 후 다시 시도해주세요.');
        return;
      }

      if (submitLocked.current) {
        showAlert('정보를 저장 중이에요', '저장이 끝날 때까지 잠시 기다려주세요.');
        return;
      }

      if (pendingCompletion) {
        showAlert(
          '정보는 저장했어요',
          '저장은 완료됐지만 화면을 이동하지 못했어요. 완료하기를 다시 눌러주세요.',
        );
        return;
      }

      setPendingExitAction(data.action);
    },
  );

  const replaceImage = useCallback(
    async (field: PetImageField, sourceUri: string) => {
      if (!currentUserId || imageMutationLock.current || submitLocked.current) return;
      imageMutationLock.current = true;
      setIsImageMutating(true);
      let managedUri: string | null = null;
      let cleanupAfterRelease = false;
      try {
        managedUri = await persistPetImage(currentUserId, sourceUri);
        const current = draftRef.current;
        const base = baseDraftRef.current;
        const previousUri = current?.[field] ?? null;

        if (!current) {
          cleanupAfterRelease = true;
          showAlert('사진을 등록하지 못했어요', '잠시 후 다시 시도해주세요.');
          return;
        }

        const nextDraft = { ...current, [field]: managedUri };

        try {
          await queueDraftImagesForRemoval(previousUri);
          await petRepository.saveDraft(nextDraft);
        } catch (error) {
          cleanupAfterRelease = true;
          throw error;
        }

        draftRef.current = nextDraft;
        isDirtyRef.current = !isSameDraft(nextDraft, base);
        setDraft(nextDraft);
        await flushPetImageRemovals().catch(() => undefined);
      } finally {
        if (managedUri) releasePersistedPetImage(currentUserId, managedUri);
        if (cleanupAfterRelease) await flushPetImageRemovals().catch(() => undefined);
        imageMutationLock.current = false;
        setIsImageMutating(false);
      }
    },
    [currentUserId, flushPetImageRemovals, queueDraftImagesForRemoval, showAlert],
  );

  const { pickImage } = usePetImagePicker({
    draftId,
    enabled: isDraftReady && Boolean(draft),
    onSelect: replaceImage,
    userId: currentUserId ?? '',
  });

  const removeImage = useCallback(
    async (field: PetImageField) => {
      if (imageMutationLock.current || submitLocked.current) return;
      const current = draftRef.current;
      const base = baseDraftRef.current;
      const uri = current?.[field] ?? null;
      if (!current) return;

      const nextUri = mode === 'edit' ? (base?.[field] ?? null) : null;
      if (uri === nextUri) return;

      imageMutationLock.current = true;
      setIsImageMutating(true);
      const nextDraft = { ...current, [field]: nextUri };

      try {
        await queueDraftImagesForRemoval(uri);
        await petRepository.saveDraft(nextDraft);
        draftRef.current = nextDraft;
        isDirtyRef.current = !isSameDraft(nextDraft, base);
        setDraft(nextDraft);
        await flushPetImageRemovals().catch(() => undefined);
      } catch {
        showAlert('사진 변경을 취소하지 못했어요', '잠시 후 다시 시도해주세요.');
      } finally {
        imageMutationLock.current = false;
        setIsImageMutating(false);
      }
    },
    [flushPetImageRemovals, mode, queueDraftImagesForRemoval, showAlert],
  );

  const updateField = useCallback(
    <K extends keyof PetFormValues>(field: K, value: PetFormValues[K]) => {
      if (imageMutationLock.current || submitLocked.current) return;

      if (field === 'type') {
        setTouched((current) => new Set(current).add('type').add('breed'));
      } else if (field === 'breed') {
        setTouched((current) => new Set(current).add('breed'));
      } else if (field === 'gender' || field === 'neutered') {
        setTouched((current) => new Set(current).add('gender').add('neutered'));
      }

      const current = draftRef.current;
      if (!current) return;

      let nextDraft: PetDraft;

      if (field === 'type' && value !== current.type) {
        nextDraft = {
          ...current,
          breed: '',
          type: value as PetFormValues['type'],
        };
      } else if (field === 'birthDate') {
        nextDraft = { ...current, birthDate: formatBirthDate(String(value)) };
      } else if (field === 'weight') {
        const normalized = String(value).replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
        nextDraft = { ...current, weight: normalized };
      } else {
        nextDraft = { ...current, [field]: value };
      }

      draftRef.current = nextDraft;
      isDirtyRef.current = !isSameDraft(nextDraft, baseDraftRef.current);
      setDraft(nextDraft);
    },
    [],
  );

  const validationErrors = useMemo(
    () => (draft ? validatePetForm(draft) : {}),
    [draft],
  );
  const visibleErrors = useMemo(() => {
    const entries = Object.entries(validationErrors).filter(([field]) =>
      touched.has(field as keyof PetFormErrors),
    );
    return Object.fromEntries(entries) as PetFormErrors;
  }, [touched, validationErrors]);

  const selectBirthDate = (date: Date) => {
    if (imageMutationLock.current || submitLocked.current) return;
    updateField('birthDate', formatBirthDateValue(date));
    setTouched((current) => new Set(current).add('birthDate'));
  };

  const handleAndroidDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'set' && date) selectBirthDate(date);
  };

  const openCalendar = () => {
    if (imageMutationLock.current || submitLocked.current) return;
    const latestBirthDate = getLatestBirthDate();
    const storedBirthDate = parseBirthDate(draft?.birthDate ?? '');
    const initialDate = storedBirthDate && storedBirthDate <= latestBirthDate
      ? storedBirthDate
      : latestBirthDate;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        display: 'calendar',
        maximumDate: latestBirthDate,
        mode: 'date',
        onChange: handleAndroidDateChange,
        value: initialDate,
      });
      return;
    }

    setPendingBirthDate(initialDate);
    setCalendarVisible(true);
  };

  const finishSavedPet = async (completion: PendingPetCompletion) => {
    try {
      await petRepository.deleteDraft(completion.entity.userId, completion.draftId);
    } catch {
      await petRepository.saveDraft(completion.fallbackDraft);
    }
    await flushPetImageRemovals().catch(() => undefined);

    setPendingCompletion(null);
    allowNavigation.current = true;
    if (mode === 'edit' && router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/pet/${encodeURIComponent(completion.entity.id)}` as Href);
    }
  };

  const submit = async () => {
    if (pendingCompletion) {
      if (submitLocked.current || imageMutationLock.current) return;
      submitLocked.current = true;
      setIsSubmitting(true);
      try {
        await finishSavedPet(pendingCompletion);
      } catch {
        showAlert(
          '정보는 저장했어요',
          '저장은 완료됐지만 화면을 이동하지 못했어요. 완료하기를 다시 눌러주세요.',
        );
      } finally {
        submitLocked.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    const currentDraft = draftRef.current;
    if (
      !currentDraft ||
      !hasValidPetForm(currentDraft) ||
      submitLocked.current ||
      imageMutationLock.current ||
      (mode === 'edit' && isSameDraft(currentDraft, baseDraftRef.current))
    ) {
      return;
    }
    if (mode === 'edit' && pet && currentDraft.sourceUpdatedAt !== pet.updatedAt) {
      showAlert(
        '정보가 변경되었어요',
        '최신 반려동물 정보를 확인한 뒤 다시 수정해주세요.',
      );
      return;
    }
    submitLocked.current = true;
    setIsSubmitting(true);

    try {
      const entity = petDraftToEntity(currentDraft, pet);
      const result =
        mode === 'add'
          ? await addPet(entity)
          : await updatePet(entity, currentDraft.sourceUpdatedAt ?? undefined);

      if (!result.ok) {
        const message =
          result.reason === 'limit'
            ? '반려동물은 최대 10마리까지 등록할 수 있어요.'
            : result.reason === 'conflict'
              ? '다른 화면에서 정보가 변경되었어요. 최신 정보를 확인한 뒤 다시 수정해주세요.'
              : result.reason === 'not-supported'
                ? '등록된 프로필 사진은 새 사진으로 변경할 수 있어요.'
                : '반려동물 정보를 저장하지 못했어요.';
        showAlert(
          result.reason === 'conflict' ? '정보가 변경되었어요' : '저장할 수 없어요',
          message,
        );
        return;
      }

      const savedEntity = result.pet ?? entity;
      draftCompleted.current = true;
      const savedDraft = createPetDraft(currentDraft.userId, savedEntity);
      baseDraftRef.current = savedDraft;
      draftRef.current = savedDraft;
      isDirtyRef.current = false;
      setBaseDraft(savedDraft);
      setDraft(savedDraft);
      const completion = {
        draftId: currentDraft.id,
        entity: savedEntity,
        fallbackDraft: mode === 'add' ? createPetDraft(currentDraft.userId) : savedDraft,
      };
      setPendingCompletion(completion);
      try {
        await finishSavedPet(completion);
      } catch {
        showAlert(
          '정보는 저장했어요',
          '저장은 완료됐지만 화면을 이동하지 못했어요. 완료하기를 다시 눌러주세요.',
        );
      }
    } catch {
      showAlert('저장하지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      submitLocked.current = false;
      setIsSubmitting(false);
    }
  };

  if (!sessionReady || !petsReady || !isDraftReady) {
    return (
      <FormScreen>
        <LoadingView label="반려동물 정보를 불러오는 중이에요" />
      </FormScreen>
    );
  }

  if (
    !currentUserId ||
    hasLoadError ||
    reachedPetLimit ||
    (mode === 'edit' && !pet) ||
    !draft
  ) {
    const missingSession = !currentUserId;
    const title = missingSession
      ? '로그인이 필요해요'
      : hasLoadError
        ? '반려동물 정보를 불러오지 못했어요'
      : reachedPetLimit
        ? '더 이상 등록할 수 없어요'
        : '반려동물 정보를 찾을 수 없어요';
    const description = missingSession
      ? '로그인 후 반려동물 정보를 관리할 수 있어요.'
      : hasLoadError
        ? '저장된 정보를 다시 불러온 뒤 관리할 수 있어요.'
      : reachedPetLimit
        ? '반려동물은 최대 10마리까지 등록할 수 있어요.'
        : '삭제되었거나 존재하지 않는 반려동물이에요.';

    return (
      <FormScreen
        header={
          <TopHeader
            leftAccessibilityLabel="뒤로가기"
            leftIcon="chevron-back"
            onLeftPress={goBack}
            style={styles.header}
            title="반려동물 정보"
            titleStyle={styles.headerTitle}
          />
        }
      >
        <EmptyState
          actionLabel={hasLoadError ? '다시 시도' : '이전 화면으로'}
          description={description}
          onActionPress={hasLoadError ? reloadPets : goBack}
          title={title}
        />
      </FormScreen>
    );
  }

  const canSubmit =
    Boolean(pendingCompletion) || (hasValidPetForm(draft) && (mode === 'add' || isDirty));

  return (
    <>
      <FormScreen
        contentContainerStyle={styles.content}
        footer={
          <AppButton
            disabled={!canSubmit || isImageMutating}
            loading={isSubmitting}
            onPress={() => void submit()}
            style={styles.submitButton}
            title={pendingCompletion ? '완료하기' : mode === 'add' ? '등록하기' : '저장하기'}
          />
        }
        footerContainerStyle={styles.footer}
        header={
          <TopHeader
            leftAccessibilityLabel="뒤로가기"
            leftIcon="chevron-back"
            onLeftPress={goBack}
            style={styles.header}
            title={mode === 'add' ? '반려동물 추가' : '반려동물 정보 수정'}
            titleStyle={styles.headerTitle}
          />
        }
      >
        <PetFormFields
          canRemoveImage={
            mode === 'add' || draft.profileImageUri !== baseDraft?.profileImageUri
          }
          disabled={isImageMutating || isSubmitting || Boolean(pendingCompletion)}
          errors={visibleErrors}
          onBlur={(field) => setTouched((current) => new Set(current).add(field))}
          onChange={updateField}
          onOpenBreed={() => {
            if (imageMutationLock.current || submitLocked.current) return;
            setTouched((current) => new Set(current).add('breed'));
            if (draft.type) setBreedVisible(true);
          }}
          onOpenCalendar={openCalendar}
          onPickImage={(field) => {
            if (imageMutationLock.current || submitLocked.current) return;
            void pickImage(field);
          }}
          onRemoveImage={removeImage}
          removeImageLabel={mode === 'edit' ? '사진 변경 취소' : '사진 삭제'}
          values={draft}
        />
      </FormScreen>

      {draft.type ? (
        <PetBreedPickerModal
          onClose={() => setBreedVisible(false)}
          onSelect={(breed) => updateField('breed', breed)}
          petType={draft.type}
          selectedBreed={draft.breed}
          visible={breedVisible}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <AppModal
          onClose={() => setCalendarVisible(false)}
          primaryAction={{
            label: '선택',
            onPress: () => {
              selectBirthDate(pendingBirthDate);
              setCalendarVisible(false);
            },
          }}
          secondaryAction={{
            label: '취소',
            onPress: () => setCalendarVisible(false),
          }}
          title="생년월일 선택"
          variant="center"
          visible={calendarVisible}
        >
          <DateTimePicker
            accentColor={COLORS.primary}
            display="inline"
            locale="ko-KR"
            maximumDate={getLatestBirthDate()}
            mode="date"
            onChange={(_, date) => date && setPendingBirthDate(date)}
            themeVariant="light"
            value={pendingBirthDate}
          />
        </AppModal>
      ) : null}

      <AppModal
        closeOnBackdropPress={!isLeaving}
        onClose={() => {
          if (!isLeaving) setPendingExitAction(null);
        }}
        primaryAction={{
          disabled: isLeaving,
          label: '나가기',
          loading: isLeaving,
          onPress: discardDraftAndLeave,
          variant: 'danger',
        }}
        secondaryAction={{
          disabled: isLeaving,
          label: '계속 작성',
          onPress: () => setPendingExitAction(null),
        }}
        title={mode === 'add' ? '반려동물 등록을 그만할까요?' : '수정을 그만할까요?'}
        variant="center"
        visible={Boolean(pendingExitAction)}
      >
        <Text style={styles.exitModalDescription}>작성 중인 내용이 삭제돼요.</Text>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: LAYOUT.screenPaddingHorizontal,
  },
  headerTitle: {
    ...TYPOGRAPHY.authTitle,
  },
  content: {
    paddingBottom: SPACING.jumbo,
    paddingTop: 0,
  },
  footer: {
    elevation: 8,
    paddingTop: 18,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  submitButton: {
    height: 54,
  },
  exitModalDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
