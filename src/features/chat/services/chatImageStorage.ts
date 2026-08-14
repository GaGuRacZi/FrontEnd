import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import { getFileExtension } from '@/src/utils/file';

import type { ChatImageAsset } from '../types';

const CHAT_IMAGE_REMOVAL_KEY = 'paw:chat-image-removals';
let removalQueue = Promise.resolve();

function getUserDirectory(userId: string) {
  return new Directory(Paths.document, 'chat-images', encodeURIComponent(userId));
}

function isManagedChatImage(userId: string, uri?: string) {
  if (!uri) return false;
  const directoryUri = getUserDirectory(userId).uri;
  const prefix = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
  return uri.startsWith(prefix);
}

function createAssetId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function removeTemporaryFiles(sourceUris: string[]) {
  const cachePrefix = Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`;
  for (const sourceUri of sourceUris) {
    if (!sourceUri.startsWith(cachePrefix)) continue;
    try {
      const file = new File(sourceUri);
      if (file.exists) file.delete();
    } catch {}
  }
}

export function getChatImageAssetKey(image: ChatImageAsset) {
  return `${image.ownerId}:${image.assetId}`;
}

function enqueueRemoval<T>(operation: () => Promise<T>) {
  const result = removalQueue.then(operation, operation);
  removalQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function readQueuedRemovals() {
  const stored = await AsyncStorage.getItem(CHAT_IMAGE_REMOVAL_KEY);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('invalid-chat-image-removals');
    return parsed.filter(
      (image): image is ChatImageAsset =>
        Boolean(
          image &&
            typeof image === 'object' &&
            typeof image.assetId === 'string' &&
            typeof image.ownerId === 'string' &&
            typeof image.localUri === 'string',
        ),
    );
  } catch {
    await AsyncStorage.removeItem(CHAT_IMAGE_REMOVAL_KEY);
    return [];
  }
}

export function getChatImageUri(image: ChatImageAsset) {
  return image.url ?? image.localUri ?? '';
}

export async function persistChatImages(
  userId: string,
  sourceUris: string[],
): Promise<ChatImageAsset[]> {
  const uniqueSourceUris = [
    ...new Set(sourceUris.map((uri) => uri.trim()).filter(Boolean)),
  ];
  if (!userId.trim() || !uniqueSourceUris.length || uniqueSourceUris.length > 5) {
    throw new Error('invalid-chat-image-count');
  }

  const directory = getUserDirectory(userId);
  directory.create({ idempotent: true, intermediates: true });
  const persisted: ChatImageAsset[] = [];

  try {
    for (const sourceUri of uniqueSourceUris) {
      const assetId = createAssetId();
      const destination = new File(
        directory,
        `${assetId}.${getFileExtension(sourceUri)}`,
      );
      persisted.push({ assetId, localUri: destination.uri, ownerId: userId });
      new File(sourceUri).copy(destination);
    }
    return persisted;
  } catch (error) {
    await removeChatImages(persisted).catch(async () => {
      await queueChatImageRemovals(persisted).catch(() => undefined);
    });
    throw error;
  } finally {
    removeTemporaryFiles(uniqueSourceUris);
  }
}

export async function removeChatImages(images: ChatImageAsset[]) {
  let firstError: unknown;

  for (const image of images) {
    if (!isManagedChatImage(image.ownerId, image.localUri)) continue;
    try {
      const file = new File(image.localUri!);
      if (file.exists) file.delete();
    } catch (error) {
      firstError ??= error;
    }
  }

  if (firstError) throw firstError;
}

export function queueChatImageRemovals(images: ChatImageAsset[]) {
  if (!images.length) return Promise.resolve();

  return enqueueRemoval(async () => {
    const current = await readQueuedRemovals();
    const byAssetId = new Map(
      [...current, ...images]
        .filter((image) => isManagedChatImage(image.ownerId, image.localUri))
        .map((image) => [getChatImageAssetKey(image), image]),
    );
    await AsyncStorage.setItem(
      CHAT_IMAGE_REMOVAL_KEY,
      JSON.stringify([...byAssetId.values()]),
    );
  });
}

export function flushQueuedChatImageRemovals(
  retainedAssetKeys: ReadonlySet<string>,
) {
  return enqueueRemoval(async () => {
    const queued = await readQueuedRemovals();
    const pending = queued.filter(
      (image) => !retainedAssetKeys.has(getChatImageAssetKey(image)),
    );
    const failed: ChatImageAsset[] = [];

    for (const image of pending) {
      try {
        await removeChatImages([image]);
      } catch {
        failed.push(image);
      }
    }

    if (failed.length) {
      await AsyncStorage.setItem(CHAT_IMAGE_REMOVAL_KEY, JSON.stringify(failed));
    } else {
      await AsyncStorage.removeItem(CHAT_IMAGE_REMOVAL_KEY);
    }
    if (failed.length) throw new Error('chat-image-removal-failed');
  });
}
