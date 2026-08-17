import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import { getFileExtension } from '@/src/utils/file';

const PENDING_PICKER_KEY = 'paw:profile-image-picker:pending';
const PENDING_REMOVAL_PREFIX = 'paw:profile-image-removal:';
type PendingProfileImageRemoval = {
  removeDirectory: boolean;
  uris: string[];
};
const fallbackRemovals = new Map<string, PendingProfileImageRemoval>();
let removalQueue: Promise<void> = Promise.resolve();

function getUserDirectory(userId: string) {
  return new Directory(Paths.document, 'profile-images', encodeURIComponent(userId));
}

function getPendingRemovalKey(userId: string) {
  return `${PENDING_REMOVAL_PREFIX}${encodeURIComponent(userId)}`;
}

function isManagedProfileImage(userId: string, uri: string | null) {
  if (!uri) return false;
  const directoryUri = getUserDirectory(userId).uri;
  const prefix = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
  return uri.startsWith(prefix);
}

function enqueueRemoval<T>(operation: () => Promise<T>) {
  const result = removalQueue.then(operation, operation);
  removalQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function parseQueuedRemovals(stored: string | null) {
  if (!stored) return { removeDirectory: false, uris: [] };

  try {
    const parsed: unknown = JSON.parse(stored);
    const values = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && 'uris' in parsed
        ? (parsed as { uris?: unknown }).uris
        : [];
    const uris = Array.isArray(values)
      ? [...new Set(values.filter((value): value is string => typeof value === 'string'))]
      : [];
    return {
      removeDirectory:
        !Array.isArray(parsed) &&
        Boolean(
          parsed &&
            typeof parsed === 'object' &&
            'removeDirectory' in parsed &&
            (parsed as { removeDirectory?: unknown }).removeDirectory === true,
        ),
      uris,
    };
  } catch {
    return { removeDirectory: false, uris: [] };
  }
}

function mergeQueuedRemovals(
  first: PendingProfileImageRemoval,
  second?: PendingProfileImageRemoval,
): PendingProfileImageRemoval {
  return {
    removeDirectory: first.removeDirectory || second?.removeDirectory === true,
    uris: [...new Set([...first.uris, ...(second?.uris ?? [])])],
  };
}

export async function getPendingProfileImagePicker() {
  const userId = await AsyncStorage.getItem(PENDING_PICKER_KEY);
  return userId?.trim() || null;
}

export async function setPendingProfileImagePicker(userId: string) {
  await AsyncStorage.setItem(PENDING_PICKER_KEY, userId);
}

export async function clearPendingProfileImagePicker(userId?: string) {
  if (userId) {
    const pendingUserId = await getPendingProfileImagePicker();
    if (pendingUserId && pendingUserId !== userId) return;
  }

  await AsyncStorage.removeItem(PENDING_PICKER_KEY);
}

export async function persistProfileImage(userId: string, sourceUri: string) {
  const directory = getUserDirectory(userId);
  directory.create({ idempotent: true, intermediates: true });

  const destination = new File(
    directory,
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${getFileExtension(sourceUri)}`,
  );
  try {
    new File(sourceUri).copy(destination);
    return destination.uri;
  } catch (error) {
    try {
      if (destination.exists) destination.delete();
    } catch {}
    throw error;
  }
}

export async function removeProfileImage(userId: string, uri: string | null) {
  if (!isManagedProfileImage(userId, uri)) return;

  const file = new File(uri as string);
  if (file.exists) file.delete();
}

export function queueProfileImageRemoval(userId: string, uri: string | null) {
  if (!isManagedProfileImage(userId, uri)) return Promise.resolve();

  const fallback = mergeQueuedRemovals(
    fallbackRemovals.get(userId) ?? { removeDirectory: false, uris: [] },
    { removeDirectory: false, uris: [uri as string] },
  );
  fallbackRemovals.set(userId, fallback);

  return enqueueRemoval(async () => {
    const key = getPendingRemovalKey(userId);
    const queued = mergeQueuedRemovals(
      parseQueuedRemovals(await AsyncStorage.getItem(key)),
      fallback,
    );
    await AsyncStorage.setItem(key, JSON.stringify(queued));
  });
}

export function flushQueuedProfileImageRemovals(
  userId: string,
  retainedUris: (string | null | undefined)[],
) {
  return enqueueRemoval(async () => {
    const key = getPendingRemovalKey(userId);
    const queued = mergeQueuedRemovals(
      parseQueuedRemovals(await AsyncStorage.getItem(key)),
      fallbackRemovals.get(userId),
    );
    if (!queued.removeDirectory && queued.uris.length === 0) return;

    const retained = new Set(retainedUris.filter((uri): uri is string => Boolean(uri)));
    const pending: string[] = [];

    if (
      queued.removeDirectory &&
      ![...retained].some((uri) => isManagedProfileImage(userId, uri))
    ) {
      try {
        const directory = getUserDirectory(userId);
        if (directory.exists) directory.delete();
        fallbackRemovals.delete(userId);
        await AsyncStorage.removeItem(key);
        return;
      } catch (error) {
        fallbackRemovals.set(userId, queued);
        await AsyncStorage.setItem(key, JSON.stringify(queued)).catch(() => undefined);
        throw error;
      }
    }

    for (const uri of queued.uris) {
      if (retained.has(uri)) {
        pending.push(uri);
        continue;
      }

      try {
        await removeProfileImage(userId, uri);
      } catch {
        pending.push(uri);
      }
    }

    if (queued.removeDirectory || pending.length > 0) {
      const nextPending = {
        removeDirectory: queued.removeDirectory,
        uris: pending,
      };
      fallbackRemovals.set(userId, nextPending);
      await AsyncStorage.setItem(key, JSON.stringify(nextPending));
    } else {
      fallbackRemovals.delete(userId);
      await AsyncStorage.removeItem(key);
    }
  });
}

export function removeUserProfileImages(userId: string) {
  return enqueueRemoval(async () => {
    const key = getPendingRemovalKey(userId);

    try {
      const directory = getUserDirectory(userId);
      if (directory.exists) directory.delete();
    } catch (error) {
      const queued = mergeQueuedRemovals(
        parseQueuedRemovals(await AsyncStorage.getItem(key).catch(() => null)),
        fallbackRemovals.get(userId),
      );
      const pending = { ...queued, removeDirectory: true };
      fallbackRemovals.set(userId, pending);
      await Promise.allSettled([
        clearPendingProfileImagePicker(userId),
        AsyncStorage.setItem(key, JSON.stringify(pending)),
      ]);
      throw error;
    }

    fallbackRemovals.delete(userId);
    await Promise.allSettled([
      clearPendingProfileImagePicker(userId),
      AsyncStorage.removeItem(key),
    ]);
  });
}
