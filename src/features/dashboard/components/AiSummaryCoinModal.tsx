import { Image, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common';
import { AppModal } from '@/src/components/modal';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

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
		<AppModal onClose={onClose} variant="center" visible={visible}>
			<View style={styles.headerGroup}>
				<Image resizeMode="contain" source={require('@/assets/images/dashboard/Coin.png')} style={styles.coinIcon} />
				<Text style={styles.title}>AI 요약 생성</Text>
			</View>

			<Text style={styles.description}>AI 요약을 생성하면 코인 1개가 사용됩니다</Text>

			<View style={styles.statsBox}>
				<View style={styles.statRow}>
					<Text style={styles.statLabel}>보유 코인</Text>
					<Text style={[styles.statValue, styles.statValuePrimary]}>
						{MOCK_COIN_BALANCE}개
					</Text>
				</View>
				<View style={styles.statRow}>
					<Text style={styles.statLabel}>사용한 코인</Text>
					<Text style={[styles.statValue, styles.statValueGray]}>{MOCK_COIN_USED}개</Text>
				</View>
				<View style={styles.statRow}>
					<Text style={styles.statLabel}>이번에 사용</Text>
					<Text style={[styles.statValue, styles.statValueDanger]}>1개</Text>
				</View>
				<View style={styles.statsDivider} />
				<View style={styles.statRow}>
					<Text style={styles.statLabel}>생성 후 잔여</Text>
					<Text style={styles.statValueBold}>{MOCK_COIN_BALANCE - 1}개</Text>
				</View>
			</View>

			<View style={styles.buttonRow}>
				<AppButton
					onPress={onClose}
					style={styles.secondaryButton}
					title="취소"
					variant="secondary"
				/>
				<AppButton onPress={onConfirm} style={styles.primaryButton} title="코인 1개 사용하기" />
			</View>
		</AppModal>
	);
}

const styles = StyleSheet.create({
	headerGroup: { alignItems: 'center' },
	coinIcon: {
		height: 150,
		width: 150,
	},
	title: { ...TYPOGRAPHY.title2, color: COLORS.black, textAlign: 'center', marginTop: -20 },
	description: { ...TYPOGRAPHY.body2, color: COLORS.gray600, textAlign: 'center' },
	statsBox: {
		backgroundColor: COLORS.summarycontainer,
		borderRadius: RADIUS.md,
		borderColor: COLORS.summarycontainerborder,
		borderWidth: 1,
		gap: SPACING.xs,
		paddingVertical: SPACING.lg,
		paddingHorizontal: SPACING.xxxl
	},
	statRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: SPACING.xs,
	},
	statsDivider: { backgroundColor: COLORS.gray300, height: 1, marginVertical: SPACING.xs },
	statLabel: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
	statValue: { ...TYPOGRAPHY.segmentActive, color: COLORS.black },
	statValuePrimary: { color: COLORS.primary },
	statValueGray: { color: COLORS.gray500 },
	statValueDanger: { color: COLORS.danger },
	statValueBold: {
		...TYPOGRAPHY.body1,
		color: COLORS.black,
		fontFamily: TYPOGRAPHY.button.fontFamily,
	},
	buttonRow: { flexDirection: 'row', gap: SPACING.xl, marginTop: SPACING.md },
	secondaryButton: { flex: 1 },
	primaryButton: { flex: 3 },
});