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
    reviewPosts,
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
    () => new Map([...posts, ...reviewPosts].map((post) => [post.id, post])),
    [posts, reviewPosts],
  );

  useEffect(() => {
    if (!currentUserId || !isChatReady || !isCommunityReady || hasCommunityLoadError) return;

    const participants = new Map(
      [...posts, ...reviewPosts].map((post) => [
        post.author.userId,
        toChatParticipant(post.author),
      ]),
    );
    if (profile && isProfileReady && isPetReady) {
      participants.set(
        currentUserId,
        toChatParticipant(createCommunityAuthor(profile, selectedPet, currentUserId)),
      );
    }

    const operations = [...participants.values()].map(
      (participant) => () => syncParticipant(participant),
    );
    const referenceIds = new Set(
      rooms.flatMap((room) => room.postReference?.postId ?? []),
    );

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
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!active) return;
        const results = await Promise.all(operations.map((operation) => operation()));
        if (!active || results.every((result) => result.ok)) return;
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
    posts,
    profile,
    reviewPosts,
    rooms,
    selectedPet,
    syncParticipant,
    syncPostReference,
  ]);

  return null;
}
