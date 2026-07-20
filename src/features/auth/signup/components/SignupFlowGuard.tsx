import { Redirect, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useSignup } from '../SignupContext';
import { getNextSignupRoute } from '../signupValidation';

const ROUTE_ORDER: Record<string, number> = {
  '/signup': 0,
  '/signup/profile': 1,
  '/signup/user-info': 2,
  '/signup/pet-type': 3,
  '/signup/pet-info': 4,
  '/signup/location': 5,
  '/signup/complete': 6,
};

export function SignupFlowGuard({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { data } = useSignup();
  const currentOrder = ROUTE_ORDER[pathname];
  const nextRoute = getNextSignupRoute(data);
  const allowedOrder = ROUTE_ORDER[nextRoute];

  if (currentOrder !== undefined && currentOrder > allowedOrder) {
    return <Redirect href={nextRoute} />;
  }

  return children;
}
