const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getEmailError(email: string) {
  const value = email.trim();

  if (!value) {
    return '이메일을 입력해주세요.';
  }

  if (!EMAIL_PATTERN.test(value)) {
    return '이메일 형식을 확인해주세요.';
  }

  return undefined;
}
