import { AuthSessionGuard } from '@/src/features/auth/session/AuthSessionGuard';
import { MedicationListScreen } from '@/src/features/home/screens/MedicationListScreen';

export default function MedicationRoute() {
  return (
    <AuthSessionGuard>
      <MedicationListScreen />
    </AuthSessionGuard>
  );
}
