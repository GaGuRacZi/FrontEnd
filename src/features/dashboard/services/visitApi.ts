import { apiRequest } from '@/src/services/apiClient';
import { appendMultipartAudio, appendMultipartJson } from '@/src/utils/file';

export type RemoteVisitStatus = 'FAILED' | 'PROCESSING' | 'READY';
export type RemoteAiSummaryStatus = 'DONE' | 'GENERATING' | 'NONE';
export type RemotePrescriptionFrequency = 'AS_NEEDED' | 'ONCE_DAILY' | 'THREE_TIMES' | 'TWICE_DAILY';
export type RemotePrescriptionMealTiming = 'AFTER_MEAL' | 'ANYTIME' | 'BEFORE_MEAL' | 'BETWEEN_MEALS';
export type RemotePrescriptionTakeTime = 'BEDTIME' | 'EVENING' | 'LUNCH' | 'MORNING';

export type RemoteVisit = {
  aiSummaryGenerated: boolean;
  id: string;
  oneLineSummary: string | null;
  status: RemoteVisitStatus;
  visitedAt: string;
  visitName: string | null;
};

export type RemoteCreatedVisit = {
  id: string;
  petId: string;
  status: 'PROCESSING';
};

export type RemoteAiSummary = {
  coin: number;
  summary: string;
  usedCoin: number;
  visitId: string;
};

export type RemotePrescription = {
  caution: string | null;
  dosageAmount: number | null;
  dosageUnit: string | null;
  frequency: RemotePrescriptionFrequency;
  id: string;
  ingredient: string | null;
  medicationId: string | null;
  mealTiming: RemotePrescriptionMealTiming;
  nameEn: string | null;
  nameKo: string;
  source: 'CATALOG' | 'CUSTOM';
  takeTimes: RemotePrescriptionTakeTime[];
};

export type RemoteVisitDetail = {
  aiSummary: string | null;
  aiSummaryStatus: RemoteAiSummaryStatus;
  audioUrl: string | null;
  careItems: string[];
  careNote: string | null;
  diagnosisFindings: string[];
  failReason: string | null;
  hospitalName: string | null;
  id: string;
  oneLineSummary: string | null;
  petAgeLabel: string | null;
  petId: string;
  petName: string;
  petProfileUrl: string | null;
  prescriptions: RemotePrescription[];
  status: RemoteVisitStatus;
  visitedAt: string;
  visitName: string | null;
};

export type RemoteMedicationSearchResult = {
  id: string;
  ingredient: string | null;
  nameEn: string | null;
  nameKo: string;
};

export type RemoteTranscript = {
  audioUrl: string | null;
  durationSec: number;
  hospitalName: string | null;
  id: string;
  turns: {
    endSec: number | null;
    id: string;
    speaker: 'OWNER' | 'VET';
    startSec: number | null;
    text: string;
  }[];
  visitedAt: string;
};

export class VisitApiContractError extends Error {
  constructor() {
    super('Invalid visit API response.');
    this.name = 'VisitApiContractError';
  }
}

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new VisitApiContractError();
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new VisitApiContractError();
  return value.trim();
}

function readNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readId(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value) && Number(value) > 0) return value;
  throw new VisitApiContractError();
}

function readSuccess(value: unknown, code: string) {
  const envelope = readRecord(value);
  if (envelope.isSuccess !== true || envelope.code !== code) throw new VisitApiContractError();
  return envelope.result;
}

function readStatus(value: unknown): RemoteVisitStatus {
  if (value === 'PROCESSING' || value === 'READY' || value === 'FAILED') return value;
  throw new VisitApiContractError();
}

function readStringList(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new VisitApiContractError();
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function readVisit(value: unknown): RemoteVisit {
  const visit = readRecord(value);
  if (typeof visit.aiSummaryGenerated !== 'boolean') throw new VisitApiContractError();
  return {
    aiSummaryGenerated: visit.aiSummaryGenerated,
    id: readId(visit.visitId),
    oneLineSummary: readNullableString(visit.oneLineSummary),
    status: readStatus(visit.status),
    visitedAt: readString(visit.visitedAt),
    visitName: readNullableString(visit.visitName),
  };
}

function readCreatedVisit(value: unknown): RemoteCreatedVisit {
  const visit = readRecord(value);
  if (visit.status !== 'PROCESSING') throw new VisitApiContractError();
  return { id: readId(visit.visitId), petId: readId(visit.petId), status: visit.status };
}

function readAiSummary(value: unknown): RemoteAiSummary {
  const summary = readRecord(value);
  if (
    typeof summary.coin !== 'number' ||
    !Number.isFinite(summary.coin) ||
    typeof summary.usedCoin !== 'number' ||
    !Number.isFinite(summary.usedCoin)
  ) {
    throw new VisitApiContractError();
  }
  return {
    coin: summary.coin,
    summary: readString(summary.aiSummaryMd),
    usedCoin: summary.usedCoin,
    visitId: readId(summary.visitId),
  };
}

function readPrescription(value: unknown): RemotePrescription {
  const prescription = readRecord(value);
  const source = prescription.source;
  const frequency = prescription.frequency;
  const mealTiming = prescription.mealTiming;
  if (
    (source !== 'CATALOG' && source !== 'CUSTOM') ||
    (frequency !== 'ONCE_DAILY' && frequency !== 'TWICE_DAILY' && frequency !== 'THREE_TIMES' && frequency !== 'AS_NEEDED') ||
    (mealTiming !== 'BEFORE_MEAL' && mealTiming !== 'AFTER_MEAL' && mealTiming !== 'BETWEEN_MEALS' && mealTiming !== 'ANYTIME') ||
    !Array.isArray(prescription.takeTimes) ||
    prescription.takeTimes.some((item) => item !== 'MORNING' && item !== 'LUNCH' && item !== 'EVENING' && item !== 'BEDTIME') ||
    (prescription.dosageAmount !== null && prescription.dosageAmount !== undefined && (typeof prescription.dosageAmount !== 'number' || !Number.isFinite(prescription.dosageAmount)))
  ) {
    throw new VisitApiContractError();
  }

  return {
    caution: readNullableString(prescription.caution),
    dosageAmount: typeof prescription.dosageAmount === 'number' ? prescription.dosageAmount : null,
    dosageUnit: readNullableString(prescription.dosageUnit),
    frequency,
    id: readId(prescription.prescriptionId),
    ingredient: readNullableString(prescription.ingredient),
    medicationId: prescription.medicationId === null || prescription.medicationId === undefined
      ? null
      : readId(prescription.medicationId),
    mealTiming,
    nameEn: readNullableString(prescription.nameEn),
    nameKo: readString(prescription.nameKo),
    source,
    takeTimes: prescription.takeTimes,
  };
}

function readDetail(value: unknown): RemoteVisitDetail {
  const detail = readRecord(value);
  const aiSummaryStatus = detail.aiSummaryStatus;
  if (
    (aiSummaryStatus !== 'NONE' && aiSummaryStatus !== 'GENERATING' && aiSummaryStatus !== 'DONE') ||
    !Array.isArray(detail.prescriptions)
  ) {
    throw new VisitApiContractError();
  }

  return {
    aiSummary: readNullableString(detail.aiSummaryMd),
    aiSummaryStatus,
    audioUrl: readNullableString(detail.audioUrl),
    careItems: readStringList(detail.careItems),
    careNote: readNullableString(detail.careNote),
    diagnosisFindings: readStringList(detail.diagnosisFindings),
    failReason: readNullableString(detail.failReason),
    hospitalName: readNullableString(detail.hospitalName),
    id: readId(detail.visitId),
    oneLineSummary: readNullableString(detail.oneLineSummary),
    petAgeLabel: readNullableString(detail.petAgeLabel),
    petId: readId(detail.petId),
    petName: readString(detail.petName),
    petProfileUrl: readNullableString(detail.petProfileUrl),
    prescriptions: detail.prescriptions.map(readPrescription),
    status: readStatus(detail.status),
    visitedAt: readString(detail.visitedAt),
    visitName: readNullableString(detail.visitName),
  };
}

function readTranscript(value: unknown): RemoteTranscript {
  const transcript = readRecord(value);
  if (!Array.isArray(transcript.turns) || typeof transcript.durationSec !== 'number' || transcript.durationSec < 0) {
    throw new VisitApiContractError();
  }
  return {
    audioUrl: readNullableString(transcript.audioUrl),
    durationSec: transcript.durationSec,
    hospitalName: readNullableString(transcript.hospitalName),
    id: readId(transcript.visitId),
    turns: transcript.turns.map((value, index) => {
      const turn = readRecord(value);
      if (
        (turn.speaker !== 'VET' && turn.speaker !== 'OWNER') ||
        (turn.startSec !== null && turn.startSec !== undefined && typeof turn.startSec !== 'number') ||
        (turn.endSec !== null && turn.endSec !== undefined && typeof turn.endSec !== 'number')
      ) {
        throw new VisitApiContractError();
      }
      return {
        endSec: typeof turn.endSec === 'number' ? turn.endSec : null,
        id: String(index),
        speaker: turn.speaker,
        startSec: typeof turn.startSec === 'number' ? turn.startSec : null,
        text: readString(turn.text),
      };
    }),
    visitedAt: readString(transcript.visitedAt),
  };
}

export async function getRemoteVisits(petId: string) {
  const id = Number(petId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new VisitApiContractError();
  const result = readSuccess(
    await apiRequest<unknown>(`/visits?${new URLSearchParams({ petId: String(id) }).toString()}`),
    'VISIT_LIST_200',
  );
  if (!Array.isArray(result)) throw new VisitApiContractError();
  return result.map(readVisit);
}

export async function createRemoteVisit(petId: string, audioUri: string) {
  const id = Number(petId);
  if (!Number.isSafeInteger(id) || id <= 0 || !audioUri.trim()) {
    throw new VisitApiContractError();
  }
  const formData = new FormData();
  appendMultipartJson(formData, { petId: id });
  appendMultipartAudio(formData, 'audio', audioUri);
  return readCreatedVisit(readSuccess(await apiRequest<unknown>('/visits', {
    body: formData,
    method: 'POST',
  }), 'VISIT_CREATE_200'));
}

export async function getRemoteVisitDetail(visitId: string) {
  const id = Number(visitId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new VisitApiContractError();
  return readDetail(readSuccess(await apiRequest<unknown>(`/visits/${id}`), 'VISIT_GET_200'));
}

export async function generateRemoteAiSummary(visitId: string) {
  const id = Number(visitId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new VisitApiContractError();
  return readAiSummary(readSuccess(
    await apiRequest<unknown>(`/visits/${id}/ai-summary`, { method: 'POST' }),
    'VISIT_AI_SUMMARY_200',
  ));
}

export async function searchRemoteMedications(query: string) {
  const q = query.trim();
  if (!q) return [];
  const result = readSuccess(
    await apiRequest<unknown>(`/medications?${new URLSearchParams({ q, topK: '10' }).toString()}`),
    'MEDICATION_SEARCH_200',
  );
  if (!Array.isArray(result)) throw new VisitApiContractError();
  return result.map((value): RemoteMedicationSearchResult => {
    const medication = readRecord(value);
    return {
      id: readId(medication.medicationId),
      ingredient: readNullableString(medication.ingredient),
      nameEn: readNullableString(medication.nameEn),
      nameKo: readString(medication.nameKo),
    };
  });
}

export async function addRemotePrescription(visitId: string, input: {
  caution?: string;
  dosageAmount: number;
  dosageUnit?: string;
  frequency: RemotePrescriptionFrequency;
  ingredient?: string;
  medicationId?: string;
  mealTiming: RemotePrescriptionMealTiming;
  nameEn?: string;
  nameKo?: string;
  source: 'CATALOG' | 'CUSTOM';
  takeTimes?: RemotePrescriptionTakeTime[];
}) {
  const id = Number(visitId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new VisitApiContractError();
  const medicationId = input.medicationId === undefined ? undefined : Number(input.medicationId);
  if (medicationId !== undefined && (!Number.isSafeInteger(medicationId) || medicationId <= 0)) {
    throw new VisitApiContractError();
  }
  return readPrescription(readSuccess(await apiRequest<unknown>(`/visits/${id}/medications`, {
    json: {
      caution: input.caution,
      dosageAmount: input.dosageAmount,
      dosageUnit: input.dosageUnit,
      frequency: input.frequency,
      ingredient: input.ingredient,
      medicationId,
      mealTiming: input.mealTiming,
      nameEn: input.nameEn,
      nameKo: input.nameKo,
      source: input.source,
      takeTimes: input.takeTimes ?? [],
    },
    method: 'POST',
  }), 'VISIT_PRESCRIPTION_ADD_200'));
}

export async function deleteRemotePrescription(visitId: string, prescriptionId: string) {
  const visit = Number(visitId);
  const prescription = Number(prescriptionId);
  if (!Number.isSafeInteger(visit) || visit <= 0 || !Number.isSafeInteger(prescription) || prescription <= 0) {
    throw new VisitApiContractError();
  }
  readSuccess(
    await apiRequest<unknown>(`/visits/${visit}/medications/${prescription}`, { method: 'DELETE' }),
    'VISIT_PRESCRIPTION_DELETE_200',
  );
}

export async function getRemoteTranscript(visitId: string) {
  const id = Number(visitId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new VisitApiContractError();
  return readTranscript(readSuccess(
    await apiRequest<unknown>(`/visits/${id}/transcript`),
    'VISIT_TRANSCRIPT_200',
  ));
}
