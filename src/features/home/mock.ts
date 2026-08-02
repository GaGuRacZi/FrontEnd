import type {
  MedicationSummaryItem,
  PetSummary,
  RecentDiagnosis,
  TodoSummaryItem,
  MonthlyHealthMetric,
  HealthTip,
  NotificationItem,
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
  { id: 'weight', label: '체중', valueLabel: '3.4kg', changeLabel: '+0.1kg' },
  { id: 'walk', label: '산책', valueLabel: '주 45분', changeLabel: '+10분' },
  { id: 'medical', label: '의료비', valueLabel: '274,000원', changeLabel: '-20,000원' },
];


export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'noti-1',
    category: 'schedule',
    categoryLabel: '할 일',
    title: '심장약 복용 체크가 필요해요',
    description: '오늘 20:00 · 미완료 상태예요',
    timeLabel: '3분 전',
    actionLabel: '일정 확인',
    isRead: false,
    dateGroupLabel: '오늘',
  },
  {
    id: 'noti-2',
    category: 'ai',
    categoryLabel: 'AI 요약',
    title: 'AI 진료 요약이 완료됐어요',
    description: '진료 녹음 분석 결과 확인해보세요',
    timeLabel: '12분 전',
    actionLabel: '결과 확인',
    isRead: false,
    dateGroupLabel: '오늘',
  },
  {
    id: 'noti-3',
    category: 'community',
    categoryLabel: '커뮤니티',
    title: '내 게시글에 댓글이 달렸어요',
    description: '"오메가3는 식후 급여가 좋아요"',
    timeLabel: '23분 전',
    actionLabel: '답글 보기',
    isRead: false,
    dateGroupLabel: '오늘',
  },
  {
    id: 'noti-4',
    category: 'blood-donation',
    categoryLabel: '긴급 헌혈',
    title: '근처에서 B형 헌혈 요청이 있어요',
    description: '체중·건강 조건이 맞는지 확인해보세요',
    timeLabel: '2시간 전',
    actionLabel: '지도 보기',
    isRead: true,
    dateGroupLabel: '어제',
  },
  {
    id: 'noti-5',
    category: 'community',
    categoryLabel: '커뮤니티',
    title: '나눔 장터 문의에 답글이 왔어요',
    description: '나눔 가능 시간 확인해보세요',
    timeLabel: '9시간 전',
    actionLabel: '답글 보기',
    isRead: true,
    dateGroupLabel: '어제',
  },
];

export const MOCK_HEALTH_TIP: HealthTip = {
  title: '아리 맞춤 건강 관리 팁',
  description: '오메가3와 음수량을 함께 체크해보세요',
};