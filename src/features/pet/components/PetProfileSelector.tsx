import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { usePetStore } from '../PetStore';
import { PetAvatar } from './PetAvatar';
import { PetSwitcherSheet } from './PetSwitcherSheet';

export function PetProfileSelector() {
  const { selectedPet } = usePetStore();
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityLabel={selectedPet ? `${selectedPet.name} 반려동물 전환` : '반려동물 등록 및 선택'}
        accessibilityRole="button"
        onPress={() => setSheetVisible(true)}
        style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
      >
        <PetAvatar pet={selectedPet} size={32} />
        <Text numberOfLines={1} style={styles.name}>
          {selectedPet?.name ?? '반려동물'}
        </Text>
        <AppIcon color={COLORS.gray800} name="chevron-down" size={16} />
      </Pressable>
      <PetSwitcherSheet onClose={() => setSheetVisible(false)} visible={sheetVisible} />
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    alignItems: 'center',
    borderRadius: RADIUS.activeTab,
    flexDirection: 'row',
    gap: SPACING.sm,
    height: 42,
    paddingHorizontal: SPACING.sm,
    width: 176,
  },
  name: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
    flex: 1,
  },
  pressed: {
    opacity: 0.58,
  },
});
