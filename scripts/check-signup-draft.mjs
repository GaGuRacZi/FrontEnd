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

const { createSignupDraft, isCurrentSignupDraft, parseStoredSignupDraft } =
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
