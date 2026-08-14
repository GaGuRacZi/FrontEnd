const MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

export function getFileExtension(uri: string) {
  const match = /\.([a-zA-Z0-9]+)(?:[?#]|$)/.exec(uri);
  return match?.[1]?.toLowerCase() || 'jpg';
}

export function getMultipartImageFile(uri: string) {
  if (!uri.trim()) throw new Error('invalid-image-uri');

  const sourceExtension = /\.([a-zA-Z0-9]+)(?:[?#]|$)/.exec(uri)?.[1]?.toLowerCase();
  if (!sourceExtension) throw new Error('unsupported-image-format');
  const extension =
    sourceExtension === 'jpeg'
      ? 'jpg'
      : sourceExtension === 'tif'
        ? 'tiff'
        : sourceExtension;
  const type = MIME_BY_EXTENSION[extension];
  if (!type) throw new Error('unsupported-image-format');

  const sourceName = uri.split(/[\\/]/).pop()?.split(/[?#]/, 1)[0] ?? '';
  const baseName = sourceName
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_') || 'image';

  return {
    name: `${baseName}.${extension}`,
    type,
    uri,
  };
}
