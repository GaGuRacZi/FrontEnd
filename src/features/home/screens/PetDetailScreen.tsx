import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { ScreenLayout } from '@/src/components/layout';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { PetDetailProfileCard } from '../components/PetDetailProfileCard';
import { PetMedicalInfoCard } from '../components/PetMedicalInfoCard';
import { PetRegistrationCard } from '../components/PetRegistrationCard';
import { MOCK_PET_DETAIL } from '../mock';

export function PetDetailScreen() {
  const pet = MOCK_PET_DETAIL;

  return (
    <ScreenLayout
      headerVariant="auth"
      rightContent={
        <Pressable
          accessibilityLabel="반려동물 정보 수정"
          accessibilityRole="button"
          onPress={() => {
            // TODO: 수정 화면 라우팅 연결
          }}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
        >
          <Text style={styles.editButtonText}>수정</Text>
        </Pressable>
      }
      title="상세 정보"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <PetDetailProfileCard pet={pet} />
        <PetMedicalInfoCard pet={pet} />
        <PetRegistrationCard
          onPressGuardian={() => {}}
          onPressPhoto={() => {}}
          onPressRegistrationNumber={() => {}}
          pet={pet}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: SPACING.xxl, paddingBottom: SPACING.xxxl },
  editButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
  },
  pressed: { opacity: 0.7 },
  editButtonText: { ...TYPOGRAPHY.label, color: COLORS.primary },
});