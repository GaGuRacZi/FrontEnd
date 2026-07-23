import type {
  MedicationSummaryItem,
  PetSummary,
  RecentDiagnosis,
  TodoSummaryItem,
  MonthlyHealthMetric,
  PetDetail
} from './types';

export const MOCK_PETS: PetSummary[] = [
  { id: 'pet-1', name: '아리', breedLabel: '말티즈', ageLabel: '11살 7개월', weightLabel: '3.4kg' },
  { id: 'pet-2', name: '몽구', breedLabel: '스피츠', ageLabel: '9살 3개월', weightLabel: '10kg' },
];

export const MOCK_TODOS: TodoSummaryItem[] = [
  { id: 'todo-1', title: '영양제 복용', timeLabel: '08:00', status: 'done', category: 'medication' },
  { id: 'todo-2', title: '심장약 복용', timeLabel: '20:00', status: 'pending', category: 'medication' },
  {
    id: 'todo-3',
    title: '병원 진료',
    description: '심장 초음파 관련',
    timeLabel: '14:00',
    status: 'pending',
    category: 'hospital',
  },
];

export const MOCK_RECENT_DIAGNOSIS: RecentDiagnosis = {
  id: 'diagnosis-1',
  title: '관절염 진단',
  statusLabel: 'AI 요약 완료',
  nextVisitLabel: '다음 진료: 2026년 7월 6일',
};

export const MOCK_MEDICATIONS: MedicationSummaryItem[] = [
  { id: 'med-1', name: '카미녹스', doseLabel: '1일 2회' },
  { id: 'med-2', name: '가리유니', doseLabel: '1일 2회' },
  { id: 'med-3', name: '오메가3', doseLabel: '1일 1회' },
];

export const MOCK_MONTHLY_HEALTH: MonthlyHealthMetric[] = [
  { id: 'weight', label: '체중', valueLabel: '3.4kg', changeLabel: '+0.1kg', changeSentiment: 'positive' },
  { id: 'walk', label: '산책', valueLabel: '주 45분', changeLabel: '+10분', changeSentiment: 'positive' },
  { id: 'medical', label: '의료비', valueLabel: '274,000원', changeLabel: '-20,000원', changeSentiment: 'negative' },
];

export const MOCK_PET_DETAIL: PetDetail = {
  id: 'pet-1',
  name: '아리',
  speciesLabel: '강아지',
  breedLabel: '말티즈',
  ageLabel: '11살 7개월',
  weightLabel: '3.4kg',
  gender: '여아',
  neuterStatus: '완료',
  bloodDonationStatus: '미등록',
  hasRegistrationPhoto: false,
};