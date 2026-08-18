import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';

import { EmptyState, LoadingView } from '@/src/components/common';
import { AppScreen } from '@/src/components/layout';

import { useMyPageStore } from '../MyPageStore';

export function MyPageStateGuard({ children }: PropsWithChildren) {
  const { hasLoadError, isReady, reloadMyPage } = useMyPageStore();

  if (!isReady) {
    return (
      <AppScreen contentContainerStyle={styles.centered}>
        <LoadingView label="계정 정보를 확인하고 있어요." />
      </AppScreen>
    );
  }

  if (hasLoadError) {
    return (
      <AppScreen contentContainerStyle={styles.centered}>
        <EmptyState
          actionLabel="다시 시도"
          description="잠시 후 다시 시도해주세요."
          onActionPress={reloadMyPage}
          title="계정 정보를 불러오지 못했어요."
        />
      </AppScreen>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
});
