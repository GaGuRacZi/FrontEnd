import { StyleSheet, Text } from 'react-native';

import { AppModal } from '@/src/components/modal';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';

type MedicationSaveConfirmModalProps = {
	onConfirm: () => void;
	onDismiss: () => void;
	visible: boolean;
};

export function MedicationSaveConfirmModal({
	onConfirm,
	onDismiss,
	visible,
}: MedicationSaveConfirmModalProps) {
	return (
		<AppModal
			onClose={onDismiss}
			primaryAction={{ label: '네', onPress: onConfirm }}
			secondaryAction={{ label: '아니요', onPress: onDismiss }}
			variant="center"
			visible={visible}
		>
			<Text style={styles.message}>추가한 약물을 '할일 목록'에{'\n'}자동으로 저장할까요?</Text>
		</AppModal>
	);
}

const styles = StyleSheet.create({
	message: { ...TYPOGRAPHY.body1, color: COLORS.black, textAlign: 'center' },
});