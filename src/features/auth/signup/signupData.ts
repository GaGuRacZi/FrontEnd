import type { PetType } from './SignupContext';

export type BreedOption = {
  name: string;
  popular?: boolean;
};

export const MOCK_BREEDS: Record<Exclude<PetType, null>, readonly BreedOption[]> = {
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
