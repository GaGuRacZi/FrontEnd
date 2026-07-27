import {
  type NavigationAction,
  useNavigation,
  usePreventRemove,
} from '@react-navigation/native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, FONT_FAMILY, LAYOUT, RADIUS, SPACING } from '@/src/constants';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';

import {
  PET_SELECTION_FIELDS,
  PET_SELECTION_OPTIONS,
  PET_SELECTION_TITLES,
} from '../petData';
import { petRepository } from '../services/petRepository';
import type { PetDraft, PetSelectionField } from '../types';

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readSelectionField(value: string | undefined) {
  return PET_SELECTION_FIELDS.find((field) => field === value);
}

function getDraftId(mode: string | undefined, petId: string | undefined, userId: string) {
  if (mode === 'edit' && petId) return `edit-${petId}`;
  if (mode === 'add') return `add-${userId}`;
  return undefined;
}

function getOptionLabel(field: PetSelectionField, option: string) {
  return field === 'excludedIngredients' ? `${option} 제외` : option;
}

export function PetSelectionScreen() {
  const params = useLocalSearchParams<{
    field?: string | string[];
    mode?: string | string[];
    petId?: string | string[];
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { currentUserId, isReady: sessionReady } = useAuthSession();
  const field = readSelectionField(readParam(params.field));
  const mode = readParam(params.mode);
  const petId = readParam(params.petId);
  const draftId = currentUserId ? getDraftId(mode, petId, currentUserId) : undefined;
  const [draft, setDraft] = useState<PetDraft | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const leavingRef = useRef(false);
  const allowNavigation = useRef(false);
  const draftRef = useRef<PetDraft | null>(null);
  const invalidAlertShown = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const searchInputRef = useRef<TextInput>(null);
  const selectedRef = useRef<string[]>([]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/mypage');
  }, [router]);

  useEffect(() => {
    if (!sessionReady) return;

    let active = true;

    if (!currentUserId || !field || !draftId) {
      allowNavigation.current = true;
      draftRef.current = null;
      saveQueueRef.current = Promise.resolve();
      selectedRef.current = [];
      setDraft(null);
      setSelected([]);
      setQuery('');
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    setIsLoading(true);
    setIsSaving(false);
    setDraft(null);
    setQuery('');
    invalidAlertShown.current = false;
    leavingRef.current = false;
    allowNavigation.current = false;
    draftRef.current = null;
    saveQueueRef.current = Promise.resolve();
    selectedRef.current = [];
    setSelected([]);
    petRepository
      .loadDraft(currentUserId, draftId)
      .then((storedDraft) => {
        if (!active) return;
        selectedRef.current = storedDraft?.[field] ?? [];
        draftRef.current = storedDraft;
        setDraft(storedDraft);
        setSelected(selectedRef.current);
      })
      .catch(() => {
        if (active) setDraft(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUserId, draftId, field, sessionReady]);

  useEffect(() => {
    if (isLoading || draft || invalidAlertShown.current) return;

    invalidAlertShown.current = true;
    Alert.alert(
      '작성 중인 정보를 찾을 수 없어요',
      '반려동물 정보 입력 화면으로 돌아가 다시 시도해주세요.',
      [{ text: '확인', onPress: goBack }],
    );
  }, [draft, goBack, isLoading]);

  const allOptions = useMemo(() => {
    if (!draft || !field) return [];
    return Array.from(new Set([...PET_SELECTION_OPTIONS[field], ...draft[field]]));
  }, [draft, field]);

  const filteredOptions = useMemo(() => {
    if (!field) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return allOptions;
    return allOptions.filter((option) =>
      getOptionLabel(field, option).toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [allOptions, field, query]);

  const saveAndClose = useCallback(async (action?: NavigationAction) => {
    if (leavingRef.current) return;

    const currentDraft = draftRef.current;
    if (!currentUserId || !currentDraft || !field) {
      allowNavigation.current = true;
      if (action) {
        navigation.dispatch(action);
        return;
      }
      goBack();
      return;
    }

    leavingRef.current = true;
    setIsSaving(true);

    try {
      await saveQueueRef.current;
      const latestDraft = {
        ...currentDraft,
        [field]: [...selectedRef.current],
      };
      await petRepository.saveDraft(latestDraft);
      draftRef.current = latestDraft;
      allowNavigation.current = true;
      if (action) navigation.dispatch(action);
      else goBack();
    } catch {
      leavingRef.current = false;
      allowNavigation.current = false;
      setIsSaving(false);
      Alert.alert('저장하지 못했어요', '잠시 후 다시 시도해주세요.');
    }
  }, [currentUserId, field, goBack, navigation]);

  usePreventRemove(Boolean(currentUserId && draft && field), ({ data }) => {
    if (allowNavigation.current) {
      navigation.dispatch(data.action);
      return;
    }

    void saveAndClose(data.action);
  });

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        void saveAndClose();
        return true;
      });

      return () => subscription.remove();
    }, [saveAndClose]),
  );

  const toggleOption = (option: string) => {
    const currentDraft = draftRef.current;
    if (!currentDraft || !field || leavingRef.current) return;
    const current = selectedRef.current;
    const nextSelected = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];
    const nextDraft = { ...currentDraft, [field]: nextSelected };

    selectedRef.current = nextSelected;
    draftRef.current = nextDraft;
    setSelected(nextSelected);
    setDraft(nextDraft);
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => petRepository.saveDraft(nextDraft))
      .catch(() => undefined);
  };

  if (isLoading || !sessionReady) {
    return (
      <AppScreen padded={false}>
        <LoadingView />
      </AppScreen>
    );
  }

  if (!draft || !field) {
    return (
      <AppScreen padded={false}>
        <View style={styles.emptyContainer}>
          <EmptyState
            actionLabel="이전 화면으로 이동"
            onActionPress={goBack}
            title="작성 중인 정보를 찾을 수 없어요"
          />
        </View>
      </AppScreen>
    );
  }

  const title = PET_SELECTION_TITLES[field];

  return (
    <AppScreen contentContainerStyle={styles.screenContent} padded={false}>
      <TopHeader
        centerContent={<Text style={styles.headerTitle}>{title}</Text>}
        leftAccessibilityLabel="이전 화면으로 이동"
        leftIcon="chevron-back"
        onLeftPress={() => void saveAndClose()}
        rightContent={
          <Pressable
            accessibilityLabel={`${title} 저장`}
            accessibilityRole="button"
            accessibilityState={{ busy: isSaving, disabled: isSaving }}
            disabled={isSaving}
            onPress={() => void saveAndClose()}
            style={({ pressed }) => [
              styles.saveButton,
              isSaving && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.saveButtonText}>{isSaving ? '저장 중' : '저장'}</Text>
          </Pressable>
        }
        style={styles.header}
      />

      <View style={styles.searchArea}>
        <TextInput
          accessibilityLabel={`${title} 검색`}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="검색어를 입력하세요"
          placeholderTextColor={COLORS.gray500}
          ref={searchInputRef}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        <Pressable
          accessibilityLabel={`${title} 검색창 열기`}
          accessibilityRole="button"
          onPress={() => searchInputRef.current?.focus()}
          style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
        >
          <AppIcon color={COLORS.gray600} name="search" size={22} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.list}
      >
        {filteredOptions.length ? (
          filteredOptions.map((option) => {
            const isSelected = selected.includes(option);

            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                key={option}
                onPress={() => toggleOption(option)}
                style={({ pressed }) => [styles.optionRow, pressed && styles.optionPressed]}
              >
                <Text style={styles.optionLabel}>{getOptionLabel(field, option)}</Text>
                <View style={[styles.checkCircle, isSelected && styles.selectedCircle]}>
                  {isSelected ? (
                    <AppIcon color={COLORS.background} name="checkmark" size={21} />
                  ) : null}
                </View>
              </Pressable>
            );
          })
        ) : (
          <EmptyState
            description="직접 입력은 추후 지원할 예정이에요."
            title="검색 결과가 없어요"
          />
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
  },
  header: {
    marginHorizontal: LAYOUT.screenPaddingHorizontal,
    marginTop: SPACING.xl,
  },
  headerTitle: {
    color: COLORS.black,
    fontFamily: FONT_FAMILY.bold,
    fontSize: 21,
    lineHeight: 30,
    textAlign: 'center',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 70,
  },
  saveButtonText: {
    color: COLORS.background,
    fontFamily: FONT_FAMILY.bold,
    fontSize: 14,
    lineHeight: 22,
  },
  searchArea: {
    alignItems: 'flex-start',
    borderBottomColor: COLORS.black,
    borderBottomWidth: 2,
    flexDirection: 'row',
    height: 48,
    marginLeft: 20,
    marginRight: 31,
    marginTop: 34,
  },
  searchInput: {
    color: COLORS.black,
    flex: 1,
    fontFamily: FONT_FAMILY.regular,
    fontSize: 15,
    height: 46,
    lineHeight: 20,
    paddingHorizontal: 7,
    paddingVertical: 0,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: 21,
    borderWidth: 1,
    elevation: 2,
    height: 42,
    justifyContent: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 7,
    width: 42,
  },
  list: {
    flex: 1,
    marginLeft: 20,
    marginRight: 31,
  },
  listContent: {
    paddingBottom: SPACING.jumbo,
    paddingTop: 5,
  },
  optionRow: {
    alignItems: 'center',
    borderBottomColor: COLORS.gray500,
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 60,
    paddingHorizontal: 7,
    paddingTop: 10,
  },
  optionPressed: {
    backgroundColor: COLORS.gray100,
  },
  optionLabel: {
    color: COLORS.black,
    flex: 1,
    fontFamily: FONT_FAMILY.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  checkCircle: {
    alignItems: 'center',
    borderColor: COLORS.gray500,
    borderRadius: RADIUS.round,
    borderWidth: 0.7,
    height: 29,
    justifyContent: 'center',
    width: 29,
  },
  selectedCircle: {
    backgroundColor: COLORS.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.7,
  },
});
