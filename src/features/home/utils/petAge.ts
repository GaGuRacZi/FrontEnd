export function calculatePetAgeLabel(birthDateRaw: string): string {
  const normalized = birthDateRaw.replace(/\./g, '-').replace(/-$/, '');
  const birthDate = new Date(normalized);

  if (Number.isNaN(birthDate.getTime())) return '';

  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  let months = now.getMonth() - birthDate.getMonth();

  if (now.getDate() < birthDate.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0) {
    return `${months}개월`;
  }
  return months > 0 ? `${years}살 ${months}개월` : `${years}살`;
}