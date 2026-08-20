import { getCommunityImageUris } from '@/src/features/community/services/communityImageStorage';
import type {
  CommunityAuthorSnapshot,
  CommunityPost,
} from '@/src/features/community/types';

import type {
  ChatParticipantSnapshot,
  ChatPostReferenceSnapshot,
} from './types';

export function toChatParticipant(
  author: CommunityAuthorSnapshot,
  showLocation = false,
): ChatParticipantSnapshot {
  return {
    introduction: author.introduction,
    nickname: author.nickname,
    petName: author.petName,
    profileImageUri: author.profileImageUri,
    userId: author.userId,
    ...(showLocation && author.location ? { location: author.location } : {}),
  };
}

export function toChatPostReference(
  post: CommunityPost,
  commentCount?: number,
): ChatPostReferenceSnapshot {
  const thumbnailUri = getCommunityImageUris(post.images, post.photoUris)[0];

  if (post.kind === 'market') {
    return {
      authorId: post.author.userId,
      authorNickname: post.author.nickname,
      kind: 'market',
      marketStatus: post.status,
      postId: post.id,
      priceLabel: post.priceLabel,
      thumbnailUri,
      title: post.title,
      tradeType: post.tradeType,
    };
  }

  return {
    authorId: post.author.userId,
    authorNickname: post.author.nickname,
    ...(commentCount === undefined ? {} : { commentCount }),
    kind: post.kind,
    postId: post.id,
    thumbnailUri,
    title: post.title,
  };
}
