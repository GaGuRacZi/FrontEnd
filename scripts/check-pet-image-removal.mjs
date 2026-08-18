import assert from 'node:assert/strict';

import {
  mergePendingPetImageRemovals,
  normalizePendingPetImageRemoval,
} from '../src/features/pet/services/petImageRemovalState.ts';

assert.deepEqual(
  normalizePendingPetImageRemoval({
    removeDirectory: true,
    uris: ['file:///pet/a.jpg', 'file:///pet/a.jpg', '', 7],
  }),
  { removeDirectory: true, uris: ['file:///pet/a.jpg'] },
);
assert.equal(normalizePendingPetImageRemoval({ removeDirectory: false, uris: [] }), null);
assert.deepEqual(
  mergePendingPetImageRemovals(
    { removeDirectory: false, uris: ['file:///pet/a.jpg'] },
    { removeDirectory: true, uris: ['file:///pet/a.jpg', 'file:///pet/b.jpg'] },
  ),
  {
    removeDirectory: true,
    uris: ['file:///pet/a.jpg', 'file:///pet/b.jpg'],
  },
);
