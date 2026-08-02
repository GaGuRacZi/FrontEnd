import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { type NavigationAction, usePreventRemove } from '@react-navigation/native';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { KeyboardAwareScrollView } from '@/src/components/layout/KeyboardAwareScrollView';
import { AppModal, useAppAlert } from '@/src/components/modal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { AddressSearchScreen } from '@/src/features/auth/signup/components/AddressSearchScreen';
import {
  getBestCurrentPosition,
  getRegionFromPosition,
} from '@/src/features/auth/signup/services/locationService';
import { TERM_IDS, useTerms } from '@/src/features/auth/terms';
import { TermDetailScreen } from '@/src/features/auth/terms/screens/TermDetailScreen';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';
import { formatCompactRegion } from '@/src/utils/location';

import { MyPageHeader, ProfileAvatar } from '../components';
import { useMyPageStore } from '../MyPageStore';
import {
  clearPendingProfileImagePicker,
  getPendingProfileImagePicker,
  persistProfileImage,
  removeProfileImage,
  setPendingProfileImagePicker,
} from '../services/profileImageStorage';
import type { UserProfile } from '../types';

const MAX_NICKNAME_LENGTH = 12;
const MAX_NAME_LENGTH = 20;
const MAX_INTRODUCTION_LENGTH = 30;

type ProfileDraft = Pick<
  UserProfile,
  'introduction' | 'location' | 'name' | 'nickname' | 'profileImageUri'
>;

function createDraft(profile: UserProfile): ProfileDraft {
  return {
    introduction: profile.introduction,
    location: profile.location,
    name: profile.name,
    nickname: profile.nickname,
    profileImageUri: profile.profileImageUri,
  };
}

export function MyPageProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const navigateOnce = useNavigationLock();
  const showAlert = useAppAlert();
  const { isReady, profile, updateProfile } = useMyPageStore();
  const { getTerm, hasCurrentConsent, status: termsStatus } = useTerms();
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [addressSearchVisible, setAddressSearchVisible] = useState(false);
  const [locationTermsVisible, setLocationTermsVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pendingExitAction, setPendingExitAction] = useState<NavigationAction | null>(null);
  const allowNavigationRef = useRef(false);
  const committedImageUriRef = useRef<string | null>(null);
  const draftImageUriRef = useRef<string | null>(null);
  const locationRequestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const pickerOpenRef = useRef(false);
  const profileIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!profile) return;

    profileIdRef.current = profile.id;
    committedImageUriRef.current = profile.profileImageUri;
    draftImageUriRef.current = profile.profileImageUri;
    setDraft(createDraft(profile));
  }, [profile]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      locationRequestIdRef.current += 1;
      const userId = profileIdRef.current;
      const uri = draftImageUriRef.current;
      if (userId && uri && uri !== committedImageUriRef.current) {
        void removeProfileImage(userId, uri).catch(() => undefined);
      }
    };
  }, []);

  const removeDraftOnlyImage = useCallback(async (uri: string | null) => {
    const userId = profileIdRef.current;
    if (!userId || !uri || uri === committedImageUriRef.current) return;
    await removeProfileImage(userId, uri).catch(() => undefined);
  }, []);

  const applySelectedImage = useCallback(
    async (sourceUri: string) => {
      const userId = profileIdRef.current;
      if (!userId) return;

      const previousUri = draftImageUriRef.current;
      const persistedUri = await persistProfileImage(userId, sourceUri);

      if (!mountedRef.current || profileIdRef.current !== userId) {
        await removeProfileImage(userId, persistedUri).catch(() => undefined);
        return;
      }

      draftImageUriRef.current = persistedUri;
      setDraft((current) =>
        current ? { ...current, profileImageUri: persistedUri } : current,
      );
      await removeDraftOnlyImage(previousUri);
    },
    [removeDraftOnlyImage],
  );

  const handlePickerResult = useCallback(
    async (
      result: ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult | null,
    ) => {
      if (!result) return;

      if ('code' in result) {
        showAlert('사진을 불러오지 못했어요', '사진을 다시 선택해주세요.');
        return;
      }

      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;

      try {
        await applySelectedImage(asset.uri);
      } catch {
        showAlert('사진을 저장하지 못했어요', '사진을 다시 선택해주세요.');
      }
    },
    [applySelectedImage, showAlert],
  );

  useEffect(() => {
    if (Platform.OS !== 'android' || !profile) return;

    let active = true;

    void (async () => {
      try {
        const pendingUserId = await getPendingProfileImagePicker();
        if (!active || pendingUserId !== profile.id) return;

        pickerOpenRef.current = true;
        const result = await ImagePicker.getPendingResultAsync();
        if (active) await handlePickerResult(result);
      } catch {
        if (active) {
          showAlert('사진을 불러오지 못했어요', '사진을 다시 선택해주세요.');
        }
      } finally {
        await clearPendingProfileImagePicker(profile.id).catch(() => undefined);
        pickerOpenRef.current = false;
      }
    })();

    return () => {
      active = false;
    };
  }, [handlePickerResult, profile, showAlert]);

  const errors = useMemo(() => {
    if (!draft) return { name: '', nickname: '' };

    return {
      name: draft.name.trim() ? '' : '이름을 입력해주세요.',
      nickname: draft.nickname.trim() ? '' : '닉네임을 입력해주세요.',
    };
  }, [draft]);
  const isDirty = Boolean(
    draft &&
      profile &&
      (draft.introduction !== profile.introduction ||
        draft.location !== profile.location ||
        draft.name !== profile.name ||
        draft.nickname !== profile.nickname ||
        draft.profileImageUri !== profile.profileImageUri),
  );
  const canSave = Boolean(draft && !errors.name && !errors.nickname && !saving);

  usePreventRemove(isDirty || saving, ({ data }) => {
    if (allowNavigationRef.current) {
      navigation.dispatch(data.action);
      return;
    }
    if (savingRef.current) return;
    setPendingExitAction(data.action);
  });

  if (addressSearchVisible && draft) {
    return (
      <AddressSearchScreen
        onBack={() => setAddressSearchVisible(false)}
        onSelect={(address) => {
          setDraft((current) => (current ? { ...current, location: address } : current));
          setAddressSearchVisible(false);
        }}
      />
    );
  }

  if (!isReady) {
    return (
      <MyPageHeader title="프로필 정보">
        <LoadingView label="프로필을 준비하고 있어요." />
      </MyPageHeader>
    );
  }

  if (!profile) {
    return (
      <MyPageHeader title="프로필 정보">
        <EmptyState title="프로필을 찾지 못했어요." />
      </MyPageHeader>
    );
  }

  if (!draft) {
    return (
      <MyPageHeader title="프로필 정보">
        <LoadingView label="프로필을 준비하고 있어요." />
      </MyPageHeader>
    );
  }

  const pickProfileImage = async () => {
    if (pickerOpenRef.current) return;
    pickerOpenRef.current = true;

    try {
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          showAlert('사진 접근 권한이 필요해요', '설정에서 사진 접근 권한을 허용해주세요.', [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => void Linking.openSettings() },
          ]);
          return;
        }
      }

      await setPendingProfileImagePicker(profile.id);
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        allowsMultipleSelection: false,
        aspect: [1, 1],
        defaultTab: 'photos',
        mediaTypes: ['images'],
        quality: 0.85,
        selectionLimit: 1,
      });
      await handlePickerResult(result);
    } catch {
      showAlert('사진첩을 열지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      await clearPendingProfileImagePicker(profile.id).catch(() => undefined);
      pickerOpenRef.current = false;
    }
  };

  const requestCurrentLocation = async () => {
    if (locating) return;
    const requestId = locationRequestIdRef.current + 1;
    locationRequestIdRef.current = requestId;
    const isActiveRequest = () =>
      mountedRef.current && locationRequestIdRef.current === requestId;
    setLocating(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!isActiveRequest()) return;

      if (!permission.granted) {
        showAlert('위치 권한이 필요해요', '설정에서 위치 권한을 허용해주세요.', [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => void Linking.openSettings() },
        ]);
        return;
      }

      const position = await getBestCurrentPosition();
      if (!isActiveRequest()) return;
      if (!position) {
        showAlert('현재 위치를 찾지 못했어요', '지역 검색으로 직접 선택해주세요.');
        return;
      }

      const region = await getRegionFromPosition(position);
      if (!isActiveRequest()) return;
      if (!region) {
        showAlert('현재 위치를 주소로 바꾸지 못했어요', '지역 검색으로 직접 선택해주세요.');
        return;
      }

      setDraft((current) => (current ? { ...current, location: region } : current));
    } catch {
      if (isActiveRequest()) {
        showAlert('현재 위치를 불러오지 못했어요', '잠시 후 다시 시도해주세요.');
      }
    } finally {
      if (isActiveRequest()) setLocating(false);
    }
  };

  const setCurrentLocation = async () => {
    if (termsStatus !== 'ready') {
      showAlert('약관을 불러오고 있어요', '잠시 후 다시 시도해주세요.');
      return;
    }

    if (!getTerm(TERM_IDS.location)) {
      showAlert('위치 약관을 찾지 못했어요', '지역 검색으로 직접 선택해주세요.');
      return;
    }

    if (!hasCurrentConsent(TERM_IDS.location)) {
      setLocationTermsVisible(true);
      return;
    }

    await requestCurrentLocation();
  };

  const saveProfile = () => {
    if (!canSave || savingRef.current) return;

    navigateOnce(async () => {
      savingRef.current = true;
      setSaving(true);
      try {
        const result = await updateProfile({
          ...profile,
          introduction: draft.introduction,
          location: draft.location,
          name: draft.name,
          nickname: draft.nickname,
          profileImageUri: draft.profileImageUri,
        });

        if (!result.ok) {
          showAlert('저장하지 못했어요', '잠시 후 다시 시도해주세요.');
          throw new Error('PROFILE_UPDATE_FAILED');
        }

        committedImageUriRef.current = draft.profileImageUri;
        allowNavigationRef.current = true;
        savingRef.current = false;
        if (router.canGoBack()) router.back();
        else router.replace('/mypage/settings');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    });
  };

  if (locationTermsVisible) {
    return (
      <TermDetailScreen
        action="consent"
        onBack={() => setLocationTermsVisible(false)}
        onConsentComplete={() => {
          setLocationTermsVisible(false);
          void requestCurrentLocation();
        }}
        termId={TERM_IDS.location}
      />
    );
  }

  return (
    <>
      <MyPageHeader title="프로필 정보">
        <KeyboardAwareScrollView
          contentContainerStyle={styles.content}
          extraScrollHeight={SIZE.tabBarHeight}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.hero}>
          <Pressable
            accessibilityLabel="프로필 사진 변경"
            accessibilityRole="button"
            onPress={pickProfileImage}
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          >
            <ProfileAvatar size={82} uri={draft.profileImageUri} />
            <View style={styles.cameraBadge}>
              <AppIcon color={COLORS.primary} name="camera-outline" size={16} />
            </View>
          </Pressable>
          <View style={styles.heroText}>
            <Text numberOfLines={1} style={styles.heroName}>
              {draft.nickname || '닉네임'}
            </Text>
            <Text ellipsizeMode="tail" numberOfLines={1} style={styles.heroMeta}>
              {formatCompactRegion(draft.location) || '지역 미설정'}
            </Text>
            <View style={styles.heroActions}>
              <Pressable
                accessibilityRole="button"
                disabled={!draft.profileImageUri}
                onPress={() => {
                  const uri = draftImageUriRef.current;
                  draftImageUriRef.current = null;
                  void removeDraftOnlyImage(uri);
                  setDraft((current) =>
                    current ? { ...current, profileImageUri: null } : current,
                  );
                }}
                style={({ pressed }) => [
                  styles.imageActionButton,
                  !draft.profileImageUri && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.imageActionText}>사진 삭제</Text>
              </Pressable>
              <View style={styles.linkedBadge}>
                <Text style={styles.linkedText}>계정 연동</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <AppInput
            error={errors.name}
            label="사용자 이름"
            maxLength={MAX_NAME_LENGTH}
            onChangeText={(name) => setDraft((current) => current && { ...current, name })}
            value={draft.name}
          />
          <AppInput
            error={errors.nickname}
            label="닉네임"
            maxLength={MAX_NICKNAME_LENGTH}
            onChangeText={(nickname) =>
              setDraft((current) => current && { ...current, nickname })
            }
            value={draft.nickname}
          />
          <AppInput
            helperText={`${draft.introduction.length}/${MAX_INTRODUCTION_LENGTH}`}
            label="한 줄 소개"
            maxLength={MAX_INTRODUCTION_LENGTH}
            onChangeText={(introduction) =>
              setDraft((current) => current && { ...current, introduction })
            }
            value={draft.introduction}
          />
          <View style={styles.locationActions}>
            <Text style={styles.label}>지역</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAddressSearchVisible(true)}
              style={({ pressed }) => [styles.locationField, pressed && styles.pressed]}
            >
              <View style={styles.locationIcon}>
                <AppIcon color={COLORS.primary} name="search-outline" size={17} />
              </View>
              <View style={styles.locationTextBox}>
                <Text style={styles.locationLabel}>주소 검색</Text>
                <Text numberOfLines={1} style={styles.locationText}>
                  {draft.location || '동네나 지역명을 직접 선택해요'}
                </Text>
              </View>
              <AppIcon name="chevron-forward" size={20} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={locating}
              onPress={setCurrentLocation}
              style={({ pressed }) => [
                styles.currentLocation,
                pressed && styles.pressed,
                locating && styles.disabled,
              ]}
            >
              <View style={styles.locationIcon}>
                <AppIcon color={COLORS.primary} name="locate-outline" size={17} />
              </View>
              <View style={styles.locationTextBox}>
                <Text style={styles.locationLabel}>현재 위치로 설정</Text>
                <Text style={styles.locationText}>
                  {locating ? '현재 위치를 확인하고 있어요' : '휴대폰 위치 권한을 사용해요'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

          <AppButton
            disabled={!canSave}
            loading={saving}
            onPress={saveProfile}
            title="저장하기"
          />
        </KeyboardAwareScrollView>
      </MyPageHeader>
      <AppModal
        onClose={() => setPendingExitAction(null)}
        primaryAction={{
          label: '나가기',
          onPress: () => {
            const action = pendingExitAction;
            if (!action) return;
            allowNavigationRef.current = true;
            setPendingExitAction(null);
            navigation.dispatch(action);
          },
          variant: 'danger',
        }}
        secondaryAction={{
          label: '계속 수정',
          onPress: () => setPendingExitAction(null),
        }}
        title="프로필 수정을 그만할까요?"
        variant="center"
        visible={Boolean(pendingExitAction)}
      >
        <Text style={styles.exitModalDescription}>저장하지 않은 변경 내용이 사라져요.</Text>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.xxxl,
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.xl,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 20,
    minHeight: 128,
    paddingHorizontal: 20,
  },
  heroText: {
    flex: 1,
  },
  avatarButton: {
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  cameraBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    bottom: 2,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    width: 28,
  },
  heroName: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
  },
  heroMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    marginTop: SPACING.xxs,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  imageActionButton: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  imageActionText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.gray600,
  },
  linkedBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderColor: COLORS.yellow,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  linkedText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.gray600,
  },
  formCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.modal,
    borderWidth: 1,
    gap: SPACING.xxl,
    padding: SPACING.xxl,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  locationActions: {
    gap: SPACING.sm,
  },
  locationField: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.md,
    minHeight: 62,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
  },
  locationIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  locationTextBox: {
    flex: 1,
    gap: SPACING.xxs,
  },
  locationLabel: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.black,
  },
  locationText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  currentLocation: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderColor: COLORS.yellow,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.md,
    minHeight: 62,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.65,
  },
  exitModalDescription: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
