import type { DiagnosisListItem } from './types';
import type { DiagnosisDetail } from './types';

export const MOCK_DIAGNOSIS_LIST: DiagnosisListItem[] = [
	{
		id: 'diag-1',
		date: '2026.07.04',
		diagnosisTitle: '관절염 정기 진료',
		status: 'summarizing',
	},
	{
		id: 'diag-2',
		date: '2026.07.01',
		diagnosisTitle: '관절염 정기 진료',
		status: 'completed',
		summaryNote: '카프로펜 처방 · 재검사 2주 후',
	},
	{
		id: 'diag-3',
		date: '2026.06.18',
		diagnosisTitle: '예방 접종 및 건강검진',
		status: 'completed',
		summaryNote: '특이사항 없음',
	},
];

export const MOCK_DIAGNOSIS_DETAIL: Record<string, DiagnosisDetail> = {
	'diag-1': {
		id: 'diag-1',
		date: '2026.07.04',
		diagnosisTitle: '관절염 정기 진료',
		status: 'summarizing',
		findings: ['정기 검진 진행 중'],
		medications: [],
		careNotes: [],
	},
	'diag-2': {
		id: 'diag-2',
		date: '2026.07.01',
		diagnosisTitle: '관절염 정기 진료',
		status: 'completed',
		findings: [
			'앞다리 파행 및 기동성 저하',
			'관절 부위 촉진 시 통증 반응',
			'X-ray상 관절 간격 협소 확인',
		],
		findingConclusion: '퇴행성 관절염 진단 (11세 고령견 해당)',
		medications: [
			{
				id: 'med-1',
				name: '메타캄',
				dosageLabel: 'Meloxicam 1.5mg/ml',
				frequencyLabel: '하루 2회',
				doseLabel: '1정씩',
				mealTimingLabel: '식사 후',
				timings: ['morning', 'dinner'],
				warningNote: '위장 자극 주의, 공복 투여 금지',
			},
			{
				id: 'med-2',
				name: '개구락지 감기약',
				dosageLabel: 'Carprofen 25mg',
				frequencyLabel: '하루 2회',
				doseLabel: '1정씩',
				mealTimingLabel: '식사 후',
				timings: ['morning', 'dinner'],
				warningNote: '식사 후 복용',
			},
		],
		careNotes: [
			'미끄러운 바닥 피하기 (매트 깔아주기)',
			'격렬 운동·점프 자제, 완만 산책으로 대체',
			'수중 재활 치료 병행하기',
			'체중 관리로 관절 부담 줄이기',
		],
		careFooterNote: '증상이 심해지거나 식욕 저하 시 즉시 재방문 권장',
	},
	'diag-3': {
		id: 'diag-3',
		date: '2026.06.18',
		diagnosisTitle: '예방 접종 및 건강검진',
		status: 'completed',
		findings: ['특이사항 없음'],
		medications: [],
		careNotes: ['다음 예방접종 예정일 확인 필요'],
	},
};