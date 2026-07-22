import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppButton,
  AppIcon,
  type AppIconName,
  EmptyState,
  LoadingView,
} from '@/src/components/common';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { AppModal } from '@/src/components/modal';
import { COLORS, LAYOUT, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import { PetAvatar } from '../components/PetAvatar';
import {
  PetCareInfoRow,
  PetChoiceButton,
  PetInfoCard,
  PetInfoRow,
} from '../components/PetInfoLayout';
import { PET_SELECTION_FIELDS } from '../petData';
import { usePetStore } from '../PetStore';
import type { PetEntity } from '../types';

type PetDetailScreenProps = {
  petId?: string;
};

type ReadOnlyFieldProps = {
  icon?: AppIconName;
  placeholder?: string;
  rightIcon?: AppIconName;
  value?: string | null;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getTypeLabel(pet: PetEntity) {
  return pet.type === 'dog' ? '강아지' : '고양이';
}

function ReadOnlyField({
  icon,
  placeholder = '미등록',
  rightIcon,
  value,
}: ReadOnlyFieldProps) {
  const hasValue = Boolean(value?.trim());

  return (
    <View style={styles.readOnlyField}>
      {icon ? (
        <View style={styles.readOnlyIcon}>
          <AppIcon color={COLORS.primary} name={icon} size={18} />
        </View>
      ) : null}
      <Text
        numberOfLines={1}
        style={[styles.readOnlyText, !hasValue && styles.placeholderText]}
      >
        {hasValue ? value : placeholder}
      </Text>
      {rightIcon ? <AppIcon color={COLORS.gray600} name={rightIcon} size={19} /> : null}
    </View>
  );
}

function DetailProfile({ pet }: { pet: PetEntity }) {
  return (
    <View style={styles.profileArea}>
      <PetAvatar pet={pet} size={102} />
      <Text numberOfLines={1} style={styles.petName}>
        {pet.name}
      </Text>
      <Text numberOfLines={1} style={styles.profileDescription}>
        {getTypeLabel(pet)} · {pet.breed}
      </Text>
    </View>
  );
}

function CertificatePreview({ uri }: { uri: string | null }) {
  return (
    <View
      accessibilityLabel={uri ? '등록된 동물등록증 사진' : '동물등록증 사진 없음'}
      style={styles.certificatePreview}
    >
      {uri ? (
        <Image resizeMode="cover" source={{ uri }} style={styles.certificateImage} />
      ) : (
        <>
          <AppIcon color={COLORS.gray500} name="camera-outline" size={21} />
          <Text style={styles.certificateLabel}>사진 없음</Text>
        </>
      )}
    </View>
  );
}

export function PetDetailScreen({ petId: petIdProp }: PetDetailScreenProps) {
  const params = useLocalSearchParams<{ petId?: string | string[] }>();
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { deletePet, hasLoadError, isReady, pets, reloadPets } = usePetStore();
  const petId = petIdProp ?? readParam(params.petId);
  const pet = useMemo(() => pets.find((item) => item.id === petId), [petId, pets]);
  const missingAlertShown = useRef(false);
  const deleteLock = useRef(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isLastPet = pets.length <= 1;

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/mypage');
  }, [router]);

  useEffect(() => {
    if (
      !isReady ||
      hasLoadError ||
      pet ||
      deleteLock.current ||
      missingAlertShown.current
    ) {
      return;
    }

    missingAlertShown.current = true;
    Alert.alert(
      '반려동물을 찾을 수 없어요',
      '삭제되었거나 존재하지 않는 반려동물이에요.',
      [{ text: '확인', onPress: goBack }],
    );
  }, [goBack, hasLoadError, isReady, pet]);

  const handleDelete = async () => {
    if (!pet || deleteLock.current) return;

    deleteLock.current = true;
    missingAlertShown.current = true;
    setIsDeleting(true);

    try {
      const result = await deletePet(pet.id);

      if (result.ok) {
        setDeleteModalVisible(false);
        goBack();
        return;
      }

      if (result.reason !== 'last-pet') {
        setDeleteModalVisible(false);
        Alert.alert('삭제하지 못했어요', '잠시 후 다시 시도해주세요.');
      }
      missingAlertShown.current = false;
    } catch {
      missingAlertShown.current = false;
      setDeleteModalVisible(false);
      Alert.alert('삭제하지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      deleteLock.current = false;
      setIsDeleting(false);
    }
  };

  if (!isReady) {
    return (
      <AppScreen padded={false}>
        <LoadingView label="반려동물 정보를 불러오는 중이에요" />
      </AppScreen>
    );
  }

  if (hasLoadError) {
    return (
      <AppScreen padded={false}>
        <TopHeader
          leftAccessibilityLabel="이전 화면으로 이동"
          leftIcon="chevron-back"
          onLeftPress={goBack}
          style={styles.header}
          title="반려동물 상세"
          titleStyle={styles.headerTitle}
        />
        <View style={styles.emptyContainer}>
          <EmptyState
            actionLabel="다시 시도"
            description="저장된 정보를 다시 불러온 뒤 확인할 수 있어요."
            onActionPress={reloadPets}
            title="반려동물 정보를 불러오지 못했어요"
          />
        </View>
      </AppScreen>
    );
  }

  if (!pet) {
    return (
      <AppScreen padded={false}>
        <TopHeader
          leftAccessibilityLabel="이전 화면으로 이동"
          leftIcon="chevron-back"
          onLeftPress={goBack}
          style={styles.header}
          title="반려동물 상세"
          titleStyle={styles.headerTitle}
        />
        <View style={styles.emptyContainer}>
          <EmptyState title="반려동물 정보를 찾을 수 없어요" />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen padded={false}>
      <TopHeader
        leftAccessibilityLabel="이전 화면으로 이동"
        leftIcon="chevron-back"
        onLeftPress={goBack}
        rightContent={
          <Pressable
            accessibilityLabel="반려동물 정보 수정"
            accessibilityRole="button"
            onPress={() =>
              navigateOnce(() =>
                router.push(`/pet/${encodeURIComponent(pet.id)}/edit` as Href),
              )
            }
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Text style={styles.editButtonText}>수정</Text>
          </Pressable>
        }
        style={styles.header}
        title="반려동물 상세"
        titleStyle={styles.headerTitle}
      />

      <ScrollView
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <DetailProfile pet={pet} />

          <PetInfoCard
            description="건강 기록과 알림에 꼭 필요한 정보예요"
            minHeight={362}
            title="기본 정보"
          >
            <PetInfoRow label="반려동물">
              <View style={styles.choiceRow}>
                <PetChoiceButton label="강아지" selected={pet.type === 'dog'} />
                <PetChoiceButton label="고양이" selected={pet.type === 'cat'} />
              </View>
            </PetInfoRow>

            <PetInfoRow label="이름">
              <ReadOnlyField value={pet.name} />
            </PetInfoRow>

            <PetInfoRow label="견/묘종">
              <ReadOnlyField value={pet.breed} />
            </PetInfoRow>

            <PetInfoRow label="생년월일">
              <ReadOnlyField rightIcon="calendar-clear-outline" value={pet.birthDate} />
            </PetInfoRow>

            <PetInfoRow label="몸무게">
              <View style={styles.weightRow}>
                <View style={styles.weightField}>
                  <ReadOnlyField value={String(pet.weight)} />
                </View>
                <Text style={styles.weightUnit}>kg</Text>
              </View>
            </PetInfoRow>
          </PetInfoCard>

          <PetInfoCard
            description="헌혈 매칭과 병원 기록에 활용돼요"
            minHeight={264}
            title="성별·의료 정보"
          >
            <PetInfoRow label="성별">
              <View style={styles.choiceRow}>
                <PetChoiceButton compact label="남아" selected={pet.gender === 'male'} />
                <PetChoiceButton compact label="여아" selected={pet.gender === 'female'} />
              </View>
            </PetInfoRow>

            <PetInfoRow label="중성화">
              <View style={styles.choiceRow}>
                <PetChoiceButton compact label="완료" selected={pet.neutered} />
                <PetChoiceButton compact label="안함" selected={!pet.neutered} />
              </View>
            </PetInfoRow>

            <PetInfoRow label="혈액형">
              <ReadOnlyField icon="water-outline" placeholder="선택 안함" value={pet.bloodType} />
            </PetInfoRow>
          </PetInfoCard>

          <PetInfoCard
            description="등록증을 사진과 함께 보관하면 병원 방문 때 편해요"
            minHeight={178}
            title="동물등록증"
          >
            <View style={styles.registrationContent}>
              <View style={styles.registrationInputs}>
                <ReadOnlyField placeholder="보호자 이름 미등록" value={pet.ownerName} />
                <ReadOnlyField placeholder="등록번호 미등록" value={pet.registrationNumber} />
              </View>
              <CertificatePreview uri={pet.certificateImageUri} />
            </View>
          </PetInfoCard>

          <PetInfoCard
            description="AI 성분 분석과 건강 추천에 연결돼요"
            minHeight={335}
            title="먹거리·관리 정보"
          >
            <View style={styles.careList}>
              {PET_SELECTION_FIELDS.map((field) => (
                <PetCareInfoRow field={field} key={field} values={pet[field]} />
              ))}
            </View>
          </PetInfoCard>

          <AppButton
            leftIcon={<AppIcon color={COLORS.error} name="trash-outline" size={20} />}
            onPress={() => setDeleteModalVisible(true)}
            style={styles.deleteButton}
            title="반려동물 삭제"
            variant="outline"
          />
        </View>
      </ScrollView>

      <AppModal
        closeOnBackdropPress={!isDeleting}
        onClose={() => {
          if (!isDeleting) setDeleteModalVisible(false);
        }}
        primaryAction={
          isLastPet
            ? {
                label: '확인',
                onPress: () => setDeleteModalVisible(false),
              }
            : {
                label: '삭제',
                loading: isDeleting,
                onPress: handleDelete,
              }
        }
        secondaryAction={
          isLastPet
            ? undefined
            : {
                disabled: isDeleting,
                label: '취소',
                onPress: () => setDeleteModalVisible(false),
              }
        }
        title={isLastPet ? '삭제할 수 없어요' : '반려동물을 삭제할까요?'}
        variant="center"
        visible={deleteModalVisible}
      >
        <Text style={styles.modalDescription}>
          {isLastPet
            ? '앱을 사용하려면\n최소 한 마리의 반려동물 정보가 필요해요.'
            : `${pet.name}의 정보와 저장된 사진이 모두 삭제돼요.`}
        </Text>
      </AppModal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingBottom: SPACING.jumbo * 2,
  },
  header: {
    paddingHorizontal: LAYOUT.screenPaddingHorizontal,
  },
  headerTitle: {
    ...TYPOGRAPHY.authTitle,
  },
  content: {
    gap: 10,
    paddingHorizontal: LAYOUT.screenPaddingHorizontal,
  },
  editButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  editButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.primary,
  },
  profileArea: {
    alignItems: 'center',
    minHeight: 168,
    paddingVertical: SPACING.xxl,
  },
  petName: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
    marginTop: SPACING.md,
    maxWidth: '85%',
  },
  profileDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    maxWidth: '85%',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  readOnlyField: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 44,
    paddingHorizontal: 13,
  },
  readOnlyIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 28,
    justifyContent: 'center',
    marginRight: SPACING.md,
    width: 28,
  },
  readOnlyText: {
    ...TYPOGRAPHY.input,
    color: COLORS.black,
    flex: 1,
  },
  placeholderText: {
    color: COLORS.gray500,
  },
  weightRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SPACING.md,
  },
  weightField: {
    flex: 1,
  },
  weightUnit: {
    ...TYPOGRAPHY.input,
    color: COLORS.gray800,
    paddingTop: 11,
  },
  registrationContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  registrationInputs: {
    flex: 1,
    flexBasis: 194,
    gap: 10,
    maxWidth: 194,
    minWidth: 180,
  },
  certificatePreview: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: SPACING.md,
    height: 98,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 122,
  },
  certificateImage: {
    height: '100%',
    width: '100%',
  },
  certificateLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
  },
  careList: {
    gap: SPACING.md,
  },
  deleteButton: {
    marginTop: SPACING.xxl,
  },
  modalDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
});
