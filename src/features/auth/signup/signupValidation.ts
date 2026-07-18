const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const BIRTH_DATE_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})$/;

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

export function getPhoneError(phone: string) {
  const digits = phone.replace(/\D/g, '');

  if (digits.length !== 11) return '휴대폰 번호 11자리를 입력해주세요.';
  if (!digits.startsWith('010')) return '010으로 시작하는 휴대폰 번호를 입력해주세요.';

  return undefined;
}

export function getRequiredError(value: string, message: string) {
  return value.trim() ? undefined : message;
}

export function getBirthDateError(value: string) {
  if (!BIRTH_DATE_PATTERN.test(value)) {
    return '생년월일을 YYYY.MM.DD 형식으로 입력해주세요.';
  }

  const date = parseBirthDate(value);

  if (!date || date > new Date()) {
    return '올바른 생년월일을 입력해주세요.';
  }

  return undefined;
}

export function getWeightError(value: string) {
  const weight = Number(value);

  if (!value.trim()) return '몸무게를 입력해주세요.';
  if (!Number.isFinite(weight) || weight <= 0 || weight > 200) {
    return '올바른 몸무게를 입력해주세요.';
  }

  return undefined;
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
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
