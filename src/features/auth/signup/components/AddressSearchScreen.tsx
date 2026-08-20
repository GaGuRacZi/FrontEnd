import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon, EmptyState } from '@/src/components/common';
import { AppScreen } from '@/src/components/layout/AppScreen';
import { TopHeader } from '@/src/components/layout/TopHeader';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { searchRemoteRegions, type RegionSearchResult } from '@/src/services/locationApi';

type AddressSearchScreenProps = {
  onBack: () => void;
  onSelect: (region: RegionSearchResult) => void;
};

export function AddressSearchScreen({ onBack, onSelect }: AddressSearchScreenProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RegionSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => subscription.remove();
  }, [onBack]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setResults([]);
      setLoading(false);
      setLoadError(false);
      return;
    }

    let active = true;
    setResults([]);
    setLoading(true);
    setLoadError(false);
    const timeoutId = setTimeout(() => {
      void searchRemoteRegions(normalizedQuery)
        .then((nextResults) => {
          if (active) setResults(nextResults);
        })
        .catch(() => {
          if (active) setLoadError(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [query, request]);

  return (
    <AppScreen edges={['top', 'bottom', 'left', 'right']} padded={false}>
      <TopHeader
        leftAccessibilityLabel="위치 정보 화면으로 돌아가기"
        leftIcon="chevron-back"
        onLeftPress={onBack}
        style={styles.header}
        title="지역 검색"
      />
      <View style={styles.content}>
        <View style={styles.searchField}>
          <AppIcon accessible={false} color={COLORS.gray500} name="search" size={22} />
          <TextInput
            accessibilityLabel="지역 검색"
            autoCorrect={false}
            autoFocus
            onChangeText={setQuery}
            placeholder="시·군·구를 검색해주세요"
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

        {loading ? (
          <View accessibilityLiveRegion="polite" style={styles.centered}>
            <ActivityIndicator accessibilityLabel="지역을 검색하고 있어요" color={COLORS.primary} />
          </View>
        ) : null}

        {!loading && loadError ? (
          <EmptyState
            actionLabel="다시 시도"
            description="인터넷 연결을 확인한 뒤 다시 시도해주세요."
            onActionPress={() => setRequest((current) => current + 1)}
            title="지역을 불러오지 못했어요"
          />
        ) : null}

        {!loading && !loadError && query.trim() && results.length === 0 ? (
          <EmptyState title="검색 결과가 없어요" />
        ) : null}

        {!loading && !loadError && results.length > 0 ? (
          <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled">
            {results.map((region) => (
              <Pressable
                accessibilityLabel={`${region.name} 선택`}
                accessibilityRole="button"
                key={region.code}
                onPress={() => onSelect(region)}
                style={({ pressed }) => [styles.result, pressed && styles.pressed]}
              >
                <Text style={styles.resultName}>{region.name}</Text>
                {region.dongPreview.length > 0 ? (
                  <Text numberOfLines={1} style={styles.resultPreview}>
                    {region.dongPreview.join(' · ')}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginHorizontal: SPACING.xxl,
  },
  content: {
    flex: 1,
    gap: SPACING.xxl,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    height: SIZE.inputHeight,
    paddingHorizontal: SPACING.xl,
  },
  searchInput: {
    ...TYPOGRAPHY.input,
    color: COLORS.black,
    flex: 1,
    height: '100%',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 0,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SIZE.touchTarget,
  },
  results: {
    gap: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  result: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.xs,
    minHeight: SIZE.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
  },
  resultName: {
    ...TYPOGRAPHY.body1,
    color: COLORS.black,
  },
  resultPreview: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  pressed: {
    opacity: 0.65,
  },
});
