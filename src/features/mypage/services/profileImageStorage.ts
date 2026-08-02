import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import { getFileExtension } from '@/src/utils/file';

const PENDING_PICKER_KEY = 'paw:profile-image-picker:pending';
const PENDING_REMOVAL_PREFIX = 'paw:profile-image-removal:';
const fallbackRemovals = new Map<string, Set<string>>();
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
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
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
  new File(sourceUri).copy(destination);
  return destination.uri;
}

export async function removeProfileImage(userId: string, uri: string | null) {
  if (!isManagedProfileImage(userId, uri)) return;

  const file = new File(uri as string);
  if (file.exists) file.delete();
}

export function queueProfileImageRemoval(userId: string, uri: string | null) {
  if (!isManagedProfileImage(userId, uri)) return Promise.resolve();

  const fallback = fallbackRemovals.get(userId) ?? new Set<string>();
  fallback.add(uri as string);
  fallbackRemovals.set(userId, fallback);

  return enqueueRemoval(async () => {
    const key = getPendingRemovalKey(userId);
    const queued = new Set(parseQueuedRemovals(await AsyncStorage.getItem(key)));
    fallback.forEach((value) => queued.add(value));
    await AsyncStorage.setItem(key, JSON.stringify([...queued]));
  });
}

export function flushQueuedProfileImageRemovals(
  userId: string,
  retainedUris: (string | null | undefined)[],
) {
  return enqueueRemoval(async () => {
    const key = getPendingRemovalKey(userId);
    const queued = new Set(parseQueuedRemovals(await AsyncStorage.getItem(key)));
    fallbackRemovals.get(userId)?.forEach((value) => queued.add(value));
    if (queued.size === 0) return;

    const retained = new Set(retainedUris.filter((uri): uri is string => Boolean(uri)));
    const pending: string[] = [];

    for (const uri of queued) {
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

    if (pending.length > 0) {
      fallbackRemovals.set(userId, new Set(pending));
      await AsyncStorage.setItem(key, JSON.stringify(pending));
    } else {
      fallbackRemovals.delete(userId);
      await AsyncStorage.removeItem(key);
    }
  });
}

export function removeUserProfileImages(userId: string) {
  return enqueueRemoval(async () => {
    const directory = getUserDirectory(userId);
    if (directory.exists) directory.delete();
    fallbackRemovals.delete(userId);
    await Promise.all([
      clearPendingProfileImagePicker(userId),
      AsyncStorage.removeItem(getPendingRemovalKey(userId)),
    ]);
  });
}
