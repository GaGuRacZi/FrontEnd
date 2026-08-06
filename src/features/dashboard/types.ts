export type DiagnosisStatus = 'completed' | 'summarizing';

export type DiagnosisListItem = {
	date: string; // '2026.07.04' 형태의 표시용 라벨
	diagnosisTitle: string; // '관절염 정기 진료'
	id: string;
	status: DiagnosisStatus;
	summaryNote?: string; // completed일 때만 노출
};

export type DiagnosisMedicationTiming = 'bedtime' | 'dinner' | 'lunch' | 'morning';

export type DiagnosisMedication = {
	doseLabel: string; // '1정씩'
	dosageLabel: string; // 'Meloxicam 1.5mg/ml'
	frequencyLabel: string; // '하루 2회'
	id: string;
	mealTimingLabel: string; // '식사 후'
	name: string;
	timings: DiagnosisMedicationTiming[];
};

export type DiagnosisDetail = {
	aiSummary?: string;
	careFooterNote?: string;
	careNotes: string[];
	date: string;
	diagnosisTitle: string;
	findingConclusion?: string;
	findings: string[];
	id: string;
	medications: DiagnosisMedication[];
	status: DiagnosisStatus;
};