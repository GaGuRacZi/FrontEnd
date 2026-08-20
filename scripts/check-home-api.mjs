import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadModule(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(module, module.exports, (id) => {
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected import: ${id}`);
  });
  return module.exports;
}

const todoRequests = [];
const todoApi = loadModule('../src/features/home/services/todoApi.ts', {
  '@/src/services/apiClient': {
    apiRequest: async (path, options) => {
      todoRequests.push([path, options]);
      if (path === '/api/tags') {
        if (options?.method === 'POST') {
          return {
            isSuccess: true,
            result: { tagColorEnum: 'PURPLE', tagId: 3, tagName: '병원' },
          };
        }
        return {
          isSuccess: true,
          result: [{ tagColorEnum: 'GREEN', tagId: 2, tagName: '산책' }],
        };
      }
      if (path === '/api/tags/2') {
        return {
          isSuccess: true,
          result: {
            tagColorEnum: options?.method === 'PATCH' ? options.json.tagColorEnum : 'GREEN',
            tagId: 2,
            tagName: options?.method === 'PATCH' ? options.json.tagName : '산책',
          },
        };
      }
      if (path === '/api/tags/2?force=true') {
        return { isSuccess: true, result: null };
      }
      if (path.includes('/calendar?')) {
        return {
          isSuccess: true,
          result: { days: [{ completedCount: 1, date: '2026-08-20', totalCount: 2 }] },
        };
      }
      const todo = {
        completed: path.includes('/complete?'),
        date: '2026-08-20',
        routineEnabled: true,
        subTodo: '30분',
        tagColorEnum: 'GREEN',
        tagId: 2,
        tagName: '산책',
        todo: '산책하기',
        todoId: 1,
        todoTime: '09:00:30',
      };
      if (path.includes('/complete?')) {
        return { isSuccess: true, result: todo };
      }
      if (path === '/api/todos/1') {
        return {
          isSuccess: true,
          result: {
            ...todo,
            endDate: '2026-08-31',
            routineEnabled: true,
            startDate: '2026-08-01',
            week: 'WED',
          },
        };
      }
      if (path === '/api/todos/2') {
        return {
          isSuccess: true,
          result: {
            ...todo,
            endDate: null,
            routineEnabled: false,
            startDate: null,
            todoId: 2,
            week: null,
          },
        };
      }
      if (path.startsWith('/api/todos/1?date=')) {
        return { isSuccess: true, result: null };
      }
      if (path === '/api/todos' && options?.method === 'POST') {
        return { isSuccess: true, result: todo };
      }
      return {
        isSuccess: true,
        result: [todo],
      };
    },
  },
});

assert.deepEqual(await todoApi.getRemoteTodoTags(), [{ color: 'GREEN', id: '2', name: '산책' }]);
assert.deepEqual(await todoApi.createRemoteTodoTag('병원', 'PURPLE'), {
  color: 'PURPLE', id: '3', name: '병원',
});
assert.deepEqual(todoRequests.at(-1), [
  '/api/tags',
  { json: { tagColorEnum: 'PURPLE', tagName: '병원' }, method: 'POST' },
]);
assert.deepEqual(await todoApi.getRemoteTodoTag('2'), { color: 'GREEN', id: '2', name: '산책' });
assert.deepEqual(await todoApi.updateRemoteTodoTag('2', '저녁 산책', 'ORANGE'), {
  color: 'ORANGE', id: '2', name: '저녁 산책',
});
assert.deepEqual(todoRequests.at(-1), [
  '/api/tags/2',
  { json: { tagColorEnum: 'ORANGE', tagName: '저녁 산책' }, method: 'PATCH' },
]);
await todoApi.deleteRemoteTodoTag('2');
assert.deepEqual(todoRequests.at(-1), ['/api/tags/2?force=true', { method: 'DELETE' }]);
assert.deepEqual(await todoApi.getRemoteTodos('2026-08-20'), [{
  completed: false,
  date: '2026-08-20',
  description: '30분',
  id: '1',
  routineEnabled: true,
  tag: { color: 'GREEN', id: '2', name: '산책' },
  timeLabel: '09:00',
  title: '산책하기',
}]);
assert.deepEqual(await todoApi.getRemoteTodoCalendar(2026, 8), [
  { completed: 1, date: '2026-08-20', total: 2 },
]);
await todoApi.completeRemoteTodo('1', '2026-08-20', true);
assert.deepEqual(todoRequests.at(-1), [
  '/api/todos/1/complete?completed=true&date=2026-08-20',
  { method: 'PATCH' },
]);
assert.deepEqual(await todoApi.getRemoteTodoDetail('1'), {
  description: '30분',
  endDate: '2026-08-31',
  id: '1',
  routineEnabled: true,
  startDate: '2026-08-01',
  tag: { color: 'GREEN', id: '2', name: '산책' },
  timeLabel: '09:00',
  title: '산책하기',
  week: 'WED',
});
assert.deepEqual(await todoApi.getRemoteTodoDetail('2'), {
  description: '30분',
  endDate: undefined,
  id: '2',
  routineEnabled: false,
  startDate: undefined,
  tag: { color: 'GREEN', id: '2', name: '산책' },
  timeLabel: '09:00',
  title: '산책하기',
  week: undefined,
});
await todoApi.createRemoteTodo({
  date: '2026-08-20',
  routineEnabled: false,
  tagId: '2',
  title: '산책하기',
});
assert.deepEqual(todoRequests.at(-1), [
  '/api/todos',
  {
    json: {
      date: '2026-08-20',
      endDate: undefined,
      routineEnabled: false,
      startDate: undefined,
      subTodo: undefined,
      tagId: 2,
      todo: '산책하기',
      todoTime: undefined,
      week: undefined,
    },
    method: 'POST',
  },
]);
await todoApi.updateRemoteTodo('1', {
  endDate: '2026-08-31',
  routineEnabled: true,
  startDate: '2026-08-01',
  tagId: '2',
  timeLabel: '10:00',
  title: '저녁 산책',
  week: 'WED',
});
assert.deepEqual(todoRequests.at(-1), [
  '/api/todos/1',
  {
    json: {
      date: undefined,
      endDate: '2026-08-31',
      routineEnabled: true,
      startDate: '2026-08-01',
      subTodo: undefined,
      tagId: 2,
      todo: '저녁 산책',
      todoTime: '10:00',
      week: 'WED',
    },
    method: 'PUT',
  },
]);
await todoApi.deleteRemoteTodo('1', '2026-08-20');
assert.deepEqual(todoRequests.at(-1), [
  '/api/todos/1?date=2026-08-20&deleteAll=false',
  { method: 'DELETE' },
]);
await todoApi.deleteRemoteTodo('1', '2026-08-20', true);
assert.deepEqual(todoRequests.at(-1), [
  '/api/todos/1?date=2026-08-20&deleteAll=true',
  { method: 'DELETE' },
]);

const { hasRoutineOccurrence } = loadModule('../src/features/home/utils/scheduleHelpers.ts', {});
const monday = new Date(2026, 7, 24);
assert.equal(hasRoutineOccurrence('매일', [], monday, monday), true);
assert.equal(hasRoutineOccurrence('특정요일', [0], monday, monday), true);
assert.equal(hasRoutineOccurrence('특정요일', [1], monday, monday), false);
assert.equal(hasRoutineOccurrence('특정요일', [6], monday, new Date(2026, 7, 30)), true);

const visitRequests = [];
const prescription = {
  caution: null,
  dosageAmount: 1,
  dosageUnit: '정',
  frequency: 'ONCE_DAILY',
  ingredient: '성분',
  medicationId: 7,
  mealTiming: 'AFTER_MEAL',
  nameEn: 'Medicine',
  nameKo: '약',
  prescriptionId: 3,
  source: 'CATALOG',
  takeTimes: ['MORNING'],
};
const visitApi = loadModule('../src/features/dashboard/services/visitApi.ts', {
  '@/src/utils/file': {
    appendMultipartAudio: () => undefined,
    appendMultipartJson: () => undefined,
  },
  '@/src/services/apiClient': {
    apiRequest: async (path, options) => {
      visitRequests.push([path, options]);
      if (path === '/visits' && options?.method === 'POST') {
        return { code: 'VISIT_CREATE_200', isSuccess: true, result: { petId: 1, status: 'PROCESSING', visitId: 5 } };
      }
      if (path === '/visits?petId=1') {
        return {
          code: 'VISIT_LIST_200',
          isSuccess: true,
          result: [
            { aiSummaryGenerated: true, oneLineSummary: '이전 요약', status: 'READY', visitId: 3, visitedAt: '2026-08-19T23:30:00Z', visitName: '이전 진료' },
            { aiSummaryGenerated: true, oneLineSummary: '요약', status: 'READY', visitId: 4, visitedAt: '2026-08-20T09:00:00+09:00', visitName: '정기 진료' },
          ],
        };
      }
      if (path === '/visits/4/ai-summary') {
        return { code: 'VISIT_AI_SUMMARY_200', isSuccess: true, result: { aiSummaryMd: '상세 요약', coin: 9, usedCoin: 1, visitId: 4 } };
      }
      if (path === '/visits/4') {
        return {
          code: 'VISIT_GET_200',
          isSuccess: true,
          result: {
            aiSummaryMd: '요약', aiSummaryStatus: 'DONE', audioUrl: null, careItems: [], careNote: null,
            diagnosisFindings: [], failReason: null, hospitalName: '병원', oneLineSummary: '요약', petAgeLabel: '2살', petId: 1,
            petName: '초코', petProfileUrl: null, prescriptions: [prescription], status: 'READY', visitId: 4,
            visitedAt: '2026-08-20T09:00:00', visitName: '정기 진료',
          },
        };
      }
      if (path.startsWith('/medications?')) {
        return { code: 'MEDICATION_SEARCH_200', isSuccess: true, result: [{ ingredient: '성분', medicationId: 7, nameEn: 'Medicine', nameKo: '약' }] };
      }
      if (path === '/medications/7') {
        return {
          code: 'MEDICATION_GET_200',
          isSuccess: true,
          result: {
            descriptionMd: '약 설명',
            ingredient: '성분',
            medicationId: 7,
            nameEn: 'Medicine',
            nameKo: '약',
            precautionMd: '주의사항',
          },
        };
      }
      if (path === '/visits/4/transcript') {
        return {
          code: 'VISIT_TRANSCRIPT_200',
          isSuccess: true,
          result: { audioUrl: 'https://cdn.example.com/visit-audio/4.m4a', durationSec: 12, hospitalName: '병원', turns: [{ endSec: 12, speaker: 'VET', startSec: 0, text: '안녕하세요' }], visitId: 4, visitedAt: '2026-08-20T09:00:00' },
        };
      }
      if (path === '/visits/4/medications' && options?.method === 'POST') {
        return { code: 'VISIT_PRESCRIPTION_ADD_200', isSuccess: true, result: prescription };
      }
      return { code: 'VISIT_PRESCRIPTION_DELETE_200', isSuccess: true, result: null };
    },
  },
});

assert.equal((await visitApi.getRemoteVisits('1'))[0].id, '4');
assert.equal((await visitApi.getRemoteVisitDetail('4')).prescriptions[0].medicationId, '7');
assert.equal((await visitApi.generateRemoteAiSummary('4')).summary, '상세 요약');
assert.equal((await visitApi.searchRemoteMedications('약'))[0].nameKo, '약');
assert.deepEqual(await visitApi.getRemoteMedicationDetail('7'), {
  description: '약 설명',
  id: '7',
  ingredient: '성분',
  nameEn: 'Medicine',
  nameKo: '약',
  precaution: '주의사항',
});
const transcript = await visitApi.getRemoteTranscript('4');
assert.equal(transcript.audioUrl, 'https://cdn.example.com/visit-audio/4.m4a');
assert.equal(transcript.turns[0].speaker, 'VET');
assert.deepEqual(await visitApi.createRemoteVisit('1', 'file:///visit.m4a'), {
  id: '5', petId: '1', status: 'PROCESSING',
});
assert.equal(visitRequests.at(-1)[0], '/visits');
assert.equal(visitRequests.at(-1)[1].method, 'POST');
await visitApi.addRemotePrescription('4', {
  dosageAmount: 1,
  frequency: 'ONCE_DAILY',
  medicationId: '7',
  mealTiming: 'AFTER_MEAL',
  source: 'CATALOG',
});
await assert.rejects(() => visitApi.addRemotePrescription('4', {
  dosageAmount: 1.5,
  frequency: 'ONCE_DAILY',
  medicationId: '7',
  mealTiming: 'AFTER_MEAL',
  source: 'CATALOG',
}));
await assert.rejects(() => visitApi.addRemotePrescription('4', {
  dosageAmount: 1,
  frequency: 'ONCE_DAILY',
  mealTiming: 'AFTER_MEAL',
  source: 'CATALOG',
}));
await assert.rejects(() => visitApi.addRemotePrescription('4', {
  dosageAmount: 1,
  frequency: 'ONCE_DAILY',
  mealTiming: 'AFTER_MEAL',
  source: 'CUSTOM',
}));
await visitApi.deleteRemotePrescription('4', '3');
assert.deepEqual(visitRequests.at(-1), ['/visits/4/medications/3', { method: 'DELETE' }]);

const recordingScreenSource = readFileSync(
  new URL('../src/features/dashboard/screens/RecordingScreen.tsx', import.meta.url),
  'utf8',
);
assert.doesNotMatch(recordingScreenSource, /recorder\.isRecording/);
assert.match(recordingScreenSource, /mountedRef\.current = false/);

console.log('home API contract checks passed');
