import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadModule(path, requireModule = () => {
  throw new Error('Unexpected import');
}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(module, module.exports, requireModule);
  return module.exports;
}

const selectors = loadModule('../src/features/health-summary/healthSummarySelectors.ts');
const requests = [];
const multipartJson = [];
const healthApi = loadModule('../src/features/health-summary/services/healthSummaryApi.ts', (path) => {
  if (path === '@/src/services/apiClient') return {
    apiRequest: async (url, options) => {
      requests.push({ options, url });
      if (url === '/pets/12/weights' && options?.method === 'POST') {
        return {
          isSuccess: true,
          result: {
            appetiteType: 'MIDDLE',
            bodyType: 'HEALTHY',
            memoContent: '저녁 측정',
            petId: 12,
            petWeightId: 30,
            photos: [],
            recordedAt: '2026-08-20T21:05:00',
            weight: 4.2,
          },
        };
      }
      if (url === '/pets/12/weights?month=8&year=2026') {
        return {
          isSuccess: true,
          result: [{
            appetiteType: 'MIDDLE',
            bodyType: 'HEALTHY',
            memoContent: '저녁 측정',
            petId: 12,
            petWeightId: 30,
            photos: [],
            recordedAt: '2026-08-20T21:05:00',
            weight: 4.2,
          }],
        };
      }
      if (url === '/api/walks' && options?.method === 'POST') {
        return {
          isSuccess: true,
          result: {
            durationMinutes: 20,
            endTime: '2026-08-20T18:40:00',
            isStool: false,
            isUrine: true,
            petId: 12,
            significant: null,
            startTime: '2026-08-20T18:20:00',
            temp: 24,
            walkDate: '2026-08-20',
            walkId: 41,
            walkingAmount: 1.2,
            walkType: '보통',
            weatherType: '맑음',
          },
        };
      }
      if (url === '/api/walks?endDate=2026-08-31&petId=12&startDate=2026-08-01') {
        return { isSuccess: true, result: [{ walkId: 41 }, { walkId: 42 }] };
      }
      if (url === '/api/walks/41') {
        return {
          isSuccess: true,
          result: {
            durationMinutes: 20,
            endTime: '2026-08-20T18:40:00',
            isStool: false,
            isUrine: true,
            petId: 12,
            significant: null,
            startTime: '2026-08-20T18:20:00',
            temp: 24,
            walkDate: '2026-08-20',
            walkId: 41,
            walkingAmount: 1.2,
            walkType: '보통',
            weatherType: '맑음',
          },
        };
      }
      if (url === '/api/walks/42') throw new Error('missing-walk-detail');
      if (url === '/api/v1/pets/12/expenses' && options?.method === 'POST') {
        return {
          isSuccess: true,
          result: {
            expenseAmount: 30000,
            expenseDate: '2026-08-20',
            expenseDetails: [{ expenseAmount: 30000, expenseDetailId: 61, expenseDetailName: '진료비' }],
            expenseId: 51,
            expenseName: '파우동물병원',
            paymentType: 'CARD',
            paymentTypeLabel: '카드결제',
            petId: 12,
          },
        };
      }
      if (url === '/api/v1/pets/12/expenses?month=8&year=2026') {
        return { isSuccess: true, result: { expenses: [{ expenseId: 51 }, { expenseId: 52 }] } };
      }
      if (url === '/api/v1/expenses/51') {
        return {
          isSuccess: true,
          result: {
            expenseAmount: 30000,
            expenseDate: '2026-08-20',
            expenseDetails: [{ expenseAmount: 30000, expenseDetailId: 61, expenseDetailName: '진료비' }],
            expenseId: 51,
            expenseName: '파우동물병원',
            paymentType: 'CARD',
            paymentTypeLabel: '카드결제',
            petId: 12,
          },
        };
      }
      if (url === '/api/v1/expenses/52') throw new Error('missing-expense-detail');
      if (url === '/api/walks/finish') {
        return {
          isSuccess: true,
          result: {
            durationMinutes: 2,
            endTime: '2026-08-20T18:22:07',
            isStool: true,
            isUrine: true,
            petId: 12,
            significant: null,
            startTime: '2026-08-20T18:20:01',
            temp: 24,
            walkDate: '2026-08-20',
            walkId: 3,
            walkingAmount: 0,
            walkType: '보통',
            weatherType: '맑음',
          },
        };
      }
      if (url === '/api/walks/statistics/daily?petId=12') {
        return {
          isSuccess: true,
          result: [
            { totalMinutes: 10, walkDate: '2026-08-14' },
            { totalMinutes: 10, walkDate: '2026-08-15' },
            { totalMinutes: 10, walkDate: '2026-08-16' },
            { totalMinutes: 20, walkDate: '2026-08-17' },
            { totalMinutes: 10, walkDate: '2026-08-18' },
            { totalMinutes: 10, walkDate: '2026-08-19' },
            { totalMinutes: 10, walkDate: '2026-08-20' },
          ],
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  };
  if (path === '@/src/utils/file') return {
    appendMultipartImage: () => undefined,
    appendMultipartJson: (_formData, data) => multipartJson.push(data),
  };
  throw new Error(`Unexpected import: ${path}`);
});

assert.deepEqual(
  selectors.getWeightOverview([
    { date: '2026.08.01', recordedAt: '2026-08-01T09:00:00', time: '오전 9:00', weight: 4.1 },
    { date: '2026.08.10', recordedAt: '2026-08-10T20:00:00', time: '오후 8:00', weight: 4.4 },
    { date: '2026.08.10', recordedAt: '2026-08-10T20:00:30', time: '오후 8:00', weight: 4.5 },
  ]),
  {
    currentWeight: 4.5,
    difference: 0.1,
    latest: { date: '2026.08.10', recordedAt: '2026-08-10T20:00:30', time: '오후 8:00', weight: 4.5 },
  },
);

assert.deepEqual(
  healthApi.parseWeightRecord({
    appetiteType: 'MIDDLE',
    bodyType: 'HEALTHY',
    memoContent: '저녁 측정',
    petId: 12,
    petWeightId: 30,
    photos: [{ photoId: 2, sortOrder: 1, url: 'https://example.com/second.jpg' }, { photoId: 1, sortOrder: 0, url: 'https://example.com/first.jpg' }],
    recordedAt: '2026-08-20T21:05:00',
    weight: 4.2,
  }),
  {
    appetite: 'normal',
    bodyCondition: 'ideal',
    date: '2026.08.20',
    id: '30',
    isDirectInput: true,
    memo: '저녁 측정',
    petId: '12',
    photoUri: 'https://example.com/first.jpg',
    recordedAt: '2026-08-20T21:05:00',
    time: '오후 9:05',
    weight: 4.2,
  },
);

assert.deepEqual(
  selectors.getWalkOverview([
    { date: '2026.08.10', durationMinutes: 20 },
    { date: '2026.08.17', durationMinutes: 30 },
    { date: '2026.08.19', durationMinutes: 50 },
  ], new Date(2026, 7, 20)),
  {
    average: 40,
    difference: 20,
    records: [
      { date: '2026.08.17', durationMinutes: 30 },
      { date: '2026.08.19', durationMinutes: 50 },
    ],
  },
);

assert.deepEqual(
  selectors.getMedicalExpenseOverview([
    { date: '2026.07.15', totalCost: 100000 },
    { date: '2026.08.12', totalCost: 75000 },
  ], new Date(2026, 7, 20)),
  { currentTotal: 75000, difference: 25000, previousTotal: 100000, total: 175000 },
);

await healthApi.saveWalkRecord({
  date: '2026.08.20',
  dayLabel: '오늘 산책',
  distanceKm: 0,
  durationMinutes: 2,
  endTime: '18:22',
  excrement: { defecation: true, specialNote: false, urination: true },
  id: '',
  intensity: 'moderate',
  petId: '12',
  startTime: '18:20',
  temperatureText: '24°C',
  weatherText: '맑음',
}, true);

assert.deepEqual(requests[0], {
  options: {
    json: {
      isStool: true,
      isUrine: true,
      petId: 12,
      temp: 24,
      walkingAmount: 0,
      walkType: '보통',
      weatherType: '맑음',
    },
    method: 'PATCH',
  },
  url: '/api/walks/finish',
});

const savedWeight = await healthApi.saveWeightRecord({
  appetite: 'normal',
  bodyCondition: 'ideal',
  date: '2026.08.20',
  id: '',
  memo: '저녁 측정',
  petId: '12',
  time: '오후 9:05',
  weight: 4.2,
});
assert.equal(savedWeight.id, '30');
assert.deepEqual(multipartJson[0], {
  appetiteType: 'MIDDLE',
  bodyType: 'HEALTHY',
  memoContent: '저녁 측정',
  recordedAt: '2026-08-20T21:05:00',
  weight: 4.2,
});
assert.deepEqual((await healthApi.getWeightRecords('12', 2026, 8)).map(({ id }) => id), ['30']);

const savedWalk = await healthApi.saveWalkRecord({
  date: '2026.08.20',
  dayLabel: '산책 기록',
  distanceKm: 1.2,
  durationMinutes: 20,
  endTime: '18:40',
  excrement: { defecation: false, specialNote: false, urination: true },
  id: '',
  intensity: 'moderate',
  petId: '12',
  startTime: '18:20',
  temperatureText: '24°C',
  weatherText: '맑음',
});
assert.equal(savedWalk.id, '41');
assert.deepEqual(
  requests.find(({ options, url }) => url === '/api/walks' && options?.method === 'POST')?.options?.json,
  {
    endTime: '2026-08-20T18:40:00',
    isStool: false,
    isUrine: true,
    petId: 12,
    startTime: '2026-08-20T18:20:00',
    temp: 24,
    walkingAmount: 1.2,
    walkDate: '2026-08-20',
    walkType: '보통',
    weatherType: '맑음',
  },
);
assert.deepEqual((await healthApi.getWalkRecords('12', 2026, 8)).map(({ id }) => id), ['41']);

const savedExpense = await healthApi.saveMedicalExpenseRecord({
  date: '2026.08.20',
  hospitalName: '파우동물병원',
  id: '',
  items: [{ cost: 30000, id: '', name: '진료비' }],
  paymentMethod: '카드결제',
  petId: '12',
  totalCost: 30000,
});
assert.equal(savedExpense.id, '51');
assert.deepEqual((await healthApi.getMedicalExpenseRecords('12', 2026, 8)).map(({ id }) => id), ['51']);

assert.deepEqual(
  await healthApi.getWalkDailySummary('12'),
  [
    { date: '2026.08.14', totalMinutes: 10 },
    { date: '2026.08.15', totalMinutes: 10 },
    { date: '2026.08.16', totalMinutes: 10 },
    { date: '2026.08.17', totalMinutes: 20 },
    { date: '2026.08.18', totalMinutes: 10 },
    { date: '2026.08.19', totalMinutes: 10 },
    { date: '2026.08.20', totalMinutes: 10 },
  ],
);
