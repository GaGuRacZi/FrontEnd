export type HealthTabType = 'weight' | 'walk' | 'medical';

export type BodyCondition = 'lean' | 'ideal' | 'overweight';
export type AppetiteCondition = 'low' | 'normal' | 'high';

export interface WeightRecord {
    id: string;
    petId: string;
    date: string;
    time: string;
    weight: number;
    deltaFromLastMonth?: number;
    bodyCondition: BodyCondition;
    appetite: AppetiteCondition;
    memo?: string;
    photoUri?: string;
    recordedAt?: string;
    isDirectInput?: boolean;
}

export type WalkIntensity = 'relaxed' | 'moderate' | 'active';

export interface WalkRecord {
    id: string;
    petId: string;
    date: string;
    dayLabel: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    distanceKm: number;
    intensity: WalkIntensity;
    weatherText?: string;
    temperatureText?: string;
    routePoints?: { latitude: number; longitude: number }[];
    significant?: string;
    excrement: {
        urination: boolean;
        defecation: boolean;
        specialNote: boolean;
    };
}

export interface MedicalExpenseItem {
    id: string;
    name: string;
    cost: number;
}

export interface MedicalExpenseRecord {
    id: string;
    petId: string;
    date: string;
    hospitalName: string;
    totalCost: number;
    paymentMethod: string;
    items: MedicalExpenseItem[];
}

export interface MonthlySummary {
    monthLabel: string;
    year: number;
    month: number;
    weightRecords: WeightRecord[];
    walkRecords: WalkRecord[];
    medicalExpenseRecords: MedicalExpenseRecord[];
}
