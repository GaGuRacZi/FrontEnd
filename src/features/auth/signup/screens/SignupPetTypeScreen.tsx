import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { PetBreedPickerModal } from '@/src/features/pet/components/PetBreedPickerModal';

import { SignupScaffold } from '../components/SignupScaffold';
import type { PetType } from '../SignupContext';
import { useSignup } from '../SignupContext';
import { hasValidSignupPetType } from '../signupValidation';

const PET_IMAGES = {
  cat: require('@/assets/images/signup/pet-type-cat.png'),
  dog: require('@/assets/images/signup/pet-type-dog.png'),
} as const;

type PetTypeCardProps = {
  label: string;
  onPress: () => void;
  selected: boolean;
  type: Exclude<PetType, null>;
};

function PetTypeCard({ label, onPress, selected, type }: PetTypeCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.petCard,
        selected && styles.selectedPetCard,
        pressed && styles.pressed,
      ]}
    >
      <Image source={PET_IMAGES[type]} style={styles.petImage} />
      <Text style={styles.petLabel}>{label}</Text>
    </Pressable>
  );
}

export function SignupPetTypeScreen() {
  const router = useRouter();
  const { data, updateField } = useSignup();
  const [modalVisible, setModalVisible] = useState(false);

  const handlePetTypeChange = (petType: Exclude<PetType, null>) => {
    if (data.petType !== petType) {
      updateField('petType', petType);
      updateField('breed', '');
    }
  };

  return (
    <>
      <SignupScaffold
        bodyStyle={styles.body}
        currentStep={3}
        nextDisabled={!hasValidSignupPetType(data)}
        onNext={() => router.push('/signup/pet-info')}
        title={'반려동물의 정보를\n입력해주세요'}
      >
        <Text style={styles.sectionLabel}>반려동물 종류</Text>
        <View accessibilityRole="radiogroup" style={styles.petTypes}>
          <PetTypeCard
            label="강아지"
            onPress={() => handlePetTypeChange('dog')}
            selected={data.petType === 'dog'}
            type="dog"
          />
          <PetTypeCard
            label="고양이"
            onPress={() => handlePetTypeChange('cat')}
            selected={data.petType === 'cat'}
            type="cat"
          />
        </View>

        <Text style={[styles.sectionLabel, styles.breedLabel]}>품종 선택</Text>
        <Pressable
          accessibilityHint={data.petType ? '품종 검색 창을 엽니다' : '반려동물 종류를 먼저 선택해주세요'}
          accessibilityRole="button"
          accessibilityState={{ disabled: !data.petType }}
          disabled={!data.petType}
          onPress={() => setModalVisible(true)}
          style={({ pressed }) => [
            styles.breedSelector,
            !data.petType && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.breedText, data.breed && styles.selectedBreedText]}>
            {data.breed || '품종을 선택해 주세요.'}
          </Text>
          <AppIcon color={COLORS.black} name="chevron-down" size={22} />
        </Pressable>
      </SignupScaffold>

      {data.petType ? (
        <PetBreedPickerModal
          onClose={() => setModalVisible(false)}
          onSelect={(breed) => updateField('breed', breed)}
          petType={data.petType}
          selectedBreed={data.breed}
          visible={modalVisible}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    marginTop: 52,
  },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  petTypes: {
    flexDirection: 'row',
    gap: 42,
    marginTop: 22,
  },
  petCard: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    height: 128,
    justifyContent: 'center',
  },
  selectedPetCard: {
    backgroundColor: COLORS.cream,
    borderColor: COLORS.yellow,
  },
  petImage: {
    height: 68,
    resizeMode: 'contain',
    width: 76,
  },
  petLabel: {
    ...TYPOGRAPHY.input,
    color: COLORS.black,
    marginTop: SPACING.xs,
  },
  breedLabel: {
    marginTop: 54,
  },
  breedSelector: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    height: SIZE.inputHeight,
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xxl,
  },
  breedText: {
    ...TYPOGRAPHY.body1,
    color: COLORS.gray500,
  },
  selectedBreedText: {
    color: COLORS.black,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.72,
  },
});
