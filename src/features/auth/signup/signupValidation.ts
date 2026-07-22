import { getEmailError } from '../authValidation';
import type { SignupData } from './SignupContext';
import {
  getBirthDateError,
  getWeightError,
  isBreedForPet,
} from '@/src/features/pet/petValidation';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export {
  formatBirthDate,
  formatBirthDateValue,
  getBirthDateError,
  getWeightError,
  parseBirthDate,
} from '@/src/features/pet/petValidation';

type SignupFlowRoute =
  | '/signup/complete'
  | '/signup/location'
  | '/signup/pet-info'
  | '/signup/pet-type'
  | '/signup/user-info';

export function getPasswordError(password: string) {
  if (!password) return '비밀번호를 입력해주세요.';
  if (!PASSWORD_PATTERN.test(password)) {
    return '8자 이상, 영문 대소문자와 숫자를 포함해주세요.';
  }

  return undefined;
}

export function getPasswordConfirmError(password: string, passwordConfirm: string) {
  if (!passwordConfirm) return '비밀번호를 한 번 더 입력해주세요.';
  if (password !== passwordConfirm) return '비밀번호가 일치하지 않아요.';

  return undefined;
}

export function getRequiredError(value: string, message: string) {
  return value.trim() ? undefined : message;
}

export function hasValidSignupUserInfo(data: SignupData) {
  const hasRequiredProfile =
    !getRequiredError(data.name, '이름을 입력해주세요.') &&
    !getRequiredError(data.nickname, '닉네임을 입력해주세요.');

  if (data.method === 'kakao') return hasRequiredProfile;

  return (
    hasRequiredProfile &&
    !getEmailError(data.email) &&
    Boolean(data.emailVerificationToken) &&
    !getPasswordError(data.password) &&
    !getPasswordConfirmError(data.password, data.passwordConfirm)
  );
}

export function hasValidSignupPetType(data: SignupData) {
  return isBreedForPet(data.petType, data.breed);
}

export function hasValidSignupPetInfo(data: SignupData) {
  return (
    !getRequiredError(data.petName, '이름을 입력해주세요.') &&
    !getBirthDateError(data.birthDate) &&
    !getWeightError(data.weight) &&
    data.petGender !== null &&
    data.neutered !== null
  );
}

export function hasValidSignupLocation(data: SignupData) {
  return Boolean(data.region.trim());
}

export function getNextSignupRoute(data: SignupData): SignupFlowRoute {
  if (!hasValidSignupUserInfo(data)) return '/signup/user-info';
  if (!hasValidSignupPetType(data)) return '/signup/pet-type';
  if (!hasValidSignupPetInfo(data)) return '/signup/pet-info';
  if (!hasValidSignupLocation(data)) return '/signup/location';

  return '/signup/complete';
}
