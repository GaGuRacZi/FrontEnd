import { ScreenLayout } from '@/src/components/layout';

function AuthScreen({ title }: { title: string }) {
  return <ScreenLayout headerVariant="auth" title={title} />;
}

export function LoginScreen() {
  return <AuthScreen title="로그인" />;
}

export function SignupScreen() {
  return <AuthScreen title="회원가입" />;
}

export function SignupProfileScreen() {
  return <AuthScreen title="프로필 설정" />;
}

export function SignupPetTypeScreen() {
  return <AuthScreen title="반려동물 종류" />;
}

export function SignupPetInfoScreen() {
  return <AuthScreen title="반려동물 정보" />;
}

export function SignupUserInfoScreen() {
  return <AuthScreen title="회원 정보" />;
}

export function SignupLocationScreen() {
  return <AuthScreen title="지역 설정" />;
}

export function SignupCompleteScreen() {
  return <AuthScreen title="가입 완료" />;
}
