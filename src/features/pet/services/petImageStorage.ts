import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

export type PetImageField = 'certificateImageUri' | 'profileImageUri';

export type PendingPetImagePicker = {
  draftId: string;
  field: PetImageField;
  userId: string;
};

const PENDING_PICKER_KEY = 'paw:pet-image-picker:pending';

function getUserDirectory(userId: string) {
  const safeUserId = encodeURIComponent(userId);
  return new Directory(Paths.document, 'pet-images', safeUserId);
}

function getExtension(uri: string) {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(uri);
  return match?.[1]?.toLowerCase() || 'jpg';
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
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${getExtension(sourceUri)}`,
  );
  new File(sourceUri).copy(destination);
  return destination.uri;
}

function isManagedPetImage(userId: string, uri: string | null) {
  const directoryUri = getUserDirectory(userId).uri;
  const prefix = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
  return Boolean(uri?.startsWith(prefix));
}

export async function removePetImage(userId: string, uri: string | null) {
  if (!uri || !isManagedPetImage(userId, uri)) return;

  const file = new File(uri);
  if (file.exists) file.delete();
}

export async function removeUserPetImages(userId: string) {
  const directory = getUserDirectory(userId);
  if (directory.exists) directory.delete();
}
