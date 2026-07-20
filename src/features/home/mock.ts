// API 연결 하기 전에 검증용 더미 데이더

import type {
    MedicationSummaryItem,
    PetSummary,
    RecentDiagnosis,
    TodoSummaryItem,
} from './types';

export const MOCK_PETS: PetSummary[] = [
    { id: 'pet-1', name: '아리', breedLabel: '말티즈', ageLabel: '11살 7개월', weightLabel: '3.4kg'},
    { id: 'pet-2', name: '몽구', breedLabel: '스피츠', ageLabel: '9살 3개월', weightLabel: '10kg'},
];

export const MOCK_TODOS: TodoSummaryItem[] = [
    { id: 'todo-1', title: '알약 복용', timeLabel: '08:00', status: 'done' },
    { id: 'todo-2', title: '심장약 복용', timeLabel: '20:00', status: 'pending' },
    { id: 'todo-3', title: '병원 지료', timeLabel: '14:00', status: 'pending' },
];

export const MOCK_RECENT_DIAGNOSIS: RecentDiagnosis = {
    id: 'diagnosis-1',
    title: '관절염 진단',
    dateLabel: '2026.07.06',
};

export const MOCK_MEDICATIONS: MedicationSummaryItem[] = [
    { id: 'med-1', name: '카미녹스', doseLabel: '1일 2회' },
    { id: 'med-2', name: '오메가3', doseLabel: '1일 1회' },
]