import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(
  new URL('../src/features/auth/signup/services/signupDraftContract.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadedModule = { exports: {} };
new Function('module', 'exports', compiled)(loadedModule, loadedModule.exports);

const {
  canResumeLocalSignupDraft,
  createSignupDraft,
  isCurrentSignupDraft,
  parseStoredSignupDraft,
} =
  loadedModule.exports;
const secretValues = ['Abcd1234', 'Abcd1234-confirm', '123456', 'verification-token'];
const draft = createSignupDraft({
  data: {
    birthDate: '2020.01.01',
    breed: '말티즈',
    email: 'paw@example.com',
    emailVerificationCode: secretValues[2],
    emailVerificationId: 'verification-id',
    emailVerificationToken: secretValues[3],
    introduction: '안녕하세요',
    latitude: 37.5,
    longitude: 127,
    name: '파우',
    neutered: true,
    nickname: '파우보호자',
    password: secretValues[0],
    passwordConfirm: secretValues[1],
    petGender: 'female',
    petName: '파우',
    petType: 'dog',
    profileImageUri: 'file:///profile-images/signup-draft/photo.jpg',
    region: '서울특별시 강남구',
    regionSource: 'search',
    weight: '3.2',
  },
  method: 'local',
  remoteUserId: null,
  savedAt: new Date().toISOString(),
  sessionId: 'signup-session',
});
const serialized = JSON.stringify(draft);

for (const field of [
  'emailVerificationCode',
  'emailVerificationId',
  'emailVerificationToken',
  'password',
  'passwordConfirm',
]) {
  assert.equal(serialized.includes(field), false);
}
for (const value of secretValues) assert.equal(serialized.includes(value), false);
assert.deepEqual(parseStoredSignupDraft(serialized), draft);
assert.equal(canResumeLocalSignupDraft(draft, 'PAW@example.com', 'user-id'), true);
assert.equal(canResumeLocalSignupDraft(draft, 'other@example.com', 'user-id'), false);
assert.equal(
  canResumeLocalSignupDraft({ ...draft, remoteUserId: 'other-user' }, 'paw@example.com', 'user-id'),
  false,
);
assert.equal(isCurrentSignupDraft(draft), true);
assert.equal(
  isCurrentSignupDraft(draft, Date.parse(draft.savedAt) + 8 * 24 * 60 * 60 * 1000),
  false,
);
const unsupportedSchemaDraft = { ...JSON.parse(serialized), schemaVersion: 2 };
assert.equal(parseStoredSignupDraft(JSON.stringify(unsupportedSchemaDraft)), null);
const draftWithPassword = JSON.parse(serialized);
draftWithPassword.data.password = secretValues[0];
assert.equal(parseStoredSignupDraft(JSON.stringify(draftWithPassword)), null);

const signupValidationSource = readFileSync(
  new URL('../src/features/auth/signup/signupValidation.ts', import.meta.url),
  'utf8',
);
const signupValidationModule = { exports: {} };
new Function(
  'module',
  'exports',
  'require',
  ts.transpileModule(signupValidationSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
)(signupValidationModule, signupValidationModule.exports, (id) => {
  if (id === '../authValidation') return { getEmailError: () => undefined };
  if (id === '@/src/features/pet/petValidation') {
    return {
      getBirthDateError: () => undefined,
      getWeightError: () => undefined,
      isBreedForPet: () => true,
    };
  }
  throw new Error(`Unexpected import: ${id}`);
});
const resumedSignupData = {
  ...draft.data,
  emailVerified: true,
  method: 'local',
  password: '',
  passwordConfirm: '',
};
assert.equal(
  signupValidationModule.exports.getNextSignupRoute(resumedSignupData, true),
  '/signup/complete',
);
assert.equal(
  signupValidationModule.exports.getNextSignupRoute(resumedSignupData),
  '/signup/credentials',
);

const credentialsScreenSource = readFileSync(
  new URL('../src/features/auth/signup/screens/SignupCredentialsScreen.tsx', import.meta.url),
  'utf8',
);
const completionSource = readFileSync(
  new URL('../src/features/auth/signup/hooks/useSignupCompletion.ts', import.meta.url),
  'utf8',
);
const termsSource = readFileSync(
  new URL('../src/features/auth/terms/screens/TermsAgreementScreen.tsx', import.meta.url),
  'utf8',
);
const draftFlushIndex = credentialsScreenSource.indexOf('await flushSignupDraft()');
const localSignupIndex = credentialsScreenSource.indexOf(
  'await signUpWithLocalCredentials(data.email, data.password)',
);
const pendingSessionIndex = credentialsScreenSource.indexOf(
  "await prepareRemoteSignup(outcome.session, 'local', signupSessionId)",
);
const userInfoRouteIndex = credentialsScreenSource.indexOf(
  "router.push('/signup/user-info')",
  pendingSessionIndex,
);
assert.equal(draftFlushIndex < localSignupIndex, true);
assert.equal(localSignupIndex < pendingSessionIndex, true);
assert.equal(pendingSessionIndex < userInfoRouteIndex, true);
assert.equal(credentialsScreenSource.includes("outcome.kind === 'link-required'"), true);
assert.equal(completionSource.includes('signUpWithLocalCredentials'), false);
assert.equal(termsSource.includes("if (!pendingRemoteSignupUserId)"), true);
assert.equal(termsSource.includes("router.replace('/login');"), true);

const petValidationSource = readFileSync(
  new URL('../src/features/pet/petValidation.ts', import.meta.url),
  'utf8',
);
const petValidationModule = { exports: {} };
new Function(
  'module',
  'exports',
  ts.transpileModule(petValidationSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
)(petValidationModule, petValidationModule.exports);
const today = new Date();
const todayValue = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const yesterdayValue = `${yesterday.getFullYear()}.${String(yesterday.getMonth() + 1).padStart(2, '0')}.${String(yesterday.getDate()).padStart(2, '0')}`;
assert.equal(
  petValidationModule.exports.getBirthDateError(todayValue),
  '생년월일은 오늘 이전 날짜를 입력해주세요.',
);
assert.equal(petValidationModule.exports.getBirthDateError(yesterdayValue), undefined);

const transactionSource = readFileSync(
  new URL('../src/features/auth/signup/services/signupTransactionStore.ts', import.meta.url),
  'utf8',
);
const transactionCompiled = ts.transpileModule(transactionSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const transactionStorage = new Map();
const transactionModule = { exports: {} };
new Function('module', 'exports', 'require', transactionCompiled)(
  transactionModule,
  transactionModule.exports,
  (id) => {
    if (id === '@react-native-async-storage/async-storage') {
      return {
        __esModule: true,
        default: {
          getItem: async (key) => transactionStorage.get(key) ?? null,
          multiRemove: async (keys) => keys.forEach((key) => transactionStorage.delete(key)),
          multiSet: async (entries) => entries.forEach(([key, value]) => transactionStorage.set(key, value)),
          removeItem: async (key) => transactionStorage.delete(key),
        },
      };
    }
    throw new Error(`Unexpected import: ${id}`);
  },
);
const transactionOwner = {
  email: 'paw@example.com',
  method: 'local',
  sessionId: 'signup-session',
  userId: 'user-id',
};
await transactionModule.exports.saveSignupTransaction(transactionOwner, 'committed');
await transactionModule.exports.saveSignupTransaction(transactionOwner, 'committed', '42');
await transactionModule.exports.saveSignupTransaction(transactionOwner, 'committed');
assert.equal(
  (await transactionModule.exports.loadSignupTransaction(transactionOwner.userId)).transaction.createdPetId,
  '42',
);
