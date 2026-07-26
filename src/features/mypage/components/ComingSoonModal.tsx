import { Text, StyleSheet } from 'react-native';

import { AppModal } from '@/src/components/modal';
import { COLORS, TYPOGRAPHY } from '@/src/constants';

type ComingSoonModalProps = {
  onClose: () => void;
  title: string;
  visible: boolean;
};

export function ComingSoonModal({ onClose, title, visible }: ComingSoonModalProps) {
  return (
    <AppModal
      onClose={onClose}
      primaryAction={{ label: '확인', onPress: onClose }}
      title={title}
      variant="center"
      visible={visible}
    >
      <Text style={styles.description}>아직 준비 중인 화면이에요.</Text>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  description: {
    ...TYPOGRAPHY.body2,
    color: COLORS.gray600,
    textAlign: 'center',
  },
});
