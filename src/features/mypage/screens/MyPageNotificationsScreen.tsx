import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon, AppSwitch, EmptyState, LoadingView } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { AppModal, useAppAlert } from '@/src/components/modal';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { requestPushToken } from '@/src/services/pushNotifications';

import { MyPageHeader } from '../components';
import { isValidClockTime } from '../mypageData';
import { disablePushNotifications } from '../mypageMappers';
import { useMyPageStore } from '../MyPageStore';
import { registerRemotePushToken } from '../services/mypageApi';
import type { NotificationSettings } from '../types';

type NotificationKey = Exclude<
  keyof NotificationSettings,
  'doNotDisturbEnd' | 'doNotDisturbStart'
>;
type PermissionCheckKey = NotificationKey;

const NOTIFICATION_ROWS: {
  description: string;
  key: NotificationKey;
  title: string;
}[] = [
  {
    description: '오늘의 할 일과 복약 알림을 설정해요',
    key: 'schedule',
    title: '할 일 알림',
  },
  {
    description: '건강 기록 관련 알림을 설정해요',
    key: 'healthAlert',
    title: '건강 이상 알림',
  },
  { description: '진료 요약과 OCR 분석 알림을 설정해요', key: 'aiAnalysis', title: 'AI 분석 완료 알림' },
  { description: '댓글·답글·거래 문의 알림을 설정해요', key: 'community', title: '커뮤니티 알림' },
  { description: '새 메시지와 거래 대화 알림을 설정해요', key: 'chat', title: '채팅 알림' },
];

function formatClockInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  if (digits.length === 3 && Number(digits.slice(0, 2)) > 23) {
    return `0${digits[0]}:${digits.slice(1)}`;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function getClockTimeError(value: string) {
  if (!value) return '시간을 입력해주세요.';
  if (!isValidClockTime(value)) return '00:00부터 23:59 사이로 입력해주세요.';
  return undefined;
}

export function MyPageNotificationsScreen() {
  const showAlert = useAppAlert();
  const { isReady, notificationSettings, updateNotificationSettings } = useMyPageStore();
  const permissionRequestRef = useRef(false);
  const [checkingPermissionKey, setCheckingPermissionKey] = useState<PermissionCheckKey | null>(null);
  const [doNotDisturbModalVisible, setDoNotDisturbModalVisible] = useState(false);
  const [doNotDisturbStart, setDoNotDisturbStart] = useState('');
  const [doNotDisturbEnd, setDoNotDisturbEnd] = useState('');
  const [savingDoNotDisturbTime, setSavingDoNotDisturbTime] = useState(false);

  if (!isReady) {
    return (
      <MyPageHeader title="알림 설정">
        <LoadingView label="알림 설정을 불러오고 있어요." />
      </MyPageHeader>
    );
  }

  if (!notificationSettings) {
    return (
      <MyPageHeader title="알림 설정">
        <EmptyState title="알림 설정을 찾지 못했어요." />
      </MyPageHeader>
    );
  }

  const showSaveError = () => {
    showAlert('저장하지 못했어요', '잠시 후 다시 시도해주세요.');
  };

  const requestNotificationPermission = async (key: PermissionCheckKey) => {
    if (permissionRequestRef.current) return false;

    permissionRequestRef.current = true;
    setCheckingPermissionKey(key);

    try {
      const pushToken = await requestPushToken();
      if (pushToken) {
        await registerRemotePushToken(pushToken);
        return true;
      }

      const result = await updateNotificationSettings(
        disablePushNotifications(notificationSettings),
      );
      await registerRemotePushToken(null);
      if (!result.ok) showSaveError();
      return false;
    } catch {
      showSaveError();
      return false;
    } finally {
      permissionRequestRef.current = false;
      setCheckingPermissionKey(null);
    }
  };

  const updateSetting = async (key: NotificationKey, value: boolean) => {
    if (value && key !== 'doNotDisturbEnabled') {
      const hasPermission = await requestNotificationPermission(key);
      if (!hasPermission) return;
    }

    const result = await updateNotificationSettings({ [key]: value });

    if (!result.ok) showSaveError();
  };

  const openDoNotDisturbTimeModal = () => {
    setDoNotDisturbStart(notificationSettings.doNotDisturbStart);
    setDoNotDisturbEnd(notificationSettings.doNotDisturbEnd);
    setDoNotDisturbModalVisible(true);
  };

  const closeDoNotDisturbTimeModal = () => {
    if (!savingDoNotDisturbTime) setDoNotDisturbModalVisible(false);
  };

  const validDoNotDisturbTime =
    isValidClockTime(doNotDisturbStart) &&
    isValidClockTime(doNotDisturbEnd) &&
    doNotDisturbStart !== doNotDisturbEnd;

  const saveDoNotDisturbTime = async () => {
    if (!validDoNotDisturbTime || savingDoNotDisturbTime) return;

    setSavingDoNotDisturbTime(true);
    try {
      const result = await updateNotificationSettings({
        doNotDisturbEnd,
        doNotDisturbStart,
      });
      if (!result.ok) {
        showSaveError();
        return;
      }
      setDoNotDisturbModalVisible(false);
    } catch {
      showSaveError();
    } finally {
      setSavingDoNotDisturbTime(false);
    }
  };

  const renderNotificationCard = (
    title: string,
    description: string,
    value: boolean,
    onChange: (value: boolean) => void,
    key?: string,
    disabled = false,
  ) => (
    <View key={key} style={styles.notificationCard}>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
      <AppSwitch accessibilityLabel={title} disabled={disabled} onChange={onChange} value={value} />
    </View>
  );

  return (
    <>
      <MyPageHeader title="알림 설정">
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <Text style={styles.title}>받을 알림을 선택해주세요</Text>
            <Text style={styles.description}>필요한 알림만 선택해서 받을 수 있어요.</Text>
          </View>

          {NOTIFICATION_ROWS.map((row) =>
            renderNotificationCard(
              row.title,
              row.description,
              notificationSettings[row.key],
              (value) => void updateSetting(row.key, value),
              row.key,
              checkingPermissionKey === row.key,
            ),
          )}

          <View style={styles.doNotDisturbCard}>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>방해 금지 시간</Text>
              <Text style={styles.cardDescription}>
                설정한 시간에도 건강 이상 알림은 받을 수 있어요.
              </Text>
              <Pressable
                accessibilityHint="방해 금지 시작 시간과 종료 시간을 변경합니다."
                accessibilityLabel={`방해 금지 시간 변경, 현재 ${notificationSettings.doNotDisturbStart}부터 ${notificationSettings.doNotDisturbEnd}까지`}
                accessibilityRole="button"
                hitSlop={SPACING.sm}
                onPress={openDoNotDisturbTimeModal}
                style={({ pressed }) => [styles.timePill, pressed && styles.timePillPressed]}
              >
                <Text style={styles.timeText}>
                  {notificationSettings.doNotDisturbStart} -{' '}
                  {notificationSettings.doNotDisturbEnd}
                </Text>
                <AppIcon color={COLORS.primary} name="pencil-outline" size={14} />
              </Pressable>
            </View>
            <AppSwitch
              accessibilityLabel="방해 금지 시간"
              onChange={(value) => void updateSetting('doNotDisturbEnabled', value)}
              value={notificationSettings.doNotDisturbEnabled}
            />
          </View>
        </ScrollView>
      </MyPageHeader>
      <AppModal
        closeOnBackdropPress={!savingDoNotDisturbTime}
        onClose={closeDoNotDisturbTimeModal}
        primaryAction={{
          disabled: !validDoNotDisturbTime,
          label: '저장',
          loading: savingDoNotDisturbTime,
          onPress: () => void saveDoNotDisturbTime(),
        }}
        secondaryAction={{
          disabled: savingDoNotDisturbTime,
          label: '취소',
          onPress: closeDoNotDisturbTimeModal,
        }}
        title="방해 금지 시간"
        variant="center"
        visible={doNotDisturbModalVisible}
      >
        <View style={styles.timeModalContent}>
          <Text style={styles.timeModalDescription}>
            알림을 받지 않을 시작 시간과 종료 시간을 입력해주세요.
          </Text>
          <View style={styles.timeInputs}>
            <AppInput
              accessibilityLabel="방해 금지 시작 시간"
              error={getClockTimeError(doNotDisturbStart)}
              inputMode="numeric"
              label="시작"
              maxLength={5}
              onChangeText={(value) => setDoNotDisturbStart(formatClockInput(value))}
              placeholder="22:00"
              value={doNotDisturbStart}
            />
            <AppInput
              accessibilityLabel="방해 금지 종료 시간"
              error={
                getClockTimeError(doNotDisturbEnd) ??
                (doNotDisturbStart === doNotDisturbEnd
                    ? '시작 시간과 다른 시간을 입력해주세요.'
                    : undefined)
              }
              inputMode="numeric"
              label="종료"
              maxLength={5}
              onChangeText={(value) => setDoNotDisturbEnd(formatClockInput(value))}
              placeholder="07:00"
              value={doNotDisturbEnd}
            />
          </View>
        </View>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.lg,
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.xl,
  },
  intro: {
    gap: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.title2,
    color: COLORS.black,
  },
  description: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  notificationCard: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 88,
    paddingHorizontal: SPACING.xxxl,
  },
  cardText: {
    flex: 1,
    gap: SPACING.xs,
    paddingRight: SPACING.xxl,
  },
  cardTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  cardDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  },
  doNotDisturbCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: 20,
    flexDirection: 'row',
    marginTop: SPACING.xl,
    minHeight: 118,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.xxl,
  },
  timePill: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 20,
    flexDirection: 'row',
    gap: SPACING.sm,
    height: 34,
    justifyContent: 'center',
    marginTop: SPACING.sm,
    minWidth: 142,
    paddingHorizontal: SPACING.lg,
  },
  timePillPressed: {
    opacity: 0.72,
  },
  timeText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  timeModalContent: {
    gap: SPACING.xxl,
  },
  timeModalDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  timeInputs: {
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.lg,
    gap: SPACING.xl,
    padding: SPACING.xl,
  },
});
