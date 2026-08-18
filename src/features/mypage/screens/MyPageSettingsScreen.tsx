import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { AppModal, useAppAlert } from '@/src/components/modal';
import { COLORS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useAccountLifecycle } from '@/src/hooks/useAccountLifecycle';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import { MyPageCard, MyPageDivider, MyPageHeader, MyPageRow } from '../components';
import { useMyPageStore } from '../MyPageStore';

export function MyPageSettingsScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const showAlert = useAppAlert();
  const { logOut } = useAccountLifecycle();
  const { profile } = useMyPageStore();
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogOut = () => {
    navigateOnce(async () => {
      setLoggingOut(true);
      setLogoutError(false);
      try {
        await logOut();
      } catch (error) {
        setLogoutError(true);
        throw error;
      } finally {
        setLoggingOut(false);
      }
    });
  };

  return (
    <MyPageHeader title="계정 설정">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MyPageCard title="계정">
          <MyPageRow
            description="닉네임, 한 줄 소개, 지역 변경"
            iconName="person-outline"
            onPress={() => navigateOnce(() => router.push('/mypage/profile'))}
            title="프로필 수정"
          />
        </MyPageCard>

        <MyPageCard title="구독">
          <MyPageRow
            description="내 요금제 확인"
            iconName="cash-outline"
            onPress={() => navigateOnce(() => router.push('/mypage/plan'))}
            title="내 요금제"
          />
          <MyPageDivider />
          <MyPageRow
            description="간편페이 연결 및 관리"
            iconName="card-outline"
            onPress={() => navigateOnce(() => router.push('/mypage/payment-methods'))}
            title="결제 수단 관리"
          />
          <MyPageDivider />
          <MyPageRow
            description="결제 완료, 실패, 취소 내역"
            iconName="receipt-outline"
            onPress={() => navigateOnce(() => router.push('/mypage/payment-history'))}
            title="결제 내역"
          />
        </MyPageCard>

        <MyPageCard title="기타">
          <MyPageRow
            description="이 기기에서 로그아웃"
            iconName="log-out-outline"
            onPress={() => {
              setLogoutError(false);
              setLogoutVisible(true);
            }}
            title="로그아웃"
          />
          <MyPageDivider />
          <MyPageRow
            description="계정 탈퇴 절차"
            iconName="trash-outline"
            onPress={() => {
              if (profile?.loginConnections.some(({ method }) => method === 'kakao')) {
                showAlert(
                  '카카오 계정 탈퇴는 지원하지 않아요',
                  '현재 카카오 계정으로는 본인 확인을 진행할 수 없어요.',
                );
                return;
              }
              navigateOnce(() => router.push('/mypage/withdraw'));
            }}
            title="탈퇴하기"
          />
        </MyPageCard>
      </ScrollView>

      <AppModal
        closeOnBackdropPress={!loggingOut}
        onClose={() => {
          if (loggingOut) return;
          setLogoutVisible(false);
          setLogoutError(false);
        }}
        primaryAction={{
          label: logoutError ? '다시 시도' : '로그아웃',
          loading: loggingOut,
          onPress: handleLogOut,
        }}
        secondaryAction={{
          disabled: loggingOut,
          label: '취소',
          onPress: () => {
            setLogoutVisible(false);
            setLogoutError(false);
          },
        }}
        title={logoutError ? '로그아웃하지 못했어요' : '로그아웃할까요?'}
        variant="center"
        visible={logoutVisible}
      >
        <Text style={styles.modalDescription}>
          {logoutError
            ? '잠시 후 다시 시도해주세요.'
            : '로그인 화면으로 되돌아갑니다.'}
        </Text>
      </AppModal>
    </MyPageHeader>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.xxl,
    paddingBottom: SIZE.tabBarHeight + SPACING.xxxl,
    paddingTop: SPACING.xl,
  },
  modalDescription: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
