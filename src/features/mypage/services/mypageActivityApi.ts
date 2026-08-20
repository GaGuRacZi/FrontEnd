import { apiRequest } from '@/src/services/apiClient';

export type MyPageActivityKind = 'authored' | 'commented' | 'saved';

export class MyPageActivityApiContractError extends Error {
  constructor() {
    super('Invalid my page activity API response.');
    this.name = 'MyPageActivityApiContractError';
  }
}

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MyPageActivityApiContractError();
  }
  return value as Record<string, unknown>;
}

function readEnvelope(value: unknown, expectedCode: string) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true || envelope.code !== expectedCode) {
    throw new MyPageActivityApiContractError();
  }
  return envelope.result;
}

function readPostIds(value: unknown, expectedCode: string) {
  const page = readRecord(readEnvelope(value, expectedCode));
  if (!Array.isArray(page.content)) throw new MyPageActivityApiContractError();

  const postIds = page.content.map((item) => {
    const postId = readRecord(item).postId;
    if (typeof postId !== 'number' && typeof postId !== 'string') {
      throw new MyPageActivityApiContractError();
    }
    const id = String(postId).trim();
    if (!id) throw new MyPageActivityApiContractError();
    return id;
  });
  const hasNext = page.hasNext;
  const nextCursor = page.nextCursor;
  if (typeof hasNext !== 'boolean' || (nextCursor !== null && typeof nextCursor !== 'string')) {
    throw new MyPageActivityApiContractError();
  }
  if (hasNext && !nextCursor?.trim()) throw new MyPageActivityApiContractError();

  return { hasNext, nextCursor, postIds };
}

export async function getRemoteMyPageActivityPostIds(kind: MyPageActivityKind) {
  const requests: Record<MyPageActivityKind, readonly [string, string]> = {
    authored: ['/mypage/community/posts', 'MYPAGE_COMMUNITY_POSTS_200'],
    commented: ['/mypage/community/comments', 'MYPAGE_COMMUNITY_COMMENTS_200'],
    saved: ['/mypage/community/likes', 'MYPAGE_COMMUNITY_LIKES_200'],
  };
  const [path, expectedCode] = requests[kind];
  const postIds = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({ size: '50' });
    if (cursor) params.set('cursor', cursor);
    const page = readPostIds(await apiRequest<unknown>(`${path}?${params.toString()}`), expectedCode);
    page.postIds.forEach((postId) => postIds.add(postId));
    if (!page.hasNext) return [...postIds];

    cursor = page.nextCursor;
    if (!cursor || cursors.has(cursor)) throw new MyPageActivityApiContractError();
    cursors.add(cursor);
  } while (cursor);

  return [...postIds];
}
