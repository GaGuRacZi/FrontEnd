export type PetSummary = {
    id: string;
    name: string;
    ageLabel: string;       // "7살 7개월" , 생년월일 -> 나이 변환은 이미 거쳐서 넘겨주기
    weightLabel: string;    // "3.4kg"
    photoUrl?: string;
};

export type TodoStatus = 'done' | 'pending';

export type TodoSummaryItem = {
    id: string;
    title: string;          // "알약 복용"
    timeLabel: string;      // "08:00"
    status: TodoStatus;
};

export type RecentDiagnosis = {
    id: string;
    title: string;          // "관절염 진단"
    dateLabel: string;      // "2026.07.06"
};

export type MedicationSummaryItem = {
    id: string;
    name: string;           // "카미녹스"
    doseLabel: string;      // "1일 2회"
};