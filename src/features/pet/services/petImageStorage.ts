import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import { getFileExtension } from '@/src/utils/file';

import {
  mergePendingPetImageRemovals,
  normalizePendingPetImageRemoval,
  type PendingPetImageRemoval,
} from './petImageRemovalState';

export type PetImageField = 'certificateImageUri' | 'profileImageUri';

export type PendingPetImagePicker = {
  draftId: string;
  field: PetImageField;
  userId: string;
};

const PENDING_PICKER_KEY = 'paw:pet-image-picker:pending';
const PENDING_REMOVAL_PREFIX = 'paw:pet-image-removal:';
const fallbackRemovals = new Map<string, PendingPetImageRemoval>();
let removalQueue = Promise.resolve();

function getUserDirectory(userId: string) {
  const safeUserId = encodeURIComponent(userId);
  return new Directory(Paths.document, 'pet-images', safeUserId);
}

function pendingRemovalKey(userId: string) {
  return `${PENDING_REMOVAL_PREFIX}${encodeURIComponent(userId)}`;
}

function enqueueRemoval<T>(operation: () => Promise<T>) {
  const result = removalQueue.then(operation, operation);
  removalQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function parsePendingPicker(value: string | null): PendingPetImagePicker | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const pending = parsed as Partial<PendingPetImagePicker>;
    if (
      typeof pending.userId !== 'string' ||
      typeof pending.draftId !== 'string' ||
      (pending.field !== 'profileImageUri' && pending.field !== 'certificateImageUri')
    ) {
      return null;
    }

    return pending as PendingPetImagePicker;
  } catch {
    return null;
  }
}

export async function getPendingPetImagePicker() {
  const stored = await AsyncStorage.getItem(PENDING_PICKER_KEY);
  const pending = parsePendingPicker(stored);

  if (stored && !pending) await AsyncStorage.removeItem(PENDING_PICKER_KEY);
  return pending;
}

export async function setPendingPetImagePicker(pending: PendingPetImagePicker) {
  await AsyncStorage.setItem(PENDING_PICKER_KEY, JSON.stringify(pending));
}

export async function clearPendingPetImagePicker(
  userId?: string,
  draftId?: string,
  field?: PetImageField,
) {
  if (userId || draftId || field) {
    const pending = await getPendingPetImagePicker();
    if (
      pending &&
      ((userId && pending.userId !== userId) ||
        (draftId && pending.draftId !== draftId) ||
        (field && pending.field !== field))
    ) {
      return;
    }
  }

  await AsyncStorage.removeItem(PENDING_PICKER_KEY);
}

export async function persistPetImage(userId: string, sourceUri: string) {
  const directory = getUserDirectory(userId);
  directory.create({ idempotent: true, intermediates: true });

  const destination = new File(
    directory,
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${getFileExtension(sourceUri)}`,
  );
  await queuePetImageRemovals(userId, [destination.uri]);
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

export function collectPetImageUris(
  items: readonly {
    certificateImageUri: string | null;
    profileImageUri: string | null;
  }[],
) {
  return new Set(
    items.flatMap((item) =>
      [item.profileImageUri, item.certificateImageUri].filter(
        (uri): uri is string => Boolean(uri),
      ),
    ),
  );
}

export function collectRetainedPetImageUris(
  pets: readonly {
    certificateImageUri: string | null;
    id: string;
    profileImageUri: string | null;
  }[],
  drafts: readonly {
    certificateImageUri: string | null;
    petId: string | null;
    profileImageUri: string | null;
  }[],
) {
  const petIds = new Set(pets.map((pet) => pet.id));
  return collectPetImageUris([
    ...pets,
    ...drafts.filter((draft) => !draft.petId || petIds.has(draft.petId)),
  ]);
}

function isManagedPetImage(userId: string, uri: string | null) {
  const directoryUri = getUserDirectory(userId).uri;
  const prefix = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
  return Boolean(uri?.startsWith(prefix));
}

async function removePetImage(userId: string, uri: string | null) {
  if (!uri || !isManagedPetImage(userId, uri)) return;

  const file = new File(uri);
  if (file.exists) file.delete();
}

async function readPendingRemoval(userId: string) {
  const key = pendingRemovalKey(userId);
  const stored = await AsyncStorage.getItem(key);
  if (!stored) return null;

  try {
    const normalized = normalizePendingPetImageRemoval(JSON.parse(stored) as unknown);
    if (!normalized) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    const pending = {
      removeDirectory: normalized.removeDirectory,
      uris: normalized.uris.filter((uri) => isManagedPetImage(userId, uri)),
    };
    if (!pending.removeDirectory && !pending.uris.length) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return pending;
  } catch {
    await AsyncStorage.removeItem(key).catch(() => undefined);
    return null;
  }
}

async function savePendingRemoval(
  userId: string,
  pending: PendingPetImageRemoval | null,
) {
  const key = pendingRemovalKey(userId);
  if (!pending) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, JSON.stringify(pending));
}

export function queuePetImageRemovals(userId: string, uris: (string | null)[]) {
  const managedUris = uris.filter(
    (uri): uri is string => Boolean(uri && isManagedPetImage(userId, uri)),
  );
  if (!managedUris.length) return Promise.resolve();

  const fallback = mergePendingPetImageRemovals(
    fallbackRemovals.get(userId) ?? { removeDirectory: false, uris: [] },
    { removeDirectory: false, uris: managedUris },
  );
  fallbackRemovals.set(userId, fallback);

  return enqueueRemoval(async () => {
    const pending = mergePendingPetImageRemovals(
      (await readPendingRemoval(userId)) ?? { removeDirectory: false, uris: [] },
      fallback,
    );
    await savePendingRemoval(userId, pending);
  });
}

export function queueUserPetImageRemoval(userId: string) {
  const fallback = mergePendingPetImageRemovals(
    fallbackRemovals.get(userId) ?? { removeDirectory: false, uris: [] },
    { removeDirectory: true, uris: [] },
  );
  fallbackRemovals.set(userId, fallback);

  return enqueueRemoval(async () => {
    const pending = mergePendingPetImageRemovals(
      (await readPendingRemoval(userId)) ?? { removeDirectory: false, uris: [] },
      fallback,
    );
    await savePendingRemoval(userId, pending);
  });
}

export function flushQueuedPetImageRemovals(
  userId: string,
  retainedUris: ReadonlySet<string>,
) {
  return enqueueRemoval(async () => {
    const pending = mergePendingPetImageRemovals(
      (await readPendingRemoval(userId)) ?? { removeDirectory: false, uris: [] },
      fallbackRemovals.get(userId),
    );
    if (!pending.removeDirectory && !pending.uris.length) return;

    const retainedManagedUris = new Set(
      [...retainedUris].filter((uri) => isManagedPetImage(userId, uri)),
    );
    if (pending.removeDirectory && !retainedManagedUris.size) {
      try {
        const directory = getUserDirectory(userId);
        if (directory.exists) directory.delete();
        fallbackRemovals.delete(userId);
        await savePendingRemoval(userId, null);
        return;
      } catch (error) {
        fallbackRemovals.set(userId, pending);
        await savePendingRemoval(userId, pending).catch(() => undefined);
        throw error;
      }
    }

    const remainingUris: string[] = [];
    let removalError: unknown;
    for (const uri of pending.uris) {
      if (retainedManagedUris.has(uri)) {
        remainingUris.push(uri);
        continue;
      }
      try {
        await removePetImage(userId, uri);
      } catch (error) {
        removalError ??= error;
        remainingUris.push(uri);
      }
    }

    const nextPending = pending.removeDirectory || remainingUris.length
      ? { removeDirectory: pending.removeDirectory, uris: remainingUris }
      : null;
    if (nextPending) fallbackRemovals.set(userId, nextPending);
    else fallbackRemovals.delete(userId);
    await savePendingRemoval(userId, nextPending);
    if (removalError) throw removalError;
  });
}
