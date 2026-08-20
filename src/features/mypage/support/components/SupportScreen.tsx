import type { Href } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { LoadingView } from '@/src/components/common';
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
  const { status } = useSupportStore();

  return (
    <MyPageHeader fallbackRoute={fallbackRoute} title={title}>
      {status === 'loading' ? <LoadingView label={loadingLabel} /> : null}
      {status === 'ready' ? children : null}
    </MyPageHeader>
  );
}
