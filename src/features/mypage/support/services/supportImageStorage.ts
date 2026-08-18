import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import { getFileExtension } from '@/src/utils/file';

import { getInquiryImageAssetKey } from '../supportValidation';
import type { InquiryImage } from '../types';

const SUPPORT_IMAGE_REMOVAL_PREFIX = 'paw:support-image-removals:';
let removalQueue = Promise.resolve();

function getUserDirectory(userId: string) {
  return new Directory(Paths.document, 'support-images', encodeURIComponent(userId));
}

function getDraftDirectory(userId: string) {
  return new Directory(getUserDirectory(userId), 'draft');
}

function getInquiryDirectory(userId: string, inquiryId: string) {
  return new Directory(getUserDirectory(userId), 'inquiries', encodeURIComponent(inquiryId));
}

function createAssetId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function removalStorageKey(userId: string) {
  return `${SUPPORT_IMAGE_REMOVAL_PREFIX}${encodeURIComponent(userId)}`;
}

function hasDirectoryPrefix(directory: Directory, uri: string) {
  const prefix = directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
  return uri.startsWith(prefix);
}

function removeDirectory(directory: Directory) {
  if (directory.exists) directory.delete();
}

function isManagedInquiryImage(userId: string, image: InquiryImage) {
  return hasDirectoryPrefix(getUserDirectory(userId), image.localUri);
}

function enqueueRemoval<T>(operation: () => Promise<T>) {
  const result = removalQueue.then(operation, operation);
  removalQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function readQueuedRemovals(userId: string) {
  const key = removalStorageKey(userId);
  const stored = await AsyncStorage.getItem(key);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('invalid-support-image-removals');
    return parsed.filter(
      (image): image is InquiryImage =>
        Boolean(
          image &&
            typeof image === 'object' &&
            typeof image.assetId === 'string' &&
            typeof image.localUri === 'string' &&
            isManagedInquiryImage(userId, image as InquiryImage),
        ),
    );
  } catch {
    await AsyncStorage.removeItem(key);
    return [];
  }
}

export function removeTemporaryInquiryFiles(sourceUris: string[]) {
  const cachePrefix = Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`;
  for (const sourceUri of new Set(sourceUris)) {
    if (!sourceUri.startsWith(cachePrefix)) continue;
    try {
      const file = new File(sourceUri);
      if (file.exists) file.delete();
    } catch {}
  }
}

export async function persistDraftInquiryImage(
  userId: string,
  sourceUri: string,
): Promise<InquiryImage> {
  const directory = getDraftDirectory(userId);
  directory.create({ idempotent: true, intermediates: true });
  const assetId = createAssetId();
  const destination = new File(directory, `${assetId}.${getFileExtension(sourceUri)}`);
  try {
    new File(sourceUri).copy(destination);
    removeTemporaryInquiryFiles([sourceUri]);
    return { assetId, localUri: destination.uri };
  } catch (error) {
    try {
      if (destination.exists) destination.delete();
    } catch {}
    throw error;
  }
}

export async function commitDraftInquiryImages(
  userId: string,
  inquiryId: string,
  images: InquiryImage[],
) {
  if (!images.length) return [];
  const draftDirectory = getDraftDirectory(userId);
  if (!images.every(({ localUri }) => hasDirectoryPrefix(draftDirectory, localUri))) {
    throw new Error('invalid-inquiry-draft-image');
  }

  const directory = getInquiryDirectory(userId, inquiryId);
  directory.create({ idempotent: true, intermediates: true });

  const committed: InquiryImage[] = [];
  try {
    for (const image of images) {
      const destination = new File(
        directory,
        `${image.assetId}.${getFileExtension(image.localUri)}`,
      );
      committed.push({ ...image, localUri: destination.uri });
      new File(image.localUri).copy(destination);
    }
    return committed;
  } catch (error) {
    try {
      removeDirectory(directory);
    } catch {
      await queueSupportImageRemovals(userId, committed).catch(() => undefined);
    }
    throw error;
  }
}

export async function removeDraftInquiryImage(userId: string, image: InquiryImage) {
  if (!hasDirectoryPrefix(getDraftDirectory(userId), image.localUri)) return;
  const file = new File(image.localUri);
  if (file.exists) file.delete();
}

export async function clearDraftInquiryImages(userId: string) {
  removeDirectory(getDraftDirectory(userId));
}

export async function removeCommittedInquiryImages(userId: string, inquiryId: string) {
  removeDirectory(getInquiryDirectory(userId, inquiryId));
}

export async function removeUserInquiryImages(userId: string) {
  removeDirectory(getUserDirectory(userId));
}

export function queueSupportImageRemovals(userId: string, images: InquiryImage[]) {
  if (!images.length) return Promise.resolve();

  return enqueueRemoval(async () => {
    const current = await readQueuedRemovals(userId);
    const removals = new Map(
      [...current, ...images]
        .filter((image) => isManagedInquiryImage(userId, image))
        .map((image) => [getInquiryImageAssetKey(image), image]),
    );
    await AsyncStorage.setItem(
      removalStorageKey(userId),
      JSON.stringify([...removals.values()]),
    );
  });
}

export function flushQueuedSupportImageRemovals(
  userId: string,
  retainedAssetKeys: ReadonlySet<string>,
) {
  return enqueueRemoval(async () => {
    const queued = await readQueuedRemovals(userId);
    const failed: InquiryImage[] = [];

    for (const image of queued) {
      if (retainedAssetKeys.has(getInquiryImageAssetKey(image))) continue;
      try {
        const file = new File(image.localUri);
        if (file.exists) file.delete();
      } catch {
        failed.push(image);
      }
    }

    if (failed.length) {
      await AsyncStorage.setItem(removalStorageKey(userId), JSON.stringify(failed));
      throw new Error('support-image-removal-failed');
    }
    await AsyncStorage.removeItem(removalStorageKey(userId));
  });
}

export function clearQueuedSupportImageRemovals(userId: string) {
  return enqueueRemoval(() => AsyncStorage.removeItem(removalStorageKey(userId)));
}
