import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common';
import { AppModal } from './AppModal';
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
		<AppModal onClose={onDismiss} variant="center" visible={visible}>
			<Text style={styles.message}>
				추가한 약물을 &apos;할일 목록&apos;에 자동으로 저장할까요?
			</Text>

			<View style={styles.buttonRow}>
				<AppButton
					fullWidth={false}
					onPress={onDismiss}
					style={styles.dismissButton}
					title="아니요"
					variant="primary"
				/>
				<AppButton
					fullWidth={false}
					onPress={onConfirm}
					style={styles.confirmButton}
					title="네"
				/>
			</View>
		</AppModal>
	);
}

const styles = StyleSheet.create({
	message: { ...TYPOGRAPHY.segmentActive, color: COLORS.black, textAlign: 'center', lineHeight: 40 },
	buttonRow: {
		flexDirection: 'row',
		gap: SPACING.jumbo,
		justifyContent: 'center',
		marginTop: SPACING.xxl,
	},
	dismissButton: {
		backgroundColor: COLORS.summarycontainerborder,
		borderColor: COLORS.primary,
		borderWidth: 1,
		height: 48,
		width: 112,
	},
	confirmButton: { height: 48, width: 112 },
});