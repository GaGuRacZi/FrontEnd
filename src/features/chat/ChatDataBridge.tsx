import { useEffect, useMemo } from 'react';

import { useAuthSession } from '@/src/features/auth/session/AuthSessionStore';
import { useCommunityStore } from '@/src/features/community/CommunityStore';
import { createCommunityAuthor } from '@/src/features/community/utils/author';
import { useMyPageStore } from '@/src/features/mypage/MyPageStore';
import { usePetStore } from '@/src/features/pet/PetStore';

import { useChatStore } from './ChatStore';
import { toChatParticipant, toChatPostReference } from './communityAdapter';

export function ChatDataBridge() {
  const { currentUserId } = useAuthSession();
  const {
    getCommentCount,
    hasLoadError: hasCommunityLoadError,
    isReady: isCommunityReady,
    posts,
  } = useCommunityStore();
  const { isReady: isProfileReady, profile } = useMyPageStore();
  const { isReady: isPetReady, selectedPet } = usePetStore();
  const {
    isReady: isChatReady,
    markPostDeleted,
    rooms,
    syncParticipant,
    syncPostReference,
  } = useChatStore();
  const livePosts = useMemo(
    () => new Map(posts.map((post) => [post.id, post])),
    [posts],
  );
  const participantIdsKey = useMemo(
    () =>
      [...new Set(rooms.flatMap((room) => room.participants.map(({ userId }) => userId)))]
        .sort()
        .join('\u0000'),
    [rooms],
  );
  const postIdsKey = useMemo(
    () =>
      [...new Set(rooms.flatMap((room) => room.postReference?.postId ?? []))]
        .sort()
        .join('\u0000'),
    [rooms],
  );

  useEffect(() => {
    if (!currentUserId || !isChatReady || !isCommunityReady || hasCommunityLoadError) return;

    const participantIds = new Set(participantIdsKey ? participantIdsKey.split('\u0000') : []);
    const participants = new Map(
      posts
        .filter((post) => participantIds.has(post.author.userId))
        .map((post) => [post.author.userId, toChatParticipant(post.author)]),
    );
    if (participantIds.has(currentUserId) && profile && isProfileReady && isPetReady) {
      participants.set(
        currentUserId,
        toChatParticipant(createCommunityAuthor(profile, selectedPet, currentUserId)),
      );
    }

    const operations = [...participants.values()].map(
      (participant) => () => syncParticipant(participant),
    );
    const referenceIds = postIdsKey ? postIdsKey.split('\u0000') : [];

    referenceIds.forEach((postId) => {
      const post = livePosts.get(postId);
      operations.push(() =>
        post
          ? syncPostReference(
              toChatPostReference(
                post,
                'kind' in post && post.kind === 'talk'
                  ? getCommentCount(post.id)
                  : undefined,
              ),
            )
          : markPostDeleted(postId),
      );
    });

    let active = true;
    void (async () => {
      let pendingOperations = operations;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!active) return;
        const results = await Promise.all(
          pendingOperations.map((operation) => operation()),
        );
        if (!active) return;
        pendingOperations = pendingOperations.filter((_, index) => !results[index].ok);
        if (!pendingOperations.length) return;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    currentUserId,
    getCommentCount,
    hasCommunityLoadError,
    isChatReady,
    isCommunityReady,
    isPetReady,
    isProfileReady,
    livePosts,
    markPostDeleted,
    participantIdsKey,
    postIdsKey,
    posts,
    profile,
    selectedPet,
    syncParticipant,
    syncPostReference,
  ]);

  return null;
}
