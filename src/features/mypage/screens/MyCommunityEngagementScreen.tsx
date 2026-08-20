import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { AppIcon, EmptyState, LoadingView } from '@/src/components/common';
import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { useCommunityStore } from '@/src/features/community/CommunityStore';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import {
  filterActivityItems,
  getActivityFilterCounts,
  selectCommentedActivityItems,
  selectSavedActivityItems,
  type CommentedActivityItem,
  type CommunityActivityFilter,
  type CommunityActivityItem,
} from '../communityActivitySelectors';
import {
  CommunityActivityFilters,
  CommunityActivityList,
} from '../components/CommunityActivityList';
import { MyPageHeader } from '../components';
import { getRemoteMyPageActivityPostIds } from '../services/mypageActivityApi';

export type CommunityEngagementTab = 'commented' | 'saved';

const SAVED_FILTERS: { id: CommunityActivityFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'talk', label: '소통' },
  { id: 'market', label: '장터' },
];

function getEngagementTab(value?: string): CommunityEngagementTab {
  return value === 'commented' ? 'commented' : 'saved';
}

function getSavedFilter(value?: string): CommunityActivityFilter {
  return value === 'talk' || value === 'market' ? value : 'all';
}

export function MyCommunityEngagementScreen({
  initialFilter,
  initialTab,
}: {
  initialFilter?: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { currentUserId } = useAuthSession();
  const {
    comments,
    hasLoadError,
    isBookmarked,
    isReacted,
    isReady,
    loadComments,
    loadPostDetail,
    posts,
    reloadCommunity,
    viewerId,
  } = useCommunityStore();
  const activeTab = getEngagementTab(initialTab);
  const [savedFilter, setSavedFilter] = useState<CommunityActivityFilter>(() =>
    getSavedFilter(initialFilter),
  );
  const [loadingCommentActivity, setLoadingCommentActivity] = useState(false);
  const [activityPostIds, setActivityPostIds] = useState<ReadonlySet<string> | null>(null);
  const [hasActivityLoadError, setHasActivityLoadError] = useState(false);
  const [loadRequest, setLoadRequest] = useState(0);
  const savedItems = useMemo(
    () =>
      selectSavedActivityItems({
        isBookmarked,
        isReacted,
        postIds: activityPostIds ?? undefined,
        posts,
        userId: currentUserId,
        viewerId,
      }),
    [activityPostIds, currentUserId, isBookmarked, isReacted, posts, viewerId],
  );
  const commentedItems = useMemo(
    () =>
      selectCommentedActivityItems({
        comments,
        postIds: activityPostIds ?? undefined,
        posts,
        userId: currentUserId,
      }),
    [activityPostIds, comments, currentUserId, posts],
  );
  const savedCounts = useMemo(() => getActivityFilterCounts(savedItems), [savedItems]);
  const filteredSavedItems = useMemo(
    () => filterActivityItems(savedItems, savedFilter),
    [savedFilter, savedItems],
  );
  const items = activeTab === 'saved' ? filteredSavedItems : commentedItems;
  const screenTitle = activeTab === 'saved' ? '찜 보기' : '댓글 보기';

  useEffect(() => {
    setSavedFilter(getSavedFilter(initialFilter));
  }, [currentUserId, initialFilter, initialTab]);

  useEffect(() => {
    if (!isReady || hasLoadError) return;

    let active = true;
    setActivityPostIds(null);
    setHasActivityLoadError(false);
    setLoadingCommentActivity(activeTab === 'commented');
    void getRemoteMyPageActivityPostIds(activeTab)
      .then(async (postIds) => {
        const detailResults = await Promise.all(postIds.map((postId) => loadPostDetail(postId)));
        if (detailResults.some((result) => !result.ok)) {
          throw new Error('activity-post-load-failed');
        }
        if (activeTab === 'commented') {
          const commentResults = await Promise.all(postIds.map((postId) => loadComments(postId)));
          if (commentResults.some((result) => !result.ok)) {
            throw new Error('activity-comment-load-failed');
          }
        }
        if (active) setActivityPostIds(new Set(postIds));
      })
      .catch(() => {
        if (active) setHasActivityLoadError(true);
      })
      .finally(() => {
        if (active) setLoadingCommentActivity(false);
      });

    return () => {
      active = false;
    };
  }, [activeTab, hasLoadError, isReady, loadComments, loadPostDetail, loadRequest]);

  const openPost = (item: CommentedActivityItem | CommunityActivityItem) => {
    navigateOnce(() =>
      router.push({
        pathname: '/community/[postId]',
        params: {
          activitySection: 'engagement',
          activityTab: activeTab,
          activityFilter: savedFilter,
          kind: item.kind,
          origin: 'mypage-activity',
          postId: item.postId,
        },
      }),
    );
  };

  if (!isReady || activityPostIds === null || (activeTab === 'commented' && loadingCommentActivity)) {
    return (
      <MyPageHeader title={screenTitle}>
        <LoadingView label={`${screenTitle} 내역을 불러오고 있어요.`} />
      </MyPageHeader>
    );
  }

  if (hasLoadError || hasActivityLoadError) {
    return (
      <MyPageHeader title={screenTitle}>
        <EmptyState
          actionLabel="다시 시도"
          description="잠시 후 다시 활동 내역을 확인해주세요."
          icon={
            <AppIcon
              name={activeTab === 'saved' ? 'heart-outline' : 'chatbubble-ellipses-outline'}
              size={32}
            />
          }
          onActionPress={() => {
            void reloadCommunity();
            setLoadRequest((current) => current + 1);
          }}
          title="활동 내역을 불러오지 못했어요."
        />
      </MyPageHeader>
    );
  }

  return (
    <MyPageHeader title={screenTitle}>
      <CommunityActivityList
        emptyDescription={
          activeTab === 'saved'
            ? savedFilter === 'talk'
              ? '좋아요를 누른 소통 글이 없어요.'
              : savedFilter === 'market'
                ? '찜한 장터 글이 없어요.'
                : '소통 글에 좋아요를 누르거나 장터 글을 찜해보세요.'
            : '소통 글에 댓글이나 답글을 남겨보세요.'
        }
        emptyTitle={activeTab === 'saved' ? '찜한 글이 없어요' : '댓글 단 글이 없어요'}
        header={
          activeTab === 'saved' ? (
            <CommunityActivityFilters
              centered
              counts={savedCounts}
              filters={SAVED_FILTERS}
              minWidth={96}
              onSelect={setSavedFilter}
              selected={savedFilter}
            />
          ) : undefined
        }
        items={items}
        onItemPress={openPost}
      />
    </MyPageHeader>
  );
}
