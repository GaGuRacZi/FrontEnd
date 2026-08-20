export type DiagnosisStatus = 'completed' | 'failed' | 'summarizing';

type BaseDiagnosisListItem = {
	date: string; // '2026.07.04' 형태의 표시용 라벨
	diagnosisTitle: string; // '관절염 정기 진료'
	id: string;
	petId?: string;
};

export type DiagnosisListItem = BaseDiagnosisListItem & {
	status: DiagnosisStatus;
	summaryNote?: string;
};

export type DiagnosisMedicationTiming = 'bedtime' | 'dinner' | 'lunch' | 'morning';

export type DiagnosisMedication = {
	description?: string;
	doseLabel: string; // '1정씩'
	dosageLabel: string; // 'Meloxicam 1.5mg/ml'
	frequencyLabel: string; // '하루 2회'
	id: string;
	mealTimingLabel: string; // '식사 후'
	name: string;
	timings: DiagnosisMedicationTiming[];
	warningNote?: string;
};

export type DiagnosisTranscriptSpeaker = 'owner' | 'vet';

export type DiagnosisTranscriptMessage = {
	id: string;
	speaker: DiagnosisTranscriptSpeaker;
	text: string;
};
