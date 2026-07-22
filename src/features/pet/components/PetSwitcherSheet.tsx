import { type Href, useRouter } from 'expo-router';
import { useRef } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { AppModal } from '@/src/components/modal/AppModal';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import { MAX_PETS_PER_USER, usePetStore } from '../PetStore';
import type { PetEntity } from '../types';
import { PetAvatar } from './PetAvatar';

type PetSwitcherSheetProps = {
  onClose: () => void;
  visible: boolean;
};

type PetRowProps = {
  onManage: (pet: PetEntity) => void;
  onSelect: (pet: PetEntity) => void;
  pet: PetEntity;
  selected: boolean;
};

function PetRow({ onManage, onSelect, pet, selected }: PetRowProps) {
  return (
    <Pressable
      accessibilityLabel={`${pet.name} 선택`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(pet)}
      style={({ pressed }) => [styles.petRow, pressed && styles.pressed]}
    >
      <PetAvatar pet={pet} size={62} />
      <Text numberOfLines={1} style={styles.petName}>
        {pet.name}
      </Text>
      <View style={[styles.selectedMark, selected && styles.selectedMarkActive]}>
        {selected ? <AppIcon color={COLORS.background} name="checkmark" size={21} /> : null}
      </View>
      <Pressable
        accessibilityLabel={`${pet.name} 정보 관리`}
        accessibilityRole="button"
        hitSlop={SPACING.md}
        onPress={(event) => {
          event.stopPropagation();
          onManage(pet);
        }}
        style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}
      >
        <AppIcon color={COLORS.gray600} name="chevron-forward" size={20} />
      </Pressable>
    </Pressable>
  );
}

export function PetSwitcherSheet({ onClose, visible }: PetSwitcherSheetProps) {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { currentUserId } = useAuthSession();
  const {
    hasLoadError,
    isReady,
    pets,
    reloadPets,
    selectedPetId,
    selectPet,
  } = usePetStore();
  const selectingRef = useRef(false);
  const reachedLimit = pets.length >= MAX_PETS_PER_USER;
  const addDisabled = hasLoadError || reachedLimit || !isReady || !currentUserId;
  const hasLimitMessage = !hasLoadError && (!currentUserId || reachedLimit);
  const rowCount = Math.max(1, pets.length);
  const initialHeight = Math.min(560, 124 + rowCount * 75 + (hasLimitMessage ? 32 : 0));

  const handleSelect = async (pet: PetEntity) => {
    if (selectingRef.current) return;
    selectingRef.current = true;

    try {
      const result = await selectPet(pet.id);
      if (result.ok) {
        onClose();
        return;
      }
      Alert.alert('선택하지 못했어요', '반려동물 목록을 다시 확인해주세요.');
    } catch {
      Alert.alert('선택하지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      selectingRef.current = false;
    }
  };

  const handleManage = (pet: PetEntity) => {
    navigateOnce(() => {
      onClose();
      router.push(`/pet/${encodeURIComponent(pet.id)}` as Href);
    });
  };

  const handleAdd = () => {
    if (addDisabled) return;
    navigateOnce(() => {
      onClose();
      router.push('/pet/add' as Href);
    });
  };

  return (
    <AppModal
      animateSheetOnly
      contentContainerStyle={styles.modalContent}
      initialHeight={initialHeight}
      onClose={onClose}
      resizable
      surfaceStyle={styles.modalSurface}
      visible={visible}
    >
      <View style={styles.sheetContent}>
        {!isReady ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={COLORS.primary} size="small" />
          </View>
        ) : hasLoadError ? (
          <View style={styles.loadErrorRow}>
            <Text style={styles.loadErrorText}>반려동물 목록을 불러오지 못했어요.</Text>
            <Pressable
              accessibilityLabel="반려동물 목록 다시 불러오기"
              accessibilityRole="button"
              onPress={reloadPets}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : pets.length ? (
          <View style={styles.petList}>
            {pets.map((pet) => (
              <PetRow
                key={pet.id}
                onManage={handleManage}
                onSelect={(nextPet) => void handleSelect(nextPet)}
                pet={pet}
                selected={pet.id === selectedPetId}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>등록된 반려동물이 없어요.</Text>
        )}

        <Pressable
          accessibilityLabel={
            hasLoadError
              ? '반려동물 목록을 먼저 다시 불러와주세요'
              : !currentUserId
              ? '로그인 후 반려동물을 등록할 수 있어요'
              : reachedLimit
                ? '반려동물은 최대 10마리까지 등록할 수 있어요'
                : '반려동물 추가하기'
          }
          accessibilityRole="button"
          accessibilityState={{ disabled: addDisabled }}
          disabled={addDisabled}
          onPress={handleAdd}
          style={({ pressed }) => [
            styles.addRow,
            addDisabled && styles.addRowDisabled,
            pressed && styles.pressed,
          ]}
        >
          <AppIcon color={COLORS.gray600} name="add" size={24} />
          <Text style={styles.addLabel}>반려동물 추가하기</Text>
        </Pressable>

        {hasLimitMessage ? (
          <Text accessibilityLiveRegion="polite" style={styles.limitText}>
            {currentUserId
              ? '반려동물은 최대 10마리까지 등록할 수 있어요.'
              : '로그인 후 반려동물을 등록할 수 있어요.'}
          </Text>
        ) : null}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    gap: 0,
  },
  modalSurface: {
    paddingHorizontal: 0,
    paddingTop: SPACING.xxl,
  },
  sheetContent: {
    gap: 0,
  },
  petList: {
    gap: 0,
  },
  petRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 75,
    paddingLeft: 28,
    paddingRight: 20,
  },
  petName: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
    flex: 1,
    marginLeft: 18,
  },
  selectedMark: {
    alignItems: 'center',
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    marginRight: SPACING.xl,
    width: 34,
  },
  selectedMarkActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  manageButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 20,
  },
  addRow: {
    alignItems: 'center',
    borderColor: COLORS.gray300,
    borderTopWidth: 1,
    flexDirection: 'row',
    height: 60,
    marginTop: 9,
    paddingHorizontal: 32,
  },
  addRowDisabled: {
    opacity: 0.45,
  },
  addLabel: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray600,
    flex: 1,
    marginLeft: SPACING.lg,
  },
  statusRow: {
    alignItems: 'center',
    height: 75,
    justifyContent: 'center',
  },
  loadErrorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 75,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  loadErrorText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    flex: 1,
  },
  retryButton: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  retryText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  emptyText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    height: 75,
    lineHeight: 75,
    textAlign: 'center',
  },
  limitText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    height: 32,
    lineHeight: 32,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.58,
  },
});
