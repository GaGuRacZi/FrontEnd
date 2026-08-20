import type { AuthMethod } from '@/src/features/auth/session/AuthSessionStore';

export type PlanId = 'adult-jelly' | 'baby-jelly' | 'little-jelly';
export type PaymentStatus = 'paid';

export type LoginConnection = {
  email: string;
  method: AuthMethod;
};

export type UserProfile = {
  createdAt: string;
  id: string;
  introduction: string;
  location: string;
  regionCode: string | null;
  loginConnections: LoginConnection[];
  name: string;
  nickname: string;
  profileImageUri: string | null;
  updatedAt: string;
};

export type NotificationSettings = {
  aiAnalysis: boolean;
  chat: boolean;
  community: boolean;
  doNotDisturbEnd: string;
  doNotDisturbStart: string;
  doNotDisturbEnabled: boolean;
  healthAlert: boolean;
  schedule: boolean;
};

export type SubscriptionState = {
  currentPlanId: PlanId;
  nextBillingDate: string | null;
  pendingPlanId: PlanId | null;
  pendingType: 'cancel' | 'downgrade' | null;
  plans?: PlanCatalogItem[];
};

export type PlanCatalogItem = {
  id: PlanId;
  monthlyPrice: number;
  name: string;
};

export type PaymentHistoryItem = {
  amount: number;
  date: string;
  id: string;
  status: PaymentStatus;
  title: string;
};

export type StoredMyPageState = {
  notificationSettings: NotificationSettings;
  paymentHistory: PaymentHistoryItem[];
  profile: UserProfile;
  subscription: SubscriptionState;
};
