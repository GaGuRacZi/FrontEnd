import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import { AppModal } from '@/src/components/modal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';

import { searchRemoteBreeds, type RemoteBreed } from '../services/petApi';
import type { PetType } from '../types';

type PetBreedPickerModalProps = {
  onClose: () => void;
  onSelect: (breed: string) => void;
  petType: PetType;
  selectedBreed: string;
  visible: boolean;
};

export function PetBreedPickerModal({
  onClose,
  onSelect,
  petType,
  selectedBreed,
  visible,
}: PetBreedPickerModalProps) {
  const [query, setQuery] = useState('');
  const [breeds, setBreeds] = useState<RemoteBreed[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [request, setRequest] = useState(0);
  const popularBreeds = useMemo(() => breeds.filter((breed) => breed.popular), [breeds]);

  useEffect(() => {
    if (!visible) return;

    let active = true;
    setBreeds([]);
    setLoading(true);
    setLoadError(false);
    const timeoutId = setTimeout(() => {
      void searchRemoteBreeds(petType, query)
        .then((nextBreeds) => {
          if (active) setBreeds(nextBreeds);
        })
        .catch(() => {
          if (active) setLoadError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, query.trim() ? 250 : 0);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [petType, query, request, visible]);

  const close = () => {
    setQuery('');
    setLoadError(false);
    onClose();
  };

  const select = (breed: string) => {
    onSelect(breed);
    close();
  };

  return (
    <AppModal
      animateSheetOnly
      initialHeight={570}
      onClose={close}
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
            hitSlop={SPACING.md}
            onPress={() => setQuery('')}
          >
            <AppIcon color={COLORS.gray500} name="close-circle-outline" size={24} />
          </Pressable>
        ) : null}
      </View>

      {popularBreeds.length > 0 ? <Text style={styles.sectionTitle}>인기 품종</Text> : null}
      {popularBreeds.length > 0 ? (
        <View style={styles.chips}>
          {popularBreeds.map((breed) => {
            const selected = breed.name === selectedBreed;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={breed.id}
                onPress={() => select(breed.name)}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.selectedChip,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, selected && styles.selectedText]}>
                  {breed.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.resultHeader}>
        <Text style={styles.sectionTitle}>검색 결과</Text>
        <Text style={styles.resultCount}>{breeds.length}개</Text>
      </View>
      <View style={styles.results}>
        {breeds.map((breed) => {
          const selected = breed.name === selectedBreed;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={breed.id}
              onPress={() => select(breed.name)}
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
        {loading ? (
          <View style={styles.emptyResult}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : null}
        {!loading && loadError ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setRequest((current) => current + 1)}
            style={styles.emptyResult}
          >
            <Text style={styles.emptyText}>품종을 불러오지 못했어요. 다시 시도해주세요.</Text>
          </Pressable>
        ) : null}
        {!loading && !loadError && breeds.length === 0 ? (
          <View style={styles.emptyResult}>
            <Text style={styles.emptyText}>검색 결과가 없어요</Text>
          </View>
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
