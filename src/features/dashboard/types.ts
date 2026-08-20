export type DiagnosisStatus = 'completed' | 'failed' | 'summarizing';

type BaseDiagnosisListItem = {
	date: string;
	diagnosisTitle: string;
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
	doseLabel: string;
	dosageLabel: string;
	frequencyLabel: string;
	id: string;
	mealTimingLabel: string;
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
