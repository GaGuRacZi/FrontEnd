import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppSwitch, EmptyState, LoadingView } from '@/src/components/common';
import { COLORS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useTerms } from '@/src/features/auth/terms';

import { MyPageHeader } from '../components';
import { useMyPageStore } from '../MyPageStore';
import type { NotificationSettings } from '../types';

type NotificationKey = Exclude<
  keyof NotificationSettings,
  'doNotDisturbEnd' | 'doNotDisturbStart'
>;

const NOTIFICATION_ROWS: {
  description: string;
  key: NotificationKey;
  title: string;
}[] = [
  {
    description: '오늘의 할 일과 복약 시간을 알려줘요',
    key: 'schedule',
    title: '할 일 알림',
  },
  {
    description: '기록에서 주의가 필요한 변화를 알려줘요',
    key: 'healthAlert',
    title: '건강 이상 알림',
  },
  { description: '진료 요약과 OCR 분석 완료를 알려줘요', key: 'aiAnalysis', title: 'AI 분석 완료 알림' },
  { description: '댓글, 답글, 거래 문의를 알려줘요', key: 'community', title: '커뮤니티 알림' },
  { description: '새 메시지와 거래 대화를 알려줘요', key: 'chat', title: '채팅 알림' },
];

export function MyPageNotificationsScreen() {
  const { isReady, notificationSettings, updateNotificationSettings } = useMyPageStore();
  const { marketingConsent, updateMarketingConsent } = useTerms();

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
    Alert.alert('저장하지 못했어요', '잠시 후 다시 시도해주세요.');
  };

  const updateSetting = async (key: NotificationKey, value: boolean) => {
    const nextSettings = { ...notificationSettings, [key]: value };
    const result = await updateNotificationSettings(nextSettings);

    if (!result.ok) showSaveError();
  };

  const updateMarketingSetting = async (value: boolean) => {
    try {
      await updateMarketingConsent(value);
    } catch {
      showSaveError();
    }
  };

  const renderNotificationCard = (
    title: string,
    description: string,
    value: boolean,
    onChange: (value: boolean) => void,
    key?: string,
  ) => (
    <View key={key} style={styles.notificationCard}>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
      <AppSwitch accessibilityLabel={title} onChange={onChange} value={value} />
    </View>
  );

  return (
    <MyPageHeader title="알림 설정">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.title}>알림을 원하는 방식으로 받아요</Text>
          <Text style={styles.description}>할 일, 건강, 커뮤니티 알림을 세분화했어요.</Text>
        </View>

        {NOTIFICATION_ROWS.map((row) =>
          renderNotificationCard(
            row.title,
            row.description,
            notificationSettings[row.key],
            (value) => void updateSetting(row.key, value),
            row.key,
          ),
        )}

        {renderNotificationCard(
          '혜택·이벤트 알림',
          'PAW 혜택과 이벤트 소식을 받아요',
          marketingConsent,
          (value) => void updateMarketingSetting(value),
          'marketing',
        )}

        <View style={styles.doNotDisturbCard}>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>방해 금지 시간</Text>
            <Text style={styles.cardDescription}>
              건강 이상 알림은 받을 수 있어요.
            </Text>
            <View style={styles.timePill}>
              <Text style={styles.timeText}>
                {notificationSettings.doNotDisturbStart} - {notificationSettings.doNotDisturbEnd}
              </Text>
            </View>
          </View>
          <AppSwitch
            accessibilityLabel="방해 금지 시간"
            onChange={(value) => void updateSetting('doNotDisturbEnabled', value)}
            value={notificationSettings.doNotDisturbEnabled}
          />
        </View>

        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>휴대폰 알림 권한</Text>
          <Text style={styles.permissionDescription}>
            시스템 알림 권한이 꺼져 있으면 PAW 알림을 받을 수 없어요.
          </Text>
          <AppButton
            fullWidth={false}
            onPress={() => void Linking.openSettings()}
            size="medium"
            style={styles.permissionButton}
            title="시스템 설정 열기"
            variant="outline"
          />
        </View>
      </ScrollView>
    </MyPageHeader>
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
    height: 34,
    justifyContent: 'center',
    marginTop: SPACING.sm,
    width: 132,
  },
  timeText: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
  },
  permissionBox: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: 20,
    borderWidth: 1,
    gap: SPACING.md,
    marginTop: SPACING.xl,
    padding: SPACING.xxl,
  },
  permissionTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  permissionDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
  },
  permissionButton: {
    paddingHorizontal: SPACING.xxxl,
  },
});
