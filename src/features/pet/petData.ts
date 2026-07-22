import type { PetSelectionField, PetType } from './types';

export type BreedOption = {
  name: string;
  popular?: boolean;
};

export const MOCK_BREEDS: Record<PetType, readonly BreedOption[]> = {
  dog: [
    { name: '말티즈', popular: true },
    { name: '푸들', popular: true },
    { name: '비숑', popular: true },
    { name: '포메라니안', popular: true },
    { name: '말티푸' },
    { name: '골든 리트리버' },
    { name: '시츄' },
    { name: '치와와' },
    { name: '진돗개' },
    { name: '웰시코기' },
    { name: '기타' },
  ],
  cat: [
    { name: '코리안 숏헤어', popular: true },
    { name: '러시안 블루', popular: true },
    { name: '샴', popular: true },
    { name: '페르시안', popular: true },
    { name: '브리티시 숏헤어' },
    { name: '스코티시 폴드' },
    { name: '아메리칸 숏헤어' },
    { name: '랙돌' },
    { name: '메인쿤' },
    { name: '기타' },
  ],
};

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
