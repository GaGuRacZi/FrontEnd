import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { useAppAlert } from '@/src/components/modal';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { SignupScaffold } from '../components/SignupScaffold';
import { useSignup } from '../SignupContext';

function isSignupCancelled(error: unknown) {
  return error instanceof Error && error.message === 'signup-cancelled';
}

export function SignupProfileScreen() {
  const router = useRouter();
  const showAlert = useAppAlert();
  const { data, updateProfileImage } = useSignup();
  const pickerOpen = useRef(false);

  const handlePickerResult = useCallback(
    async (
      result: ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult | null,
    ) => {
      if (!result) return;

      if ('code' in result) {
        showAlert('사진을 불러오지 못했어요', '잠시 후 다시 시도해주세요.');
        return;
      }

      if (!result.canceled && result.assets[0]) {
        await updateProfileImage(result.assets[0].uri);
      }
    },
    [showAlert, updateProfileImage],
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    void ImagePicker.getPendingResultAsync()
      .then(handlePickerResult)
      .catch((error) => {
        if (isSignupCancelled(error)) return;
        showAlert('사진을 저장하지 못했어요', '사진을 다시 선택해주세요.');
      });
  }, [handlePickerResult, showAlert]);

  const handleSelectPhoto = async () => {
    if (pickerOpen.current) return;

    pickerOpen.current = true;

    try {
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          showAlert(
            '사진 접근 권한이 필요해요',
            '설정에서 사진 접근 권한을 허용해주세요.',
            [
              { text: '취소', style: 'cancel' },
              { text: '설정 열기', onPress: () => void Linking.openSettings() },
            ],
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        allowsMultipleSelection: false,
        aspect: [1, 1],
        defaultTab: 'photos',
        mediaTypes: ['images'],
        quality: 0.8,
        selectionLimit: 1,
      });

      await handlePickerResult(result);
    } catch (error) {
      if (isSignupCancelled(error)) return;
      showAlert('사진을 저장하지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      pickerOpen.current = false;
    }
  };

  return (
    <SignupScaffold
      bodyStyle={styles.body}
      currentStep={2}
      onNext={() =>
        router.push(data.method === 'local' ? '/signup/credentials' : '/signup/user-info')
      }
      title="프로필 사진을 추가해보세요"
    >
      <Pressable
        accessibilityHint="기기에서 프로필 사진을 선택합니다"
        accessibilityLabel={data.profileImageUri ? '프로필 사진 변경' : '프로필 사진 등록'}
        accessibilityRole="button"
        onPress={handleSelectPhoto}
        style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
      >
        {data.profileImageUri ? (
          <Image source={{ uri: data.profileImageUri }} style={styles.profileImage} />
        ) : (
          <AppIcon color={COLORS.black} name="camera-outline" size={58} />
        )}
        {data.profileImageUri ? (
          <View style={styles.cameraBadge}>
            <AppIcon color={COLORS.background} name="camera" size={20} />
          </View>
        ) : null}
      </Pressable>

      <Text style={styles.guideTitle}>프로필 사진은 선택 사항이에요</Text>
      <Text style={styles.guideText}>사진은 언제든 추가하거나 변경할 수 있어요.</Text>
    </SignupScaffold>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
  },
  photoButton: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    elevation: 3,
    height: 214,
    justifyContent: 'center',
    marginTop: 88,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    width: 214,
  },
  profileImage: {
    borderRadius: RADIUS.round,
    height: '100%',
    width: '100%',
  },
  cameraBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderColor: COLORS.background,
    borderRadius: RADIUS.round,
    borderWidth: 2,
    bottom: SPACING.md,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: SPACING.md,
    width: 40,
  },
  guideTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
    marginTop: 48,
  },
  guideText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    marginTop: SPACING.md,
  },
  pressed: {
    opacity: 0.72,
  },
});
