export type PetSummary = {
    id: string;
    name: string;
    breedLabel: string;
    ageLabel: string;       // "7살 7개월" , 생년월일 -> 나이 변환은 이미 거쳐서 넘겨주기
    weightLabel: string;    // "3.4kg"
    photoUrl?: string;
};

export type TodoStatus = 'done' | 'pending';
export type TodoCategory = 'hospital' | 'medication' | 'walk'

export type TodoSummaryItem = {
    id: string;
    title: string;          // "알약 복용"
    description?: string;   // "'심장 초음파 관련' 같은 부가 설명, 없으면 생략"
    timeLabel: string;      // "08:00"
    status: TodoStatus;
    category: TodoCategory;
};

export type RecentDiagnosis = {
    id: string;
    title: string;          // "관절염 진단"
    statusLabel: string;    // "AI 요약 완료"
    nextVisitLabel?: string;      // "다음 진료: 2026.07.06", 없으면 날짜 대신 '예약 없음'
};

export type MedicationSummaryItem = {
    id: string;
    name: string;           // "카미녹스"
    doseLabel: string;      // "1일 2회"
};

export type ChangeSentiment = 'negative' | 'positive';

export type MonthlyHealthMetric = {
  changeSentiment: ChangeSentiment;
  changeLabel: string; // "+0.1kg", "-20,000원"
  id: string;
  label: string;       // "체중"
  valueLabel: string;  // "3.4kg"
};

export type PetGender = '남아' | '여아';
export type NeuterStatus = '완료' | '미완료';
export type BloodDonationStatus = '등록' | '미등록';

export type PetDetail = {
  ageLabel: string;
  bloodDonationStatus: BloodDonationStatus;
  breedLabel: string;
  gender: PetGender;
  guardianName?: string;
  hasRegistrationPhoto: boolean;
  id: string;
  name: string;
  neuterStatus: NeuterStatus;
  photoUrl?: string;
  registrationNumber?: string;
  speciesLabel: string;
  weightLabel: string;
};