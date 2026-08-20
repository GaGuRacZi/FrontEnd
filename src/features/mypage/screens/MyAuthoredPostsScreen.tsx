import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { useCommunityStore } from '@/src/features/community/CommunityStore';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import {
  filterActivityItems,
  getActivityFilterCounts,
  selectAuthoredActivityItems,
  type CommunityActivityFilter,
  type CommunityActivityItem,
} from '../communityActivitySelectors';
import {
  CommunityActivityFilters,
  CommunityActivityList,
} from '../components/CommunityActivityList';
import { MyPageHeader } from '../components';
import { getRemoteMyPageActivityPostIds } from '../services/mypageActivityApi';

const FILTERS: { id: CommunityActivityFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'talk', label: '소통' },
  { id: 'market', label: '장터' },
];

function getAuthoredFilter(value?: string): CommunityActivityFilter {
  return value === 'talk' || value === 'market' ? value : 'all';
}

export function MyAuthoredPostsScreen({ initialFilter }: { initialFilter?: string }) {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { currentUserId } = useAuthSession();
  const {
    hasLoadError,
    isReady,
    loadPostDetail,
    posts,
    reloadCommunity,
  } = useCommunityStore();
  const [filter, setFilter] = useState<CommunityActivityFilter>(() =>
    getAuthoredFilter(initialFilter),
  );
  const [activityPostIds, setActivityPostIds] = useState<ReadonlySet<string> | null>(null);
  const [hasActivityLoadError, setHasActivityLoadError] = useState(false);
  const [loadRequest, setLoadRequest] = useState(0);
  const items = useMemo(
    () =>
      selectAuthoredActivityItems({
        postIds: activityPostIds ?? undefined,
        posts,
        userId: currentUserId,
      }),
    [activityPostIds, currentUserId, posts],
  );
  const counts = useMemo(() => getActivityFilterCounts(items), [items]);
  const filteredItems = useMemo(() => filterActivityItems(items, filter), [filter, items]);

  useEffect(() => {
    setFilter(getAuthoredFilter(initialFilter));
  }, [currentUserId, initialFilter]);

  useEffect(() => {
    if (!isReady) return;

    let active = true;
    setActivityPostIds(null);
    setHasActivityLoadError(false);
    void getRemoteMyPageActivityPostIds('authored')
      .then(async (postIds) => {
        const results = await Promise.all(postIds.map((postId) => loadPostDetail(postId)));
        if (results.some((result) => !result.ok)) throw new Error('activity-post-load-failed');
        if (active) setActivityPostIds(new Set(postIds));
      })
      .catch(() => {
        if (active) setHasActivityLoadError(true);
      });

    return () => {
      active = false;
    };
  }, [isReady, loadPostDetail, loadRequest]);

  const openPost = (item: CommunityActivityItem) => {
    navigateOnce(() =>
      router.push({
        pathname: '/community/[postId]',
        params: {
          activitySection: 'authored',
          activityFilter: filter,
          kind: item.kind,
          origin: 'mypage-activity',
          postId: item.postId,
        },
      }),
    );
  };

  if (!isReady || activityPostIds === null) {
    return (
      <MyPageHeader title="작성글 보기">
        <LoadingView label="작성글을 불러오고 있어요." />
      </MyPageHeader>
    );
  }

  if (hasLoadError || hasActivityLoadError) {
    return (
      <MyPageHeader title="작성글 보기">
        <EmptyState
          actionLabel="다시 시도"
          description="잠시 후 다시 작성글을 확인해주세요."
          icon={<AppIcon name="document-text-outline" size={32} />}
          onActionPress={() => {
            void reloadCommunity();
            setLoadRequest((current) => current + 1);
          }}
          title="작성글을 불러오지 못했어요."
        />
      </MyPageHeader>
    );
  }

  return (
    <MyPageHeader title="작성글 보기">
      <CommunityActivityList
        emptyDescription={
          filter === 'all'
            ? '소통·장터에서 첫 글을 남겨보세요.'
            : `${FILTERS.find((item) => item.id === filter)?.label}에 작성한 글이 없어요.`
        }
        emptyTitle="작성한 글이 없어요"
        header={
          <CommunityActivityFilters
            counts={counts}
            filters={FILTERS}
            minWidth={86}
            onSelect={setFilter}
            selected={filter}
          />
        }
        items={filteredItems}
        onItemPress={openPost}
      />
    </MyPageHeader>
  );
}
