import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

for (const path of ['app/medication.tsx', 'app/notifications.tsx', 'app/schedule.tsx']) {
  assert.match(read(path), /<AuthSessionGuard>/, `${path} must reject unauthenticated deep links`);
}

for (const path of [
  'src/features/dashboard/screens/DashboardScreen.tsx',
  'src/features/dashboard/screens/DiagnosisSummaryScreen.tsx',
  'src/features/dashboard/screens/RecordingScreen.tsx',
  'src/features/dashboard/screens/TranscriptScreen.tsx',
]) {
  assert.doesNotMatch(read(path), /if \(!selectedPet\) return null/, `${path} must not render a blank screen`);
}

const diagnosis = read('src/features/dashboard/screens/DiagnosisSummaryScreen.tsx');
assert.match(diagnosis, /pets\.find\(\(pet\) => pet\.id === detail\.petId\)/);
assert.ok(diagnosis.indexOf('setDetail((current) => current') < diagnosis.indexOf('void loadDetail().catch'));

const recording = read('src/features/dashboard/screens/RecordingScreen.tsx');
assert.doesNotMatch(recording, /automaticStartRef/);
assert.match(recording, /'음성을 인식하시겠습니까\?'/);
assert.match(recording, /isAnimating=\{recorderState\.isRecording\}/);
const completeRecording = recording.slice(
  recording.indexOf('const completeRecording'),
  recording.indexOf('useEffect', recording.indexOf('const completeRecording')),
);
assert.doesNotMatch(completeRecording, /if \(recorderState\.isRecording\)/);
assert.match(completeRecording, /await recorder\.stop\(\)/);

const aiProcessing = read('src/features/dashboard/screens/AiProcessingScreen.tsx');
assert.match(aiProcessing, /failureReason \?\? '잠시 후 진료 요약에서 다시 확인해주세요'/);

const recordingAnimation = read('src/features/dashboard/components/RecordingPetAnimation.tsx');
assert.match(recordingAnimation, /if \(!isAnimating\)/);

const transcript = read('src/features/dashboard/screens/TranscriptScreen.tsx');
assert.match(transcript, /useAudioPlayer\(transcript\?\.audioUrl \?\? null/);
assert.match(transcript, /useAudioPlayerStatus\(player\)/);
assert.match(transcript, /Math\.max\(insets\.bottom, SPACING\.xxxl\)/);
assert.match(transcript, /style=\{styles\.scrollView\}/);
assert.match(transcript, /await player\.seekTo\(0\)/);
assert.match(transcript, /player\.play\(\)/);

const schedule = read('src/features/home/ScheduleTodoStore.tsx');
assert.match(schedule, /activeUserRef\.current !== userId/);
assert.match(schedule, /if \(created > 0\) return 'partial'/);
assert.match(schedule, /if \(startDate === endDate\) \{[\s\S]*?date: startDate,[\s\S]*?routineEnabled: false/);
const scheduleScreen = read('src/features/home/screens/ScheduleScreen.tsx');
assert.match(scheduleScreen, /const date = new Date\(viewYear, viewMonth, selectedDay\)/);
assert.match(scheduleScreen, /setRoutineStart\(date\);[\s\S]*?setRoutineEnd\(date\)/);

const petStore = read('src/features/pet/PetStore.tsx');
assert.ok(petStore.indexOf('applyState({ pets: nextPets') < petStore.indexOf('petRepository.saveState(userId'));

const myPageStore = read('src/features/mypage/MyPageStore.tsx');
assert.ok(myPageStore.indexOf('applyState(nextState);') < myPageStore.indexOf('mypageRepository.saveState(userId, nextState)'));
assert.match(myPageStore, /setSubscriptionLoadError\(subscriptionResult\.status === 'rejected'\)/);
assert.match(myPageStore, /setPaymentHistoryLoadError\(paymentHistoryResult\.status === 'rejected'\)/);
assert.match(read('src/features/mypage/services/mypageApi.ts'), /plans: readPlanCatalog\(subscription\.plans\)/);

const supportStore = read('src/features/mypage/support/SupportStore.tsx');
assert.match(supportStore, /setInquiriesLoadError\(remoteInquiries\.status === 'rejected'\)/);
const inquiryDetail = read('src/features/mypage/support/screens/InquiryDetailScreen.tsx');
assert.match(inquiryDetail, /if \(active && !loadedInquiry\) setLoadFailed\(true\)/);
assert.match(inquiryDetail, /actionLabel="다시 시도"/);
const submitStart = supportStore.indexOf('const submitInquiry');
const submitFlow = supportStore.slice(submitStart, supportStore.indexOf('const clearScreenSession', submitStart));
assert.ok(submitFlow.indexOf('applyState(nextState)') < submitFlow.indexOf('supportRepository.saveState(userId, nextState)'));

const healthStore = read('src/features/health-summary/HealthSummaryStore.tsx');
for (const collection of ['weightRecords', 'walkRecords', 'medicalExpenseRecords']) {
  const removal = healthStore.indexOf(`${collection}: current.${collection}.filter`);
  assert.notEqual(removal, -1);
  assert.ok(removal < healthStore.indexOf('void refreshPetSummary', removal));
}

const healthSummaryScreen = read('src/features/health-summary/screens/HealthSummaryScreen.tsx');
assert.match(healthSummaryScreen, /if \(!healthSummaryReady\)/);

const home = read('src/features/home/screens/HomeScreens.tsx');
assert.match(home, /healthRecordLoadError/);
assert.match(home, /사이트를 열지 못했어요/);

const appProviders = read('src/providers/AppProviders.tsx');
assert.match(appProviders, /if \(target\?\.type === 'todo'\) reloadSchedule\(\)/);
assert.match(appProviders, /if \(target\?\.type === 'post'\) void reloadCommunity\(\)/);

const terms = read('src/features/auth/terms/screens/TermsAgreementScreen.tsx');
assert.match(terms, /await logoutRemoteSession\(\);\s+await clearSignupDraft\(\);/);

const communityStore = read('src/features/community/CommunityStore.tsx');
assert.match(communityStore, /if \(!currentUserId\) \{[\s\S]*?applyState\(EMPTY_STATE\)/);
assert.doesNotMatch(communityStore, /getRemoteCommunityTags\([^)]*\)\.catch/);
const communityScreen = read('src/features/community/screens/CommunityScreen.tsx');
assert.doesNotMatch(communityScreen, /YOUR_PRODUCTION/);
assert.match(communityScreen, /AD_TALK/);
assert.match(communityScreen, /AD_MARKET/);
assert.match(communityScreen, /<AdBanner type="talk"/);
assert.match(communityScreen, /<AdBanner type="market"/);

const chatStore = read('src/features/chat/ChatStore.tsx');
assert.match(chatStore, /function getUserChatState/);
assert.match(chatStore, /getUserChatState\(await chatRepository\.loadState\(\), userId\)/);

const petForm = read('src/features/pet/screens/PetFormScreen.tsx');
assert.match(petForm, /mode === 'edit' \? \(base\?\.\[field\] \?\? null\) : null/);
assert.match(petForm, /removeImageLabel=\{mode === 'edit' \? '사진 변경 취소' : '사진 삭제'\}/);

console.log('frontend flow checks passed');
