import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/src/components/common/AppIcon';
import { AppModal } from '@/src/components/modal/AppModal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { PetType } from '../SignupContext';
import { MOCK_BREEDS } from '../signupData';

type BreedPickerModalProps = {
  onClose: () => void;
  onSelect: (breed: string) => void;
  petType: Exclude<PetType, null>;
  selectedBreed: string;
  visible: boolean;
};

export function BreedPickerModal({
  onClose,
  onSelect,
  petType,
  selectedBreed,
  visible,
}: BreedPickerModalProps) {
  const [query, setQuery] = useState('');
  const breeds = MOCK_BREEDS[petType];
  const popularBreeds = breeds.filter((breed) => breed.popular);
  const filteredBreeds = useMemo(() => {
    const normalizedQuery = query.trim().replace(/\s/g, '').toLowerCase();

    if (!normalizedQuery) return breeds;

    return breeds.filter((breed) =>
      breed.name.replace(/\s/g, '').toLowerCase().includes(normalizedQuery),
    );
  }, [breeds, query]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handleSelect = (breed: string) => {
    onSelect(breed);
    handleClose();
  };

  return (
    <AppModal
      initialHeight={570}
      onClose={handleClose}
      resizable
      title={petType === 'dog' ? '견종 검색' : '묘종 검색'}
      visible={visible}
    >
      <Text style={styles.subtitle}>{petType === 'dog' ? '강아지 품종' : '고양이 품종'}</Text>

      <View style={styles.searchField}>
        <AppIcon accessible={false} color={COLORS.gray500} name="search" size={22} />
        <TextInput
          accessibilityLabel="품종 검색"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="품종을 검색해주세요"
          placeholderTextColor={COLORS.gray500}
          style={styles.searchInput}
          value={query}
        />
        {query ? (
          <Pressable
            accessibilityLabel="검색어 지우기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setQuery('')}
          >
            <AppIcon color={COLORS.gray500} name="close-circle-outline" size={24} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>인기 품종</Text>
      <View style={styles.chips}>
        {popularBreeds.map((breed) => {
          const selected = breed.name === selectedBreed;

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={breed.name}
              onPress={() => handleSelect(breed.name)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.selectedChip,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, selected && styles.selectedText]}>{breed.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.resultHeader}>
        <Text style={styles.sectionTitle}>검색 결과</Text>
        <Text style={styles.resultCount}>{filteredBreeds.length}개</Text>
      </View>
      <View style={styles.results}>
        {filteredBreeds.map((breed) => {
          const selected = breed.name === selectedBreed;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={breed.name}
              onPress={() => handleSelect(breed.name)}
              style={({ pressed }) => [
                styles.result,
                selected && styles.selectedResult,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.resultText, selected && styles.selectedText]}>{breed.name}</Text>
              {selected ? (
                <AppIcon color={COLORS.primary} name="checkmark-circle" size={22} />
              ) : null}
            </Pressable>
          );
        })}
        {filteredBreeds.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => handleSelect('기타')}
            style={({ pressed }) => [styles.emptyResult, pressed && styles.pressed]}
          >
            <Text style={styles.emptyText}>찾는 품종이 없어요</Text>
          </Pressable>
        ) : null}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    height: 48,
    paddingHorizontal: SPACING.xl,
  },
  searchInput: {
    ...TYPOGRAPHY.input,
    color: COLORS.black,
    flex: 1,
    height: '100%',
    paddingHorizontal: SPACING.xl,
    paddingVertical: 0,
  },
  sectionTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  chip: {
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  selectedChip: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.sub,
  },
  chipText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  selectedText: {
    color: COLORS.primary,
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
  },
  results: {
    gap: SPACING.sm,
  },
  result: {
    alignItems: 'center',
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    height: 50,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xxl,
  },
  selectedResult: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.sub,
  },
  resultText: {
    ...TYPOGRAPHY.input,
    color: COLORS.black,
  },
  emptyResult: {
    alignItems: 'center',
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    height: SIZE.touchTarget,
    justifyContent: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  pressed: {
    opacity: 0.65,
  },
});
