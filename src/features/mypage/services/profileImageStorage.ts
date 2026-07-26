import { Directory, File, Paths } from 'expo-file-system';

function getUserDirectory(userId: string) {
  return new Directory(Paths.document, 'profile-images', encodeURIComponent(userId));
}

function getExtension(uri: string) {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(uri);
  return match?.[1]?.toLowerCase() || 'jpg';
}

function isManagedProfileImage(userId: string, uri: string | null) {
  if (!uri) return false;
  const directoryUri = getUserDirectory(userId).uri;
  const prefix = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
  return uri.startsWith(prefix);
}

export async function persistProfileImage(userId: string, sourceUri: string) {
  const directory = getUserDirectory(userId);
  directory.create({ idempotent: true, intermediates: true });

  const destination = new File(
    directory,
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${getExtension(sourceUri)}`,
  );
  new File(sourceUri).copy(destination);
  return destination.uri;
}

export async function removeProfileImage(userId: string, uri: string | null) {
  if (!isManagedProfileImage(userId, uri)) return;

  const file = new File(uri as string);
  if (file.exists) file.delete();
}

export async function removeUserProfileImages(userId: string) {
  const directory = getUserDirectory(userId);
  if (directory.exists) directory.delete();
}
