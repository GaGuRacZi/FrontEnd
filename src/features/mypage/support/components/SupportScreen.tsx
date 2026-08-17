import type { Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, LoadingView } from '@/src/components/common';
import { MyPageHeader } from '@/src/features/mypage/components';

import { useSupportStore } from '../SupportStore';

type SupportScreenProps = PropsWithChildren<{
  fallbackRoute?: Href;
  loadingLabel?: string;
  title: string;
}>;

export function SupportScreen({
  children,
  fallbackRoute,
  loadingLabel = '고객지원 정보를 불러오고 있어요.',
  title,
}: SupportScreenProps) {
  const { error, reloadSupport, status } = useSupportStore();

  return (
    <MyPageHeader fallbackRoute={fallbackRoute} title={title}>
      {status === 'loading' ? <LoadingView label={loadingLabel} /> : null}
      {status === 'error' ? (
        <View style={styles.centered}>
          <EmptyState
            actionLabel="다시 시도"
            description={error ?? undefined}
            onActionPress={reloadSupport}
            title="고객지원 정보를 불러오지 못했어요."
          />
        </View>
      ) : null}
      {status === 'ready' ? children : null}
    </MyPageHeader>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
});
