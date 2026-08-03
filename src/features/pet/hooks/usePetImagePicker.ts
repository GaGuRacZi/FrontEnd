import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';

import { useAppAlert } from '@/src/components/modal';
import {
  clearPendingPetImagePicker,
  getPendingPetImagePicker,
  type PetImageField,
  setPendingPetImagePicker,
} from '../services/petImageStorage';

type UsePetImagePickerOptions = {
  draftId: string;
  enabled: boolean;
  onSelect: (field: PetImageField, uri: string) => Promise<void>;
  userId: string;
};

export function usePetImagePicker({
  draftId,
  enabled,
  onSelect,
  userId,
}: UsePetImagePickerOptions) {
  const showAlert = useAppAlert();
  const pickerOpen = useRef(false);

  const handleResult = useCallback(
    async (
      field: PetImageField,
      result: ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult | null,
    ) => {
      if (!result) return;

      if ('code' in result) {
        showAlert('사진을 불러오지 못했어요', '잠시 후 다시 시도해주세요.');
        return;
      }

      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;

      try {
        await onSelect(field, asset.uri);
      } catch {
        showAlert('사진을 저장하지 못했어요', '사진을 다시 선택해주세요.');
      }
    },
    [onSelect, showAlert],
  );

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled || !userId) return;

    let active = true;
    pickerOpen.current = true;

    void (async () => {
      try {
        const pending = await getPendingPetImagePicker();
        if (!pending) return;

        if (!active || pending.userId !== userId || pending.draftId !== draftId) return;

        try {
          const result = await ImagePicker.getPendingResultAsync();
          if (!active) return;
          await handleResult(pending.field, result);
        } finally {
          await clearPendingPetImagePicker(userId, draftId, pending.field);
        }
      } catch {
        if (active) showAlert('사진을 불러오지 못했어요', '사진을 다시 선택해주세요.');
      } finally {
        pickerOpen.current = false;
      }
    })();

    return () => {
      active = false;
    };
  }, [draftId, enabled, handleResult, showAlert, userId]);

  const pickImage = useCallback(
    async (field: PetImageField) => {
      if (!enabled || !userId || pickerOpen.current) return;
      pickerOpen.current = true;

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

        await setPendingPetImagePicker({ draftId, field, userId });
        const result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: field === 'profileImageUri',
          allowsMultipleSelection: false,
          aspect: field === 'profileImageUri' ? [1, 1] : undefined,
          defaultTab: 'photos',
          mediaTypes: ['images'],
          quality: 0.85,
          selectionLimit: 1,
        });

        await handleResult(field, result);
      } catch {
        showAlert('사진첩을 열지 못했어요', '잠시 후 다시 시도해주세요.');
      } finally {
        await clearPendingPetImagePicker(userId, draftId, field).catch(() => undefined);
        pickerOpen.current = false;
      }
    },
    [draftId, enabled, handleResult, showAlert, userId],
  );

  return { pickImage };
}
