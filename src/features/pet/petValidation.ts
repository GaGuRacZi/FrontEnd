import type { PetFormValues, PetType } from './types';

const BIRTH_DATE_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})$/;

type PetRequiredField =
  | 'birthDate'
  | 'breed'
  | 'gender'
  | 'name'
  | 'neutered'
  | 'type'
  | 'weight';

export type PetFormErrors = Partial<Record<PetRequiredField, string>>;

function getPetNameError(value: string) {
  return value.trim() ? undefined : '이름을 입력해주세요.';
}

export function parseBirthDate(value: string) {
  const match = BIRTH_DATE_PATTERN.exec(value);

  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
}

export function getBirthDateError(value: string) {
  if (!BIRTH_DATE_PATTERN.test(value)) {
    return '생년월일을 YYYY.MM.DD 형식으로 입력해주세요.';
  }

  const date = parseBirthDate(value);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!date || date >= today) {
    return '생년월일은 오늘 이전 날짜를 입력해주세요.';
  }

  return undefined;
}

export function getWeightError(value: string) {
  const weight = Number(value);

  if (!value.trim()) return '몸무게를 입력해주세요.';
  if (!Number.isFinite(weight) || weight <= 0 || weight > 200) {
    return '몸무게는 0kg 초과, 200kg 이하로 입력해주세요.';
  }

  return undefined;
}

export function isBreedForPet(type: PetType | null, breed: string) {
  return Boolean(type && breed.trim());
}

export function formatBirthDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;

  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

export function formatBirthDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

export function validatePetForm(values: PetFormValues): PetFormErrors {
  return {
    birthDate: getBirthDateError(values.birthDate),
    breed: isBreedForPet(values.type, values.breed)
      ? undefined
      : '견종·묘종을 선택해주세요.',
    gender: values.gender ? undefined : '성별을 선택해주세요.',
    name: getPetNameError(values.name),
    neutered: values.neutered === null ? '중성화 여부를 선택해주세요.' : undefined,
    type: values.type ? undefined : '반려동물 종류를 선택해주세요.',
    weight: getWeightError(values.weight),
  };
}

export function hasValidPetForm(values: PetFormValues) {
  return Object.values(validatePetForm(values)).every((error) => !error);
}
