import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadModule(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(module, module.exports, (id) => {
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected import: ${id}`);
  });
  return module.exports;
}

const { appendMultipartJson } = loadModule('../src/utils/file.ts', {
  'expo-file-system': { File: class {} },
  'file-type/core': { fileTypeFromBuffer: async () => undefined },
  mime: { default: { getType: () => undefined } },
});

const petApi = loadModule('../src/features/pet/services/petApi.ts', {
  '@/src/services/apiClient': { apiRequest: async () => undefined },
  '@/src/utils/file': { appendMultipartImage: () => undefined, appendMultipartJson: () => undefined },
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
  main: null,
  name: '초코',
  neutered: true,
  profileImageUri: 'https://cdn.example.com/pets/1.jpg',
  type: 'dog',
  weight: 3.5,
});
assert.throws(() => petApi.parseRemotePetEnvelope({ ...petEnvelope, code: 'PET_UPDATE_200' }, 'PET_CREATE_200'));
assert.deepEqual(
  petApi.parseRemotePetListEnvelope({
    code: 'PET_LIST_200',
    isSuccess: true,
    message: 'ok',
    result: [
      { ...petEnvelope.result, main: true },
      { ...petEnvelope.result, main: false, petId: 2 },
    ],
  }),
  [
    { ...petApi.parseRemotePetEnvelope(petEnvelope, 'PET_CREATE_200'), main: true },
    { ...petApi.parseRemotePetEnvelope(petEnvelope, 'PET_CREATE_200'), id: '2', main: false },
  ],
);
assert.equal(
  petApi.parseRemotePetDetailEnvelope({
    code: 'PET_GET_200',
    isSuccess: true,
    message: 'ok',
    result: { ...petEnvelope.result, breedId: null, breedName: null, main: true },
  }).breed,
  '',
);

const petRequests = [];
const petMutations = loadModule('../src/features/pet/services/petApi.ts', {
  '@/src/services/apiClient': {
    apiRequest: async (path, options) => {
      petRequests.push([path, options]);
      if (path === '/pets') {
        return {
          code: 'PET_LIST_200',
          isSuccess: true,
          message: 'ok',
          result: [{ ...petEnvelope.result, main: true }],
        };
      }
      if (path === '/pets/1' && !options) {
        return {
          code: 'PET_GET_200',
          isSuccess: true,
          message: 'ok',
          result: { ...petEnvelope.result, main: true },
        };
      }
      return { code: 'PET_MAIN_UPDATE_200', isSuccess: true, message: 'ok', result: null };
    },
  },
  '@/src/utils/file': { appendMultipartImage: () => undefined, appendMultipartJson: () => undefined },
});
await petMutations.getRemotePets();
await petMutations.getRemotePet('1');
await petMutations.updateRemoteMainPet('1');
await petMutations.deleteRemotePet('1');
assert.deepEqual(petRequests, [
  ['/pets', undefined],
  ['/pets/1', undefined],
  ['/pets/1/main', { method: 'PATCH' }],
  ['/pets/1', { method: 'DELETE' }],
]);

const petStoreSource = readFileSync(
  new URL('../src/features/pet/PetStore.tsx', import.meta.url),
  'utf8',
);
assert.doesNotMatch(petStoreSource, /cacheLoadFailed/);
assert.match(petStoreSource, /await getRemotePet\(petId\)/);

const accountLifecycleSource = readFileSync(
  new URL('../src/hooks/useAccountLifecycle.ts', import.meta.url),
  'utf8',
);
assert.doesNotMatch(accountLifecycleSource, /logoutRemoteSession\)\.catch/);
assert.doesNotMatch(accountLifecycleSource, /registerRemotePushToken\(null\)\)\.catch/);

const recordingScreenSource = readFileSync(
  new URL('../src/features/dashboard/screens/RecordingScreen.tsx', import.meta.url),
  'utf8',
);
assert.match(recordingScreenSource, /const toggleRecording = \(\) => \{[\s\S]*?try \{[\s\S]*?recorder\.record/);

const petValidation = loadModule('../src/features/pet/petValidation.ts', {});
const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const formatDate = (date) =>
  `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate(),
  ).padStart(2, '0')}`;
assert.equal(
  petValidation.getBirthDateError(formatDate(today)),
  '생년월일은 오늘 이전 날짜를 입력해주세요.',
);
assert.equal(petValidation.getBirthDateError(formatDate(yesterday)), undefined);

const multipartParts = [];
appendMultipartJson({ append: (...part) => multipartParts.push(part) }, { petName: '초코' });
assert.deepEqual(multipartParts, [['data', { string: '{"petName":"초코"}', type: 'application/json' }]]);
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

const locationService = loadModule('../src/features/auth/signup/services/locationService.ts', {
  '@/src/services/locationApi': {
    resolveRemoteLocation: async () => ({ regionName: '서울특별시 종로구' }),
  },
  'expo-location': {
  },
  'react-native': { Platform: { OS: 'android' } },
});
assert.equal(
  await locationService.getRegionFromCoordinates(37.5665, 126.978),
  '서울특별시 종로구',
);

const mypageApi = loadModule('../src/features/mypage/services/mypageApi.ts', {
  '@/src/services/apiClient': { apiRequest: async () => undefined },
});
assert.deepEqual(
  mypageApi.parseRemoteMyPageProfileEnvelope({
    code: 'MYPAGE_PROFILE_200',
    isSuccess: true,
    message: 'ok',
    result: {
      email: 'USER@example.com',
      intro: '소개',
      isNew: false,
      linkedAccounts: [{ linkedAt: '2026-08-20T09:00:00', socialType: 'KAKAO' }],
      name: '보호자',
      nickname: '젤리',
      profileUrl: null,
      regionCode: '11680',
      regionName: '강남구',
      uid: 'user-id',
    },
  }),
  {
    email: 'user@example.com',
    intro: '소개',
    isNew: false,
    linkedAccounts: [{ email: 'user@example.com', method: 'kakao' }],
    name: '보호자',
    nickname: '젤리',
    profileUrl: null,
    regionCode: '11680',
    regionName: '강남구',
    uid: 'user-id',
  },
);
assert.deepEqual(
  mypageApi.parseRemoteNotificationSettingsEnvelope({
    code: 'MYPAGE_NOTI_200',
    isSuccess: true,
    message: 'ok',
    result: {
      aiAnalysisAlarm: true,
      benefitAlarm: false,
      chatAlarm: false,
      communityAlarm: true,
      dndEnabled: true,
      dndEnd: '07:00:00',
      dndStart: '22:00:00',
      healthAlarm: true,
      todoAlarm: true,
    },
  }, 'MYPAGE_NOTI_200'),
  {
    aiAnalysis: true,
    chat: false,
    community: true,
    doNotDisturbEnabled: true,
    doNotDisturbEnd: '07:00',
    doNotDisturbStart: '22:00',
    healthAlert: true,
    schedule: true,
  },
);
assert.deepEqual(
  mypageApi.parseRemoteMyPageHomeEnvelope({
    code: 'MYPAGE_HOME_200',
    isSuccess: true,
    message: 'ok',
    result: { subscribe: { active: true, displayName: '꼬마 젤리', plan: 'BASIC' } },
  }),
  { subscription: { active: true, displayName: '꼬마 젤리', plan: 'BASIC' } },
);

const billingRequests = [];
const billingApi = loadModule('../src/features/mypage/services/mypageApi.ts', {
  '@/src/services/apiClient': {
    apiRequest: async (path, options) => {
      billingRequests.push([path, options]);
      if (path === '/mypage/subscription') {
        return {
          code: options?.method === 'POST' ? 'BILLING_PLAN_CHANGE_200' : 'BILLING_PLAN_200',
          isSuccess: true,
          result: {
            pendingPlan: options?.method === 'POST' ? 'PRO' : null,
            periodEnd: '2026-09-20T09:00:00',
            plan: options?.method === 'POST' ? 'ULTIMATE' : 'PRO',
            plans: [
              { displayName: '꼬마 젤리', plan: 'BASIC', priceWon: 0 },
              { displayName: '새싹 젤리', plan: 'PRO', priceWon: 4900 },
              { displayName: '어른 젤리', plan: 'ULTIMATE', priceWon: 9900 },
            ],
            status: options?.method === 'POST' ? 'PENDING_CHANGE' : 'ACTIVE',
          },
        };
      }
      if (path === '/mypage/payments?size=50') {
        return {
          code: 'BILLING_PAYMENT_LIST_200',
          isSuccess: true,
          result: {
            content: [{ amount: 4900, displayName: '새싹 젤리', paidAt: '2026-08-20T09:00:00', paymentId: 2, status: 'SUCCESS', type: 'PURCHASE' }],
            hasNext: true,
            nextCursor: 'next',
          },
        };
      }
      if (path === '/mypage/payments?size=50&cursor=next') {
        return {
          code: 'BILLING_PAYMENT_LIST_200',
          isSuccess: true,
          result: {
            content: [{ amount: 4900, displayName: '새싹 젤리', paidAt: '2026-07-20T09:00:00', paymentId: 1, status: 'SUCCESS', type: 'RENEWAL' }],
            hasNext: false,
            nextCursor: null,
          },
        };
      }
      return {
        code: 'BILLING_PAYMENT_DETAIL_200',
        isSuccess: true,
        result: { amount: 4900, displayName: '새싹 젤리', paidAt: '2026-08-20T09:00:00', paymentId: 2, status: 'SUCCESS', type: 'PURCHASE' },
      };
    },
  },
});
assert.deepEqual(await billingApi.getRemoteSubscription(), {
  currentPlanId: 'little-jelly',
  nextBillingDate: '2026-09-20',
  pendingPlanId: null,
  pendingType: null,
  plans: [
    { id: 'baby-jelly', monthlyPrice: 0, name: '꼬마 젤리' },
    { id: 'little-jelly', monthlyPrice: 4900, name: '새싹 젤리' },
    { id: 'adult-jelly', monthlyPrice: 9900, name: '어른 젤리' },
  ],
});
assert.deepEqual(await billingApi.changeRemoteSubscription('adult-jelly'), {
  currentPlanId: 'adult-jelly',
  nextBillingDate: '2026-09-20',
  pendingPlanId: 'little-jelly',
  pendingType: 'downgrade',
  plans: [
    { id: 'baby-jelly', monthlyPrice: 0, name: '꼬마 젤리' },
    { id: 'little-jelly', monthlyPrice: 4900, name: '새싹 젤리' },
    { id: 'adult-jelly', monthlyPrice: 9900, name: '어른 젤리' },
  ],
});
assert.deepEqual(billingRequests[1], [
  '/mypage/subscription',
  { json: { plan: 'ULTIMATE' }, method: 'POST' },
]);
assert.deepEqual((await billingApi.getRemotePaymentHistory()).map(({ id }) => id), ['2', '1']);
assert.equal((await billingApi.getRemotePayment('2')).title, '새싹 젤리 결제');
assert.deepEqual(billingRequests.slice(2).map(([path]) => path), [
  '/mypage/payments?size=50',
  '/mypage/payments?size=50&cursor=next',
  '/mypage/payments/2',
]);

const mypageMutationRequests = [];
const mypageMutations = loadModule('../src/features/mypage/services/mypageApi.ts', {
  '@/src/services/apiClient': {
    apiRequest: async (path, options) => {
      mypageMutationRequests.push([path, options]);
      if (path === '/mypage/withdrawal/preview') {
        return {
          code: 'MYPAGE_WITHDRAWAL_PREVIEW_200',
          isSuccess: true,
          message: 'ok',
          result: {
            hasOngoingMarketTrade: false,
            subscribePlan: 'FREE',
            subscribing: false,
          },
        };
      }
      return {
        code: {
          '/mypage/profile/image': 'MYPAGE_PROFILE_IMAGE_DELETE_200',
          '/mypage/region': 'MYPAGE_REGION_UPDATE_200',
          '/mypage/withdrawal': 'MYPAGE_WITHDRAWAL_200',
          '/users/me/push-token': 'USER_PUSH_TOKEN_200',
        }[path],
        isSuccess: true,
        message: 'ok',
        result: null,
      };
    },
  },
});
await mypageMutations.updateRemoteMyPageRegion('11680');
await mypageMutations.registerRemotePushToken(null);
await mypageMutations.deleteRemoteProfileImage();
assert.deepEqual(await mypageMutations.getRemoteWithdrawalPreview(), {
  hasOngoingMarketTrade: false,
  subscribePlan: 'FREE',
  subscribing: false,
});
await mypageMutations.deleteRemoteAccount();
assert.deepEqual(mypageMutationRequests, [
  ['/mypage/region', { json: { regionCode: '11680' }, method: 'PATCH' }],
  ['/users/me/push-token', { json: { pushToken: '' }, method: 'PUT' }],
  ['/mypage/profile/image', { method: 'DELETE' }],
  ['/mypage/withdrawal/preview', undefined],
  ['/mypage/withdrawal', { method: 'DELETE' }],
]);

const activityRequests = [];
const activityApi = loadModule('../src/features/mypage/services/mypageActivityApi.ts', {
  '@/src/services/apiClient': {
    apiRequest: async (path) => {
      activityRequests.push(path);
      return path.includes('cursor=next')
        ? {
            code: 'MYPAGE_COMMUNITY_POSTS_200',
            isSuccess: true,
            message: 'ok',
            result: { content: [{ postId: 2 }], hasNext: false, nextCursor: null, size: 50 },
          }
        : {
            code: 'MYPAGE_COMMUNITY_POSTS_200',
            isSuccess: true,
            message: 'ok',
            result: { content: [{ postId: 1 }], hasNext: true, nextCursor: 'next', size: 50 },
          };
    },
  },
});
assert.deepEqual(await activityApi.getRemoteMyPageActivityPostIds('authored'), ['1', '2']);
assert.deepEqual(activityRequests, [
  '/mypage/community/posts?size=50',
  '/mypage/community/posts?size=50&cursor=next',
]);

const supportModule = loadModule('../src/features/mypage/support/services/supportRepository.ts', {
  '@react-native-async-storage/async-storage': { default: {} },
  '@/src/services/apiClient': {
    apiRequest: async () => ({
      code: 'MYPAGE_INQUIRY_LIST_200',
      isSuccess: true,
      message: 'ok',
      result: {
        content: [{
          answer: null,
          attachmentUrls: [],
          content: '문의 내용',
          createdAt: '2026-08-20T09:00:00+09:00',
          inquiryId: 1,
          inquiryType: 'PET',
          status: 'RECEIVED',
        }],
        hasNext: false,
        nextCursor: null,
        size: 50,
      },
    }),
  },
  '@/src/utils/file': { appendMultipartImage: () => undefined, appendMultipartJson: () => undefined },
  '../supportValidation': {
    createEmptyInquiryDraft: () => ({}),
    normalizeStoredSupportState: () => ({}),
  },
});
assert.deepEqual(await supportModule.supportRepository.getInquiries('user-id'), [{
  answer: null,
  answeredAt: null,
  body: '문의 내용',
  createdAt: '2026-08-20T09:00:00+09:00',
  id: '1',
  images: [],
  status: 'waiting',
  type: 'pet',
  userId: 'user-id',
}]);

const termsApi = loadModule('../src/features/auth/terms/TermsRepository.ts', {
  '@/src/services/apiClient': { apiRequest: async () => undefined },
  './types': {
    TERM_IDS: {
      age: 'age-confirmation',
      location: 'location-service',
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
    result: [
      { effectiveAt: '2025-01-01', required: true, title: '서비스 이용약관', type: 'TERMS_OF_SERVICE', version: '1.0' },
      { type: 'MARKETING_PUSH' },
    ],
  }),
  ['TERMS_OF_SERVICE'],
);
assert.deepEqual(
  termsApi.parseTermsListDefinitionsEnvelope({
    code: 'TERMS_LIST_200',
    isSuccess: true,
    message: 'ok',
    result: [
      {
        effectiveAt: '2025-01-01',
        required: true,
        title: '서비스 이용약관',
        type: 'TERMS_OF_SERVICE',
        version: '1.0',
      },
    ],
  }),
  [
    {
      body: '',
      effectiveDate: '2025-01-01',
      id: 'service-terms',
      kind: 'service',
      required: true,
      scope: 'signup',
      status: 'active',
      title: '서비스 이용약관',
      version: '1.0',
    },
  ],
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
assert.deepEqual(
  termsApi.parseMyPageTermsEnvelope({
    code: 'MYPAGE_TERMS_200',
    isSuccess: true,
    message: 'ok',
    result: [{ agreed: true, type: 'MARKETING_PUSH', version: '1.0' }],
  }),
  [],
);
assert.throws(() =>
  termsApi.parseTermDetailEnvelope({
    code: 'TERMS_DETAIL_200',
    isSuccess: true,
    message: 'ok',
    result: {
      content: '약관 내용',
      effectiveAt: '2025-02-31',
      required: true,
      title: '서비스 이용약관',
      type: 'TERMS_OF_SERVICE',
      version: '1.0',
    },
  }),
);

const mypageMappers = loadModule('../src/features/mypage/mypageMappers.ts', {});
const enabledNotificationSettings = {
  aiAnalysis: true,
  chat: true,
  community: true,
  doNotDisturbEnabled: true,
  doNotDisturbEnd: '07:00',
  doNotDisturbStart: '22:00',
  healthAlert: true,
  schedule: true,
};
assert.deepEqual(
  mypageMappers.disablePushNotifications(enabledNotificationSettings),
  {
    ...enabledNotificationSettings,
    aiAnalysis: false,
    chat: false,
    community: false,
    doNotDisturbEnabled: false,
    healthAlert: false,
    schedule: false,
  },
);
