import type { DiagnosisMedication } from '@/src/features/dashboard/types';

export type MedicationFrequency = 'asNeeded' | 'onceDaily' | 'threeTimesDaily' | 'twiceDaily';
export type MedicationTiming = 'anytime' | 'beforeMeal' | 'betweenMeals' | 'afterMeal';

export type MedicationEntry = {
	description?: string;
	id: string;
	ingredient?: string;
	name: string;
	quantity: number;
	frequency: MedicationFrequency;
	timing: MedicationTiming;
	warningNote?: string;
};

export const FREQUENCY_LABEL: Record<MedicationFrequency, string> = {
	onceDaily: '1일 1회',
	twiceDaily: '1일 2회',
	threeTimesDaily: '1일 3회',
	asNeeded: '필요 시',
};

export const TIMING_LABEL: Record<MedicationTiming, string> = {
	beforeMeal: '식전',
	afterMeal: '식후',
	betweenMeals: '식간',
	anytime: '무관',
};

export const FREQUENCY_OPTIONS: { label: string; value: MedicationFrequency }[] = [
	{ label: FREQUENCY_LABEL.onceDaily, value: 'onceDaily' },
	{ label: FREQUENCY_LABEL.twiceDaily, value: 'twiceDaily' },
	{ label: FREQUENCY_LABEL.threeTimesDaily, value: 'threeTimesDaily' },
	{ label: FREQUENCY_LABEL.asNeeded, value: 'asNeeded' },
];

export const TIMING_OPTIONS: { label: string; value: MedicationTiming }[] = [
	{ label: TIMING_LABEL.beforeMeal, value: 'beforeMeal' },
	{ label: TIMING_LABEL.afterMeal, value: 'afterMeal' },
	{ label: TIMING_LABEL.betweenMeals, value: 'betweenMeals' },
	{ label: TIMING_LABEL.anytime, value: 'anytime' },
];

export function mapMedicationEntries(
	entries: MedicationEntry[],
	idPrefix: string,
): DiagnosisMedication[] {
	const timestamp = Date.now();

	return entries.map((entry, index) => ({
		id: `${idPrefix}-${timestamp}-${index}`,
		name: entry.name,
		dosageLabel: entry.ingredient ?? '',
		frequencyLabel: FREQUENCY_LABEL[entry.frequency],
		doseLabel: `${entry.quantity}정씩`,
		mealTimingLabel: TIMING_LABEL[entry.timing],
		timings: [],
		description: entry.description,
		warningNote: entry.warningNote,
	}));
}
