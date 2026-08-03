import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import { getFileExtension } from '@/src/utils/file';

import type { CommunityImageAsset } from '../types';

const COMMUNITY_IMAGE_REMOVAL_PREFIX = 'paw:community-image-removal:';
type PendingImageRemoval = {
  removeDirectory: boolean;
  uris: string[];
};
let removalQueue = Promise.resolve();

function getUserDirectory(userId: string) {
  return new Directory(Paths.document, 'community-images', encodeURIComponent(userId));
}

function createAssetId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isManagedCommunityImage(userId: string, uri?: string) {
  const directoryUri = getUserDirectory(userId).uri;
  const prefix = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
  return Boolean(uri?.startsWith(prefix));
}

function pendingRemovalKey(userId: string) {
  return `${COMMUNITY_IMAGE_REMOVAL_PREFIX}${encodeURIComponent(userId)}`;
}

function enqueueRemovalOperation<T>(operation: () => Promise<T>) {
  const result = removalQueue.then(operation, operation);
  removalQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function normalizePendingRemoval(value: unknown): PendingImageRemoval | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<PendingImageRemoval>;
  const removeDirectory = parsed.removeDirectory === true;
  const uris = Array.isArray(parsed.uris)
    ? [
        ...new Set(
          parsed.uris.filter(
            (uri): uri is string =>
              typeof uri === 'string' && Boolean(uri.trim()),
          ),
        ),
      ]
    : [];
  if (!removeDirectory && !uris.length) return null;
  return { removeDirectory, uris };
}

async function readPendingRemoval(userId: string) {
  const stored = await AsyncStorage.getItem(pendingRemovalKey(userId));
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as unknown;
    const pending = normalizePendingRemoval(parsed);
    if (!pending) await AsyncStorage.removeItem(pendingRemovalKey(userId));
    return pending;
  } catch {
    await AsyncStorage.removeItem(pendingRemovalKey(userId)).catch(() => undefined);
    return null;
  }
}

async function savePendingRemoval(
  userId: string,
  pending: PendingImageRemoval | null,
) {
  const key = pendingRemovalKey(userId);
  if (!pending) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, JSON.stringify(pending));
}

function removeFile(uri: string) {
  const file = new File(uri);
  if (file.exists) file.delete();
}

function hasRetainedUserImage(userId: string, retainedUris: ReadonlySet<string>) {
  return [...retainedUris].some((uri) => isManagedCommunityImage(userId, uri));
}

async function flushUserPendingRemoval(
  userId: string,
  retainedUris: ReadonlySet<string>,
) {
  const pending = await readPendingRemoval(userId);
  if (!pending) return;

  if (pending.removeDirectory) {
    if (hasRetainedUserImage(userId, retainedUris)) {
      return;
    }
    const directory = getUserDirectory(userId);
    if (directory.exists) directory.delete();
    await savePendingRemoval(userId, null);
    return;
  }

  const remainingUris: string[] = [];
  let removalError: unknown;
  for (const uri of pending.uris) {
    if (retainedUris.has(uri)) {
      remainingUris.push(uri);
      continue;
    }
    try {
      removeFile(uri);
    } catch (error) {
      removalError ??= error;
      remainingUris.push(uri);
    }
  }

  if (remainingUris.length) {
    await savePendingRemoval(userId, {
      removeDirectory: false,
      uris: remainingUris,
    });
  } else {
    await savePendingRemoval(userId, null);
  }
  if (removalError) throw removalError;
}

export async function queueCommunityImageRemovals(
  userId: string,
  images?: CommunityImageAsset[],
) {
  if (!images?.length) return;
  await enqueueRemovalOperation(async () => {
    const current = await readPendingRemoval(userId);
    const uris = images
      .map((image) => image.localUri)
      .filter(
        (uri): uri is string =>
          Boolean(uri && isManagedCommunityImage(userId, uri)),
      );
    if (!uris.length) return;
    await savePendingRemoval(userId, {
      removeDirectory: current?.removeDirectory === true,
      uris: [...new Set([...(current?.uris ?? []), ...uris])],
    });
  });
}

export async function queueUserCommunityImageRemoval(userId: string) {
  await enqueueRemovalOperation(async () => {
    const current = await readPendingRemoval(userId);
    await savePendingRemoval(userId, {
      removeDirectory: true,
      uris: current?.uris ?? [],
    });
  });
}

export function getCommunityImageUri(image: CommunityImageAsset) {
  return image.url ?? image.localUri ?? '';
}

export function getCommunityImageUris(images?: CommunityImageAsset[], photoUris?: string[]) {
  const imageUris = images?.map(getCommunityImageUri).filter(Boolean) ?? [];
  return imageUris.length ? imageUris : photoUris ?? [];
}

export async function persistCommunityImage(
  userId: string,
  sourceUri: string,
): Promise<CommunityImageAsset> {
  const directory = getUserDirectory(userId);
  directory.create({ idempotent: true, intermediates: true });

  const assetId = createAssetId();
  const destination = new File(directory, `${assetId}.${getFileExtension(sourceUri)}`);
  new File(sourceUri).copy(destination);

  return {
    assetId,
    localUri: destination.uri,
  };
}

export async function removeCommunityImages(userId: string, images?: CommunityImageAsset[]) {
  if (!images?.length) return;
  await queueCommunityImageRemovals(userId, images);
  await flushQueuedCommunityImageRemovals({ userId });
}

export async function flushQueuedCommunityImageRemovals(options?: {
  retainedUris?: ReadonlySet<string>;
  userId?: string;
}) {
  await enqueueRemovalOperation(async () => {
    const userIds = options?.userId
      ? [options.userId]
      : (await AsyncStorage.getAllKeys())
          .filter((key) => key.startsWith(COMMUNITY_IMAGE_REMOVAL_PREFIX))
          .flatMap((key) => {
            try {
              return [
                decodeURIComponent(key.slice(COMMUNITY_IMAGE_REMOVAL_PREFIX.length)),
              ];
            } catch {
              return [];
            }
          });
    const failures: unknown[] = [];
    for (const pendingUserId of userIds) {
      try {
        await flushUserPendingRemoval(
          pendingUserId,
          options?.retainedUris ?? new Set(),
        );
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) throw failures[0];
  });
}
