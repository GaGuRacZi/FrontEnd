import { type NavigationAction, useNavigation, usePreventRemove } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppButton, AppIcon } from '@/src/components/common';
import { AppInput, ImageAttachmentField, SelectionButton } from '@/src/components/form';
import { KeyboardAwareScrollView } from '@/src/components/layout';
import { AppModal, useAppAlert } from '@/src/components/modal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import { SupportScreen } from '../components/SupportScreen';
import { useSupportStore } from '../SupportStore';
import {
  getInquiryDraftError,
  INQUIRY_TYPE_OPTIONS,
  MAX_INQUIRY_BODY_LENGTH,
  MAX_INQUIRY_IMAGES,
} from '../supportValidation';

export function InquiryWriteScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const showAlert = useAppAlert();
  const {
    addDraftImages,
    draft,
    removeDraftImage,
    saveDraft,
    status,
    submitInquiry,
    updateDraft,
  } = useSupportStore();
  const [attempted, setAttempted] = useState(false);
  const [pickingImages, setPickingImages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingExit, setSavingExit] = useState(false);
  const [pendingExitAction, setPendingExitAction] = useState<NavigationAction | null>(null);
  const [completedInquiryId, setCompletedInquiryId] = useState<string | null>(null);
  const pickingRef = useRef(false);
  const savingExitRef = useRef(false);
  const submittingRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const dirty = Boolean(draft.type || draft.body.trim() || draft.images.length);
  const draftError = attempted ? getInquiryDraftError(draft) : null;
  const typeError = attempted && !draft.type ? '문의 유형을 선택해주세요.' : null;
  const bodyError = attempted && draft.type ? draftError : null;
  const canSubmit = !getInquiryDraftError(draft) && !pickingImages && !submitting;

  useEffect(() => {
    if (status !== 'ready') return undefined;
    const timeout = setTimeout(() => {
      void saveDraft();
    }, 250);
    return () => clearTimeout(timeout);
  }, [draft.updatedAt, saveDraft, status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') void saveDraft();
    });
    return () => subscription.remove();
  }, [saveDraft]);

  useEffect(
    () => () => {
      void saveDraft();
    },
    [saveDraft],
  );

  usePreventRemove(
    !allowNavigationRef.current && (dirty || submitting || Boolean(completedInquiryId)),
    ({ data }) => {
      if (submitting || completedInquiryId) return;
      setPendingExitAction(data.action);
    },
  );

  const pickImages = useCallback(async () => {
    if (pickingRef.current) return;
    const remaining = MAX_INQUIRY_IMAGES - draft.images.length;
    if (remaining <= 0) {
      showAlert(`사진은 최대 ${MAX_INQUIRY_IMAGES}장까지 첨부할 수 있어요.`);
      return;
    }

    pickingRef.current = true;
    setPickingImages(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        defaultTab: 'photos',
        mediaTypes: ['images'],
        quality: 0.85,
        selectionLimit: remaining,
      });
      if (result.canceled) return;

      const addResult = await addDraftImages(
        result.assets.slice(0, remaining).map(({ uri }) => uri),
      );
      if (!addResult.ok) {
        showAlert(
          addResult.reason === 'limit'
            ? `사진은 최대 ${MAX_INQUIRY_IMAGES}장까지 첨부할 수 있어요.`
            : '사진을 불러오지 못했어요',
          addResult.reason === 'limit' ? undefined : '잠시 후 다시 시도해주세요.',
        );
      }
    } catch {
      showAlert('사진을 불러오지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      pickingRef.current = false;
      setPickingImages(false);
    }
  }, [addDraftImages, draft.images.length, showAlert]);

  const removeImage = useCallback(
    async (assetId: string) => {
      const result = await removeDraftImage(assetId);
      if (!result.ok) {
        showAlert('사진을 삭제하지 못했어요', '잠시 후 다시 시도해주세요.');
      }
    },
    [removeDraftImage, showAlert],
  );

  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    setAttempted(true);
    if (getInquiryDraftError(draft)) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await submitInquiry();
      if (result.ok) {
        setAttempted(false);
        setCompletedInquiryId(result.inquiryId);
        return;
      }
      showAlert(
        result.reason === 'invalid' ? '문의 내용을 확인해주세요' : '문의를 저장하지 못했어요',
        result.reason === 'invalid'
          ? getInquiryDraftError(draft) ?? undefined
          : '작성 내용은 그대로 보관했어요. 잠시 후 다시 시도해주세요.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [draft, showAlert, submitInquiry]);

  const confirmExit = useCallback(async () => {
    if (savingExitRef.current) return;
    const exitAction = pendingExitAction;
    if (!exitAction) return;

    savingExitRef.current = true;
    setSavingExit(true);
    try {
      const result = await saveDraft();
      if (result.ok) {
        allowNavigationRef.current = true;
        setPendingExitAction(null);
        setTimeout(() => navigation.dispatch(exitAction), 0);
        return;
      }
      showAlert('작성 내용을 저장하지 못했어요', '입력 내용은 그대로 두었어요. 다시 시도해주세요.');
    } catch {
      showAlert('작성 내용을 저장하지 못했어요', '입력 내용은 그대로 두었어요. 다시 시도해주세요.');
    } finally {
      if (!allowNavigationRef.current) {
        savingExitRef.current = false;
        setSavingExit(false);
      }
    }
  }, [navigation, pendingExitAction, saveDraft, showAlert]);

  const finishSubmission = useCallback(() => {
    allowNavigationRef.current = true;
    setCompletedInquiryId(null);
    setTimeout(() => router.dismissTo('/mypage/inquiries'), 0);
  }, [router]);

  const attachments = useMemo(
    () => draft.images.map(({ assetId, localUri }) => ({ id: assetId, source: { uri: localUri } })),
    [draft.images],
  );

  return (
    <>
      <SupportScreen
        fallbackRoute="/mypage/inquiries"
        loadingLabel="작성 중인 문의를 불러오고 있어요."
        title="문의 작성"
      >
        <KeyboardAwareScrollView
          contentContainerStyle={styles.content}
          extraScrollHeight={SIZE.buttonHeight + SPACING.xxxl}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.guideCard}>
            <AppIcon color={COLORS.primary} name="information-circle-outline" size={22} />
            <Text style={styles.guideText}>
              계정과 결제 정보는 화면 캡처에 개인정보가 보이지 않도록 확인해주세요.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>문의 유형</Text>
            <View accessibilityRole="radiogroup" style={styles.typeOptions}>
              {INQUIRY_TYPE_OPTIONS.map((option) => (
                <SelectionButton
                  disabled={submitting}
                  key={option.value}
                  label={option.label}
                  onPress={() => updateDraft({ type: option.value })}
                  selected={draft.type === option.value}
                  style={styles.typeOption}
                />
              ))}
            </View>
            {typeError ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {typeError}
              </Text>
            ) : null}
          </View>

          <AppInput
            accessibilityLabel="문의 내용"
            editable={!submitting}
            error={bodyError ?? undefined}
            helperText={`${draft.body.length}/${MAX_INQUIRY_BODY_LENGTH}`}
            label="문의 내용"
            maxLength={MAX_INQUIRY_BODY_LENGTH}
            multiline
            onChangeText={(body) => updateDraft({ body })}
            placeholder="문의 내용을 자세히 적어주세요."
            value={draft.body}
          />

          <ImageAttachmentField
            attachments={attachments}
            disabled={pickingImages || submitting}
            label="문의 사진"
            maxCount={MAX_INQUIRY_IMAGES}
            onAdd={() => void pickImages()}
            onRemove={(assetId) => void removeImage(assetId)}
          />

          <Text style={styles.draftNotice}>
            작성한 문의는 최근 문의 내역에 저장됩니다.
          </Text>

          <AppButton
            disabled={!canSubmit}
            loading={submitting}
            onPress={() => void submit()}
            title="문의 저장하기"
          />
        </KeyboardAwareScrollView>
      </SupportScreen>

      <AppModal
        onClose={() => {
          if (!savingExitRef.current) setPendingExitAction(null);
        }}
        primaryAction={{ label: '나가기', loading: savingExit, onPress: () => void confirmExit() }}
        secondaryAction={{
          disabled: savingExit,
          label: '계속 작성',
          onPress: () => setPendingExitAction(null),
        }}
        title="문의를 그만 작성할까요?"
        variant="center"
        visible={Boolean(pendingExitAction)}
      >
        <Text style={styles.modalDescription}>작성 중인 내용은 임시 저장됩니다.</Text>
      </AppModal>

      <AppModal
        closeOnBackdropPress={false}
        onClose={finishSubmission}
        onRequestClose={finishSubmission}
        primaryAction={{ label: '확인', onPress: finishSubmission }}
        title="문의가 저장됐어요"
        variant="center"
        visible={Boolean(completedInquiryId)}
      >
        <Text style={styles.modalDescription}>
          최근 문의에서 작성 내용을 확인할 수 있어요.
        </Text>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.xxxl,
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.xxl,
  },
  guideCard: {
    alignItems: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    gap: SPACING.xl,
    padding: SPACING.xxl,
  },
  guideText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray800,
    flex: 1,
  },
  field: {
    gap: SPACING.md,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  typeOption: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
  },
  draftNotice: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  modalDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
