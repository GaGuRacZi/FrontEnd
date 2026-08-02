import { TERM_IDS } from '@/src/features/auth/terms';
import { TermDetailScreen } from '@/src/features/auth/terms/screens/TermDetailScreen';

export function CommunityPolicyScreen() {
  return (
    <TermDetailScreen
      action="acknowledge"
      fallbackRoute="/community"
      headerTitle="운영정책"
      termId={TERM_IDS.communityPolicy}
    />
  );
}
