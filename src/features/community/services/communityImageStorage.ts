import { Directory, File, Paths } from 'expo-file-system';

import type { CommunityImageAsset } from '../types';

function getUserDirectory(userId: string) {
  return new Directory(Paths.document, 'community-images', encodeURIComponent(userId));
}

function getExtension(uri: string) {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(uri);
  return match?.[1]?.toLowerCase() || 'jpg';
}

function createAssetId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isManagedCommunityImage(userId: string, uri?: string) {
  const directoryUri = getUserDirectory(userId).uri;
  const prefix = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
  return Boolean(uri?.startsWith(prefix));
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
  const destination = new File(directory, `${assetId}.${getExtension(sourceUri)}`);
  new File(sourceUri).copy(destination);

  return {
    assetId,
    localUri: destination.uri,
  };
}

export async function removeCommunityImage(userId: string, image?: CommunityImageAsset | null) {
  if (!image?.localUri || !isManagedCommunityImage(userId, image.localUri)) return;

  const file = new File(image.localUri);
  if (file.exists) file.delete();
}

export async function removeCommunityImages(userId: string, images?: CommunityImageAsset[]) {
  if (!images?.length) return;
  await Promise.all(images.map((image) => removeCommunityImage(userId, image)));
}

export async function removeUserCommunityImages(userId: string) {
  const directory = getUserDirectory(userId);
  if (directory.exists) directory.delete();
}
