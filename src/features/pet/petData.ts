import type { PetSelectionField } from './types';

export const PET_SELECTION_OPTIONS: Record<PetSelectionField, readonly string[]> = {
  excludedIngredients: ['감', '감자', '강낭콩', '닭고기', '소고기', '유제품', '밀'],
  surgeries: ['탈장 수술', '고관절 수술', '척추 디스크 수술', '중성화 수술', '슬개골 수술'],
  careAreas: ['간', '노화', '눈', '관절', '구강', '피부', '신장'],
};

export const PET_SELECTION_FIELDS = [
  'excludedIngredients',
  'surgeries',
  'careAreas',
] as const satisfies readonly PetSelectionField[];

export const PET_SELECTION_TITLES: Record<PetSelectionField, string> = {
  excludedIngredients: '피해야 할 원료',
  surgeries: '수술 이력',
  careAreas: '관리 부위',
};
