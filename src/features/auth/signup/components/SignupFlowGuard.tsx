import { Redirect, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useAuthSession } from '../../session/AuthSessionStore';
import { useTerms } from '../../terms';
import { useSignup } from '../SignupContext';
import { getNextSignupRoute } from '../signupValidation';

const ROUTE_ORDER: Record<string, number> = {
  '/signup/terms': 0,
  '/signup': 1,
  '/signup/profile': 2,
  '/signup/user-info': 3,
  '/signup/pet-type': 4,
  '/signup/pet-info': 5,
  '/signup/location': 6,
  '/signup/complete': 7,
};

export function SignupFlowGuard({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { committedSignupRecovery, data, signupCompleted } = useSignup();
  const { currentUserId } = useAuthSession();
  const { hasRequiredSignupConsents, status } = useTerms();
  const currentOrder = pathname.startsWith('/signup/terms/')
    ? ROUTE_ORDER['/signup/terms']
    : ROUTE_ORDER[pathname];
  const nextRoute = getNextSignupRoute(data);
  const allowedRoute =
    nextRoute === '/signup/complete' && !signupCompleted ? '/signup/location' : nextRoute;
  const allowedOrder = hasRequiredSignupConsents
    ? ROUTE_ORDER[allowedRoute]
    : ROUTE_ORDER['/signup/terms'];

  if (data.method === 'kakao') {
    return <Redirect href="/" />;
  }

  if (currentUserId && !signupCompleted) {
    return <Redirect href="/home" />;
  }

  if (committedSignupRecovery) {
    if (pathname !== '/signup/location' && pathname !== '/signup/complete') {
      return <Redirect href="/signup/location" />;
    }
    return children;
  }

  if (status === 'loading') {
    return children;
  }

  if (currentOrder !== undefined && currentOrder > allowedOrder) {
    return <Redirect href={hasRequiredSignupConsents ? allowedRoute : '/signup/terms'} />;
  }

  return children;
}
