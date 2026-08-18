import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadModule(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(module, module.exports, (id) => {
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected import: ${id}`);
  });
  return module.exports;
}

const petApi = loadModule('../src/features/pet/services/petApi.ts', {
  '@/src/services/apiClient': { apiRequest: async () => undefined },
  '@/src/utils/file': { getMultipartImageFile: () => ({}) },
});
const petEnvelope = {
  code: 'PET_CREATE_200',
  isSuccess: true,
  message: 'ok',
  result: {
    birth: '2022-01-15',
    breedName: '말티즈',
    gender: 'MALE',
    neutering: true,
    petId: 1,
    petName: '초코',
    petType: 'DOG',
    petWeight: 3.5,
    profileUrl: 'https://cdn.example.com/pets/1.jpg',
  },
};
assert.deepEqual(petApi.parseRemotePetEnvelope(petEnvelope, 'PET_CREATE_200'), {
  birthDate: '2022-01-15',
  breed: '말티즈',
  gender: 'male',
  id: '1',
  name: '초코',
  neutered: true,
  profileImageUri: 'https://cdn.example.com/pets/1.jpg',
  type: 'dog',
  weight: 3.5,
});
assert.throws(() => petApi.parseRemotePetEnvelope({ ...petEnvelope, code: 'PET_UPDATE_200' }, 'PET_CREATE_200'));
assert.deepEqual(
  petApi.parseRemoteBreedEnvelope({
    code: 'BREED_SEARCH_200',
    isSuccess: true,
    message: 'ok',
    result: [{ breedId: 1, name: '말티즈', petType: 'DOG', popular: true }],
  }),
  [{ id: 1, name: '말티즈', popular: true, type: 'dog' }],
);

const locationApi = loadModule('../src/services/locationApi.ts', {
  './apiClient': { apiRequest: async () => undefined },
});
const locationEnvelope = {
  code: 'LOCATION_200_4',
  isSuccess: true,
  message: 'ok',
  result: {
    address: '서울특별시 종로구 세종대로 110',
    latitude: 37.5665,
    longitude: 126.978,
    regionCode: '1111000000',
    regionName: '서울특별시 종로구',
  },
};
assert.deepEqual(
  locationApi.parseResolvedLocationEnvelope(locationEnvelope, 'LOCATION_200_4'),
  locationEnvelope.result,
);
assert.deepEqual(
  locationApi.parseRegionSearchEnvelope({
    code: 'REGION_SEARCH_200',
    isSuccess: true,
    message: 'ok',
    result: [{ code: '1111000000', dongPreview: ['청운효자동'], name: '서울특별시 종로구' }],
  }),
  [{ code: '1111000000', dongPreview: ['청운효자동'], name: '서울특별시 종로구' }],
);

const termsApi = loadModule('../src/features/auth/terms/TermsRepository.ts', {
  '@/src/services/apiClient': { apiRequest: async () => undefined },
  './types': {
    TERM_IDS: {
      age: 'age-confirmation',
      location: 'location-service',
      marketing: 'marketing-communications',
      privacy: 'privacy-collection',
      profilePrivacy: 'profile-privacy-collection',
      service: 'service-terms',
    },
  },
});
assert.deepEqual(
  termsApi.parseTermsListEnvelope({
    code: 'TERMS_LIST_200',
    isSuccess: true,
    message: 'ok',
    result: [{ effectiveAt: '2025-01-01', required: true, title: '서비스 이용약관', type: 'TERMS_OF_SERVICE', version: '1.0' }],
  }),
  ['TERMS_OF_SERVICE'],
);
assert.deepEqual(
  termsApi.parseTermDetailEnvelope({
    code: 'TERMS_DETAIL_200',
    isSuccess: true,
    message: 'ok',
    result: {
      content: '약관 내용',
      effectiveAt: '2025-01-01',
      required: true,
      title: '서비스 이용약관',
      type: 'TERMS_OF_SERVICE',
      version: '1.0',
    },
  }),
  {
    body: '약관 내용',
    effectiveDate: '2025-01-01',
    id: 'service-terms',
    kind: 'service',
    required: true,
    scope: 'signup',
    status: 'active',
    title: '서비스 이용약관',
    version: '1.0',
  },
);
