import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { AppModal } from '@/src/components/modal';
import { COLORS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { useAccountLifecycle } from '@/src/hooks/useAccountLifecycle';
import { useNavigationLock } from '@/src/hooks/useNavigationLock';

import { MyPageCard, MyPageDivider, MyPageHeader, MyPageRow } from '../components';

export function MyPageSettingsScreen() {
  const router = useRouter();
  const navigateOnce = useNavigationLock();
  const { logOut } = useAccountLifecycle();
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogOut = () => {
    navigateOnce(async () => {
      setLoggingOut(true);
      try {
        await logOut();
        router.replace('/');
      } finally {
        setLoggingOut(false);
      }
    });
  };

  return (
    <MyPageHeader title="사용자 설정">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MyPageCard title="사용자">
          <MyPageRow
            description="닉네임, 한 줄 소개, 지역 변경"
            iconName="person-outline"
            onPress={() => router.push('/mypage/profile')}
            title="프로필 정보 수정"
          />
        </MyPageCard>

        <MyPageCard title="구독">
          <MyPageRow
            description="내 요금제 확인"
            iconName="cash-outline"
            onPress={() => router.push('/mypage/plan')}
            title="내 요금제"
          />
          <MyPageDivider />
          <MyPageRow
            description="간편페이 연결 및 관리"
            iconName="card-outline"
            onPress={() => router.push('/mypage/payment-methods')}
            title="결제 수단 관리"
          />
          <MyPageDivider />
          <MyPageRow
            description="결제 완료, 실패, 취소 내역"
            iconName="receipt-outline"
            onPress={() => router.push('/mypage/payment-history')}
            title="결제 내역"
          />
        </MyPageCard>

        <MyPageCard title="기타">
          <MyPageRow
            description="현재 기기에서 계정 로그아웃"
            iconName="log-out-outline"
            onPress={() => setLogoutVisible(true)}
            title="로그아웃"
          />
          <MyPageDivider />
          <MyPageRow
            description="계정 삭제 진행"
            iconName="trash-outline"
            onPress={() => router.push('/mypage/withdraw')}
            title="탈퇴하기"
          />
        </MyPageCard>
      </ScrollView>

      <AppModal
        onClose={() => setLogoutVisible(false)}
        primaryAction={{
          label: '로그아웃',
          loading: loggingOut,
          onPress: handleLogOut,
        }}
        secondaryAction={{ label: '취소', onPress: () => setLogoutVisible(false) }}
        title="로그아웃할까요?"
        variant="center"
        visible={logoutVisible}
      >
        <Text style={styles.modalDescription}>로그인 화면으로 되돌아갑니다.</Text>
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
