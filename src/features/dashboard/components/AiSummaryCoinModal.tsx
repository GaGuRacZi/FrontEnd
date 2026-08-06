import { StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/src/components/modal';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/constants';

type AiSummaryCoinModalProps = {
	onClose: () => void;
	onConfirm: () => void;
	visible: boolean;
};

// TODO: 코인 잔액은 마이페이지 구독 스토어 연동 후 실제 값으로 교체
const MOCK_COIN_BALANCE = 18;
const MOCK_COIN_USED = 12;

export function AiSummaryCoinModal({ onClose, onConfirm, visible }: AiSummaryCoinModalProps) {
	return (
		<AppModal
			onClose={onClose}
			primaryAction={{ label: '코인 1개 사용하기', onPress: onConfirm }}
			secondaryAction={{ label: '취소', onPress: onClose }}
			title="AI 요약 생성"
			variant="center"
			visible={visible}
		>
			<Text style={styles.description}>AI 요약을 생성하면 코인 1개가 사용됩니다</Text>

			<View style={styles.statRow}>
				<Text style={styles.statLabel}>보유 코인</Text>
				<Text style={styles.statValue}>{MOCK_COIN_BALANCE}개</Text>
			</View>
			<View style={styles.statRow}>
				<Text style={styles.statLabel}>사용한 코인</Text>
				<Text style={styles.statValue}>{MOCK_COIN_USED}개</Text>
			</View>
			<View style={styles.statRow}>
				<Text style={styles.statLabel}>이번에 사용</Text>
				<Text style={[styles.statValue, styles.statValueDanger]}>1개</Text>
			</View>
			<View style={styles.statRow}>
				<Text style={styles.statLabel}>생성 후 잔여</Text>
				<Text style={styles.statValue}>{MOCK_COIN_BALANCE - 1}개</Text>
			</View>
		</AppModal>
	);
}

const styles = StyleSheet.create({
	description: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
	statRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: SPACING.sm,
	},
	statLabel: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
	statValue: { ...TYPOGRAPHY.body1, color: COLORS.black },
	statValueDanger: { color: COLORS.danger },
});