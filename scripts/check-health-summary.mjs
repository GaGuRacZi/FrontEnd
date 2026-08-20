import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadModule(path) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(module, module.exports, () => {
    throw new Error('Unexpected import');
  });
  return module.exports;
}

const selectors = loadModule('../src/features/health-summary/healthSummarySelectors.ts');

assert.deepEqual(
  selectors.getWeightOverview([
    { date: '2026.08.01', time: '오전 9:00', weight: 4.1 },
    { date: '2026.08.10', time: '오후 8:00', weight: 4.4 },
  ]),
  {
    currentWeight: 4.4,
    difference: 0.3,
    latest: { date: '2026.08.10', time: '오후 8:00', weight: 4.4 },
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
