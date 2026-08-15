import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppIcon, AppChip, AppToast } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { AppModal } from '@/src/components/modal';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import {
	FREQUENCY_OPTIONS,
	TIMING_OPTIONS,
	type MedicationEntry,
	type MedicationFrequency,
	type MedicationTiming,
} from '@/src/types/medication';

type MedicationSearchModalProps = {
	onClose: () => void;
	onSubmit: (medications: MedicationEntry[]) => void;
	visible: boolean;
};

type Mode = 'idle' | 'manual' | 'ocrLoading';

export function MedicationSearchModal({ onClose, onSubmit, visible }: MedicationSearchModalProps) {
	const [mode, setMode] = useState<Mode>('idle');
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<MedicationEntry[]>([]);
	const [manualForm, setManualForm] = useState({ name: '', ingredient: '', description: '', warningNote: '' });
	const [showOcrFailedToast, setShowOcrFailedToast] = useState(false);

	const hasSelection = selected.length > 0;

	const handleOcrPress = () => {
		setMode('ocrLoading');
		setShowOcrFailedToast(false);
		// TODO: 실제 OCR 연동 전까지는 인식 실패로 mock 처리
		setTimeout(() => {
			setMode('idle');
			setShowOcrFailedToast(true);
		}, 1800);
	};

	const handleManualSubmit = () => {
		if (!manualForm.name.trim()) return;

		const entry: MedicationEntry = {
			id: `manual-${Date.now()}`,
			name: manualForm.name.trim(),
			ingredient: manualForm.ingredient.trim() || undefined,
			description: manualForm.description.trim() || undefined,
			warningNote: manualForm.warningNote.trim() || undefined,
			quantity: 1,
			frequency: 'twiceDaily',
			timing: 'afterMeal',
		};
		setSelected((current) => [...current, entry]);
		setManualForm({ name: '', ingredient: '', description: '', warningNote: '' });
		setMode('idle');
	};

	const updateSelected = (id: string, patch: Partial<MedicationEntry>) => {
		setSelected((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
	};

	const removeSelected = (id: string) => {
		setSelected((current) => current.filter((item) => item.id !== id));
	};

	return (
		<AppModal onClose={onClose} variant="bottomSheet" visible={visible}>
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<View style={styles.headerBadge}>
						<Image
							resizeMode="contain"
							source={require('@/assets/images/modal/MedicationBadge.png')}
							style={styles.headerBadgeImage}
						/>
					</View>
					<View>
						<Text style={styles.headerTitle}>약물 추가</Text>
						{hasSelection ? <Text style={styles.headerSubtitle}>{selected.length}개 선택됨</Text> : null}
					</View>
				</View>
				<Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
					<AppIcon color={COLORS.gray600} name="close" size={22} />
				</Pressable>
			</View>

			<View style={styles.searchRow}>
				<AppInput
					containerStyle={styles.searchInputContainer}
					inputContainerStyle={styles.searchInputBox}
                    inputStyle={styles.searchInputText}
					onChangeText={setQuery}
					placeholder="약물명 또는 성분명으로 검색"
					rightElement={
						<Pressable
							accessibilityLabel="처방전 사진으로 검색"
							accessibilityRole="button"
							onPress={handleOcrPress}
							style={styles.cameraButton}
						>
							<Image
								resizeMode="contain"
								source={require('@/assets/images/modal/MedicationCamera.png')}
								style={styles.cameraIcon}
							/>
						</Pressable>
					}
					value={query}
				/>

				<AppButton
					fullWidth={false}
					leftIcon={
						<Image
							resizeMode="contain"
							source={require('@/assets/images/modal/Search.png')}
							style={styles.searchButtonIcon}
						/>
					}
					onPress={() => {
						// TODO: 실제 약물 검색 API 연동 — 검색 결과 리스트 UI는 참고 화면이 없어서 아직 미구현
					}}
					title="검색"
				/>
			</View>

			<Text style={styles.helperText}>검색 후 선택하거나 카메라로 처방전을 찍으면 자동으로 담겨요</Text>

			<Pressable
				accessibilityLabel="검색에 없으면 직접 입력"
				accessibilityRole="button"
				onPress={() => setMode(mode === 'manual' ? 'idle' : 'manual')}
				style={styles.manualToggle}
			>
				<Image
					resizeMode="contain"
					source={require('@/assets/images/dashboard/Plus.png')}
					style={styles.manualToggleIcon}
				/>
				<Text style={styles.manualToggleText}>검색에 없으면 직접 입력</Text>
			</Pressable>

			{mode === 'ocrLoading' ? (
				<View style={styles.ocrState}>
					<View style={styles.ocrIconCircle}>
						<Image
							resizeMode="contain"
							source={require('@/assets/images/modal/MedicationCamera.png')}
							style={styles.ocrIcon}
						/>
					</View>
					<Text style={styles.ocrTitle}>처방전 사진 인식 중...</Text>
					<Text style={styles.ocrSubtitle}>처방전을 화면에 맞춰 찍어주세요</Text>
					<AppButton 
                        fullWidth={false}
                        size="medium"
                        onPress={() => setMode('idle')} 
                        title="취소" 
                        variant="secondary" />
				</View>
			) : mode === 'manual' ? (
				<View style={styles.manualForm}>
					<AppInput
						onChangeText={(text) => setManualForm((form) => ({ ...form, name: text }))}
						placeholder="약물 이름 *"
						value={manualForm.name}
					/>
					<AppInput
						onChangeText={(text) => setManualForm((form) => ({ ...form, ingredient: text }))}
						placeholder="성분명 (예: Carprofen 25mg)"
						value={manualForm.ingredient}
					/>
					<AppInput
						onChangeText={(text) => setManualForm((form) => ({ ...form, description: text }))}
						placeholder="약 설명 (선택)"
						value={manualForm.description}
					/>
					<AppInput
						onChangeText={(text) => setManualForm((form) => ({ ...form, warningNote: text }))}
						placeholder="주의할 점 (선택)"
						value={manualForm.warningNote}
					/>
					<AppButton disabled={!manualForm.name.trim()} onPress={handleManualSubmit} title="담기" />
				</View>
			) : selected.length === 0 ? (
				showOcrFailedToast ? (
					<AppToast
						message="직접 입력을 통해 기록해주세요."
						title="입력된 약물을 찾지 못했어요."
						visible
					/>
				) : (
					<View style={styles.emptyState}>
						<View style={styles.emptyIconCircle}>
							<Image
								resizeMode="contain"
								source={require('@/assets/images/modal/MedicationBadge.png')}
								style={styles.emptyIcon}
							/>
						</View>
						<Text style={styles.emptyText}>위에서 약물을 검색해서 추가해보세요</Text>
					</View>
				)
			) : (
				<View style={styles.selectedList}>
					{selected.map((item) => (
						<SelectedMedicationCard
							key={item.id}
							medication={item}
							onChange={(patch) => updateSelected(item.id, patch)}
							onRemove={() => removeSelected(item.id)}
						/>
					))}
				</View>
			)}

			<AppButton
				leftIcon={
					<Image
						resizeMode="contain"
						source={require('@/assets/images/dashboard/Plus.png')}
						style={styles.bottomButtonIcon}
					/>
				}
				onPress={() => {
					if (!hasSelection) return;
					onSubmit(selected);
				}}
				style={!hasSelection && styles.bottomButtonInactive}
				title={hasSelection ? '완료' : '약물을 검색해서 담아주세요'}
			/>
		</AppModal>
	);
}

type SelectedMedicationCardProps = {
	medication: MedicationEntry;
	onChange: (patch: Partial<MedicationEntry>) => void;
	onRemove: () => void;
};

function SelectedMedicationCard({ medication, onChange, onRemove }: SelectedMedicationCardProps) {
	return (
		<View style={styles.selectedCard}>
			<View style={styles.selectedCardHeader}>
				<View style={styles.selectedTitleGroup}>
					<View style={styles.selectedDot} />
					<Text style={styles.selectedName}>{medication.name}</Text>
				</View>
				<Pressable accessibilityLabel="약물 삭제" accessibilityRole="button" onPress={onRemove}>
					<AppIcon color={COLORS.gray500} name="close" size={16} />
				</Pressable>
			</View>

			{medication.ingredient ? <Text style={styles.selectedIngredient}>{medication.ingredient}</Text> : null}

			<View style={styles.quantityRow}>
				<Pressable
					accessibilityLabel="수량 감소"
					accessibilityRole="button"
					onPress={() => onChange({ quantity: Math.max(1, medication.quantity - 1) })}
					style={styles.quantityButton}
				>
					<Text style={styles.quantityButtonText}>−</Text>
				</Pressable>
				<Text style={styles.quantityValue}>{medication.quantity}</Text>
				<Pressable
					accessibilityLabel="수량 증가"
					accessibilityRole="button"
					onPress={() => onChange({ quantity: medication.quantity + 1 })}
					style={styles.quantityButton}
				>
					<Text style={styles.quantityButtonText}>+</Text>
				</Pressable>
				<Text style={styles.quantityUnit}>정</Text>
			</View>

			<View style={styles.chipRow}>
				{FREQUENCY_OPTIONS.map((option) => (
					<AppChip
						key={option.value}
						label={option.label}
						onPress={() => onChange({ frequency: option.value as MedicationFrequency })}
						selected={medication.frequency === option.value}
						size="small"
					/>
				))}
			</View>

			<View style={styles.chipRow}>
				{TIMING_OPTIONS.map((option) => (
					<AppChip
						key={option.value}
						label={option.label}
						onPress={() => onChange({ timing: option.value as MedicationTiming })}
						selected={medication.timing === option.value}
						size="small"
					/>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	headerLeft: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
	headerBadge: {
		alignItems: 'center',
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.md,
		height: 32,
		justifyContent: 'center',
		width: 32,
	},
	headerBadgeImage: { height: 16, width: 16 },
	headerTitle: { ...TYPOGRAPHY.title2, color: COLORS.black },
	headerSubtitle: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	closeButton: {
		alignItems: 'center',
		backgroundColor: COLORS.gray100,
		borderRadius: RADIUS.round,
		height: 36,
		justifyContent: 'center',
		width: 36,
	},
	searchRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
	searchInputContainer: { flex: 1 },
	searchInputBox: { backgroundColor: COLORS.gray100 },
    searchInputText: { fontFamily: TYPOGRAPHY.selection.fontFamily, fontSize: 14, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
	searchButtonIcon: { height: 18, width: 18, marginBottom: -2 },
	cameraButton: {
		alignItems: 'center',
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.sm,
		height: 30,
		justifyContent: 'center',
		width: 30,
	},
	cameraIcon: { height: 16, width: 16 },
	helperText: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	manualToggle: {
		alignItems: 'center',
		borderColor: COLORS.gray300,
		borderRadius: RADIUS.md,
		borderStyle: 'dashed',
		borderWidth: 2,
		flexDirection: 'row',
		gap: SPACING.xs,
		justifyContent: 'center',
		paddingVertical: SPACING.lg,
	},
	manualToggleIcon: { height: 14, width: 14, tintColor: COLORS.gray300 },
	manualToggleText: { ...TYPOGRAPHY.segment, color: COLORS.gray300 },
	ocrState: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xxxl },
	ocrIconCircle: {
		alignItems: 'center',
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.round,
		height: 56,
		justifyContent: 'center',
		marginBottom: SPACING.md,
		width: 56,
	},
	ocrIcon: { height: 24, width: 24 },
	ocrTitle: { ...TYPOGRAPHY.body1, color: COLORS.black },
	ocrSubtitle: { ...TYPOGRAPHY.small, color: COLORS.gray500, marginBottom: SPACING.md },
	manualForm: { gap: SPACING.md },
	emptyState: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.xxxl },
	emptyIconCircle: {
		alignItems: 'center',
		backgroundColor: COLORS.gray100,
		borderRadius: RADIUS.round,
		height: 56,
		justifyContent: 'center',
		width: 56,
	},
	emptyIcon: { height: 22, tintColor: COLORS.gray500, width: 22 },
	emptyText: { ...TYPOGRAPHY.small, color: COLORS.gray500, fontSize: 13 },
	selectedList: { gap: SPACING.md },
	selectedCard: {
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.lg,
		gap: SPACING.md,
		padding: SPACING.lg,
	},
	selectedCardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	selectedTitleGroup: { alignItems: 'center', flexDirection: 'row', gap: SPACING.sm },
	selectedDot: { backgroundColor: COLORS.primary, borderRadius: 3, height: 6, width: 6 },
	selectedName: { ...TYPOGRAPHY.body1, color: COLORS.black },
	selectedIngredient: { ...TYPOGRAPHY.small, color: COLORS.gray600 },
	quantityRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
	quantityButton: {
		alignItems: 'center',
		backgroundColor: COLORS.background,
		borderRadius: RADIUS.round,
		height: 28,
		justifyContent: 'center',
		width: 28,
	},
	quantityButtonText: { ...TYPOGRAPHY.body1, color: COLORS.black },
	quantityValue: { ...TYPOGRAPHY.body1, color: COLORS.black, minWidth: 20, textAlign: 'center' },
	quantityUnit: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
	chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
	bottomButtonIcon: { height: 16, tintColor: COLORS.background, width: 16 },
	bottomButtonInactive: { backgroundColor: COLORS.disabledPrimary },
});