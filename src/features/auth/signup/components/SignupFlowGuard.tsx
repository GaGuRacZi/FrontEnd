import { Redirect, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useTerms } from '../../terms';
import { useSignup } from '../SignupContext';
import { getNextSignupRoute } from '../signupValidation';

const ROUTE_ORDER: Record<string, number> = {
  '/signup/terms': 0,
  '/signup': 1,
  '/signup/profile': 2,
  '/signup/credentials': 3,
  '/signup/user-info': 4,
  '/signup/location': 5,
  '/signup/pet-type': 6,
  '/signup/pet-info': 7,
  '/signup/complete': 8,
};

export function SignupFlowGuard({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { committedSignupRecovery, data, signupCompleted } = useSignup();
  const { hasRequiredSignupConsents, status } = useTerms();
  const currentOrder = pathname.startsWith('/signup/terms/')
    ? ROUTE_ORDER['/signup/terms']
    : ROUTE_ORDER[pathname];
  const nextRoute = getNextSignupRoute(data);
  const allowedRoute =
    nextRoute === '/signup/complete' && !signupCompleted ? '/signup/pet-info' : nextRoute;
  const allowedOrder = hasRequiredSignupConsents
    ? ROUTE_ORDER[allowedRoute]
    : ROUTE_ORDER['/signup/terms'];

  if (committedSignupRecovery) {
    if (pathname !== '/signup/pet-info' && pathname !== '/signup/complete') {
      return <Redirect href="/signup/pet-info" />;
    }
    return children;
  }

  if (data.method === 'kakao') {
    return <Redirect href="/" />;
  }

  if (status === 'loading') {
    return children;
  }

  if (currentOrder !== undefined && currentOrder > allowedOrder) {
    return <Redirect href={hasRequiredSignupConsents ? allowedRoute : '/signup/terms'} />;
  }

  return children;
}
