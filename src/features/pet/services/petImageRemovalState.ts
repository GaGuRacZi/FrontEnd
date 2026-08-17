export type PendingPetImageRemoval = {
  removeDirectory: boolean;
  uris: string[];
};

export function normalizePendingPetImageRemoval(
  value: unknown,
): PendingPetImageRemoval | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const parsed = value as Partial<PendingPetImageRemoval>;
  const removeDirectory = parsed.removeDirectory === true;
  const uris = Array.isArray(parsed.uris)
    ? [
        ...new Set(
          parsed.uris.filter(
            (uri): uri is string => typeof uri === 'string' && Boolean(uri.trim()),
          ),
        ),
      ]
    : [];

  return removeDirectory || uris.length ? { removeDirectory, uris } : null;
}

export function mergePendingPetImageRemovals(
  first: PendingPetImageRemoval,
  second?: PendingPetImageRemoval | null,
): PendingPetImageRemoval {
  return {
    removeDirectory: first.removeDirectory || second?.removeDirectory === true,
    uris: [...new Set([...first.uris, ...(second?.uris ?? [])])],
  };
}
