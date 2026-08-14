import assert from 'node:assert/strict';

import {
  assertSuccessfulKakaoEnvelope,
  assertSuccessfulLogoutEnvelope,
  KakaoAuthContractError,
  KakaoAuthResponseError,
  normalizeKakaoOnboardingInput,
  parseKakaoLoginEnvelope,
  parseRemoteUserIdentityEnvelope,
  parseRemoteUserProfileEnvelope,
} from '../src/features/auth/services/kakaoAuthContract.ts';

const session = {
  accessToken: 'paw-access-token',
  isNew: true,
  refreshToken: 'paw-refresh-token',
  uid: '123e4567-e89b-42d3-a456-426614174000',
};

assert.deepEqual(
  parseKakaoLoginEnvelope({
    code: 'KAKAO_LOGIN_200_1',
    isSuccess: true,
    message: 'ok',
    result: session,
  }),
  { kind: 'authenticated', session },
);
assert.deepEqual(
  parseRemoteUserIdentityEnvelope({
    code: 'USER_PROFILE_200',
    isSuccess: true,
    message: 'ok',
    result: { isNew: true, uid: session.uid },
  }),
  { isNew: true, uid: session.uid },
);
assert.throws(
  () =>
    parseRemoteUserIdentityEnvelope({
      code: 'USER_PROFILE_200',
      isSuccess: true,
      message: 'ok',
      result: { isNew: false, uid: 'not-a-uuid' },
    }),
  KakaoAuthContractError,
);
assert.deepEqual(
  parseRemoteUserProfileEnvelope({
    code: 'USER_PROFILE_200',
    isSuccess: true,
    message: 'ok',
    result: {
      email: 'paw@example.com',
      intro: null,
      isNew: false,
      name: '홍길동',
      nickname: '길동이',
      profileUrl: null,
      regionName: '서울 강남구',
      uid: session.uid,
    },
  }),
  {
    email: 'paw@example.com',
    intro: '',
    isNew: false,
    name: '홍길동',
    nickname: '길동이',
    profileUrl: null,
    regionName: '서울 강남구',
    uid: session.uid,
  },
);
assert.deepEqual(
  parseRemoteUserIdentityEnvelope({
    code: 'USER_PROFILE_200',
    isSuccess: true,
    message: 'ok',
    result: { new: false, uid: session.uid },
  }),
  { isNew: false, uid: session.uid },
);
assert.throws(
  () =>
    parseRemoteUserIdentityEnvelope({
      code: 'USER_PROFILE_200',
      isSuccess: true,
      message: 'ok',
      result: { isNew: true, new: false, uid: session.uid },
    }),
  KakaoAuthContractError,
);
assert.deepEqual(
  parseKakaoLoginEnvelope({
    code: 'LOGIN_LINK_201',
    isSuccess: true,
    message: 'link',
    result: {
      email: 'paw@example.com',
      existingProvider: 'LOCAL',
      linkToken: '123e4567-e89b-42d3-a456-426614174001',
    },
  }).kind,
  'link-required',
);
assert.throws(
  () =>
    parseKakaoLoginEnvelope({
      code: 'KAKAO_LOGIN_200_1',
      isSuccess: true,
      message: 'ok',
      result: { ...session, uid: 'not-a-uuid' },
    }),
  KakaoAuthContractError,
);
assert.doesNotThrow(() =>
  assertSuccessfulLogoutEnvelope({
    code: 'LOGOUT_200',
    isSuccess: true,
    message: 'ok',
    result: null,
  }),
);
assert.throws(
  () =>
    parseKakaoLoginEnvelope({
      code: 'UNEXPECTED_200',
      isSuccess: true,
      message: 'ok',
      result: session,
    }),
  KakaoAuthContractError,
);
assert.throws(
  () =>
    parseKakaoLoginEnvelope({
      code: 'KAKAO_LOGIN_401',
      isSuccess: false,
      message: 'raw server message',
      result: null,
    }),
  KakaoAuthResponseError,
);
assert.doesNotThrow(() =>
  assertSuccessfulKakaoEnvelope({
    code: 'ONBOAREDING_200',
    isSuccess: true,
    message: 'ok',
    result: null,
  }),
);
assert.doesNotThrow(() =>
  assertSuccessfulKakaoEnvelope({
    code: 'ONBOARDING_200',
    isSuccess: true,
    message: 'ok',
    result: null,
  }),
);
assert.throws(
  () =>
    assertSuccessfulKakaoEnvelope({
      code: 'UNEXPECTED_200',
      isSuccess: true,
      message: 'ok',
      result: null,
    }),
  KakaoAuthContractError,
);
assert.deepEqual(
  normalizeKakaoOnboardingInput({
    agreements: {
      AGE_OVER_14: true,
      LOCATION_SERVICE: false,
      MARKETING_PUSH: false,
      PRIVACY: true,
      PROFILE_EXTRA: true,
      TERMS_OF_SERVICE: true,
    },
    intro: '  반가워요  ',
    location: { latitude: 37.5665, longitude: 126.978 },
    name: ' 홍길동 ',
    nickname: ' 길동이 ',
  }),
  {
    agreements: {
      AGE_OVER_14: true,
      LOCATION_SERVICE: false,
      MARKETING_PUSH: false,
      PRIVACY: true,
      PROFILE_EXTRA: true,
      TERMS_OF_SERVICE: true,
    },
    intro: '반가워요',
    location: { latitude: 37.5665, longitude: 126.978 },
    name: '홍길동',
    nickname: '길동이',
  },
);
assert.throws(
  () =>
    normalizeKakaoOnboardingInput({
      agreements: {
        AGE_OVER_14: true,
        LOCATION_SERVICE: false,
        MARKETING_PUSH: false,
        PRIVACY: true,
        PROFILE_EXTRA: true,
        TERMS_OF_SERVICE: false,
      },
      location: { latitude: 37.5665, longitude: 126.978 },
      name: '홍길동',
      nickname: '길동이',
    }),
  KakaoAuthContractError,
);
