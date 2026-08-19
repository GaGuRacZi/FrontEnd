import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppIcon } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { AppModal } from './AppModal';
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
	const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

	const ocrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearTimers = () => {
		if (ocrTimerRef.current) clearTimeout(ocrTimerRef.current);
		if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
	};

	const showFeedback = (message: string) => {
		if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
		setFeedbackMessage(message);
		toastTimerRef.current = setTimeout(() => setFeedbackMessage(null), 2500);
	};

	useEffect(() => {
		if (!visible) {
			clearTimers();
			setMode('idle');
			setFeedbackMessage(null);
		}
		return () => clearTimers();
	}, [visible]);

	const hasSelection = selected.length > 0;

	const handleOcrPress = async () => {
		try {
			if (Platform.OS === 'ios') {
				const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
				if (status !== 'granted') {
					showFeedback('사진 접근 권한을 허용해주세요.');
					return;
				}
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				allowsMultipleSelection: false,
				defaultTab: 'photos',
				mediaTypes: ['images'],
				quality: 0.8,
				allowsEditing: false,
			});

			if (result.canceled) return;

			setMode('ocrLoading');
			setFeedbackMessage(null);
			clearTimers();

			ocrTimerRef.current = setTimeout(() => {
				setMode('idle');
				showFeedback('처방전에서 약물을 찾지 못했어요. 직접 입력해주세요.');
			}, 1800);
		} catch {
			setMode('idle');
			showFeedback('사진첩을 열지 못했어요. 잠시 후 다시 시도해주세요.');
		}
	};

	const handleSearch = () => {
		if (!query.trim()) {
			showFeedback('검색어를 입력해주세요.');
			return;
		}
		showFeedback('일치하는 약물을 찾지 못했어요. 직접 입력해주세요.');
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

	const manualToggleButton = (
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
	);

	return (
		<>
			<AppModal avoidKeyboard={false} onClose={onClose} variant="bottomSheet" visible={visible}>
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
						leftElement={<View style={styles.cameraButtonPlaceholder} />}
						onChangeText={setQuery}
						placeholder="약물·성분명 검색"
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
						onPress={handleSearch}
						title="검색"
					/>
				</View>

				<Text style={styles.helperText}>약물명·성분명으로 검색하거나 직접 입력해 추가할 수 있어요</Text>

				{mode !== 'ocrLoading' ? manualToggleButton : null}

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
						<AppButton fullWidth={false} onPress={() => setMode('idle')} size="medium" title="취소" variant="secondary" />
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

				{mode === 'ocrLoading' ? manualToggleButton : null}

				<AppButton
					onPress={() => {
						if (!hasSelection) return;
						onSubmit(selected);
					}}
					style={!hasSelection && styles.bottomButtonInactive}
					title={hasSelection ? '완료' : '약물을 검색해서 담아주세요'}
				/>
			</AppModal>

			<Modal
				animationType="fade"
				onRequestClose={() => setFeedbackMessage(null)}
				statusBarTranslucent
				transparent
				visible={Boolean(feedbackMessage)}
			>
				<Pressable
					accessibilityLabel="닫기"
					accessibilityRole="button"
					onPress={() => setFeedbackMessage(null)}
					style={styles.ocrFailedBackdrop}
				>
					<View style={styles.ocrFailedCard}>
						<Text style={styles.ocrFailed}>{feedbackMessage}</Text>
					</View>
				</Pressable>
			</Modal>
		</>
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
				<View style={styles.selectedTitleRow}>
					<View style={styles.selectedDot} />
					<View style={styles.selectedTitleGroup}>
						<Text style={styles.selectedName}>{medication.name}</Text>
						{medication.ingredient ? (
							<Text style={styles.selectedIngredient}>{medication.ingredient}</Text>
						) : null}
					</View>
				</View>
				<Pressable
					accessibilityLabel="약물 삭제"
					accessibilityRole="button"
					onPress={onRemove}
					style={styles.selectedRemoveButton}
				>
					<AppIcon color={COLORS.gray500} name="close" size={16} />
				</Pressable>
			</View>

			<View style={styles.quantityBox}>
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
				{FREQUENCY_OPTIONS.map((option) => {
					const active = medication.frequency === option.value;
					return (
						<Pressable
							key={option.value}
							accessibilityLabel={option.label}
							accessibilityRole="button"
							onPress={() => onChange({ frequency: option.value as MedicationFrequency })}
							style={[styles.chip, styles.frequencyChip, active && styles.chipActive]}
						>
							<Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
						</Pressable>
					);
				})}
			</View>

			<View style={styles.chipRow}>
				{TIMING_OPTIONS.map((option) => {
					const active = medication.timing === option.value;
					return (
						<Pressable
							key={option.value}
							accessibilityLabel={option.label}
							accessibilityRole="button"
							onPress={() => onChange({ timing: option.value as MedicationTiming })}
							style={[styles.chip, styles.timingChip, active && styles.chipActive]}
						>
							<Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
						</Pressable>
					);
				})}
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
	headerTitle: { ...TYPOGRAPHY.title3, color: COLORS.black },
	headerSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.primary, lineHeight: 16 },
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
	searchInputText: {
		fontFamily: TYPOGRAPHY.selection.fontFamily,
		fontSize: 12,
		minHeight: 0,
		paddingVertical: 0,
		textAlign: 'center',
		textAlignVertical: 'center',
		includeFontPadding: false,
	},
	searchButtonIcon: { height: 16, marginBottom: -2, tintColor: COLORS.background, width: 16 },
	cameraButton: {
		alignItems: 'center',
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.md,
		height: 44,
		justifyContent: 'center',
		width: 44,
	},
	cameraButtonPlaceholder: { width: 48 },
	cameraIcon: { height: 20, width: 20 },
	helperText: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
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
	manualToggleIcon: { height: 14, width: 14, tintColor: COLORS.gray500 },
	manualToggleText: { ...TYPOGRAPHY.segment, color: COLORS.gray500 },
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
		paddingHorizontal: 14,
		paddingVertical: SPACING.xl,
	},
	selectedCardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	selectedTitleRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: SPACING.lg },
	selectedDot: { backgroundColor: COLORS.primary, borderRadius: 5, height: 8, width: 8 },
	selectedTitleGroup: { flex: 1, gap: 2 },
	selectedName: { ...TYPOGRAPHY.segmentActive, color: COLORS.black, lineHeight: 18 },
	selectedIngredient: { ...TYPOGRAPHY.small, color: COLORS.gray600 },
	selectedRemoveButton: {
		alignItems: 'center',
		backgroundColor: COLORS.background,
		borderRadius: RADIUS.round,
		height: 24,
		justifyContent: 'center',
		width: 24,
	},
	quantityBox: {
		alignItems: 'center',
		alignSelf: 'flex-start',
		backgroundColor: COLORS.background,
		borderRadius: 10,
		flexDirection: 'row',
		gap: SPACING.xs,
		paddingHorizontal: SPACING.md,
		paddingVertical: SPACING.xs,
	},
	quantityButton: {
		alignItems: 'center',
		backgroundColor: COLORS.background,
		borderRadius: RADIUS.round,
		height: 24,
		justifyContent: 'center',
		width: 24,
	},
	quantityButtonText: { ...TYPOGRAPHY.kakaoButton, color: COLORS.gray500 },
	quantityValue: { ...TYPOGRAPHY.selectionActive, color: COLORS.black, minWidth: 16, textAlign: 'center' },
	quantityUnit: { ...TYPOGRAPHY.caption, color: COLORS.gray600 },
	chipRow: { flexDirection: 'row', gap: SPACING.xs },
	chip: {
		alignItems: 'center',
		backgroundColor: COLORS.background,
		borderRadius: 10,
		paddingVertical: SPACING.sm,
	},
	frequencyChip: { width: 72 },
	timingChip: { width: 43 },
	chipActive: { backgroundColor: COLORS.primary },
	chipText: { ...TYPOGRAPHY.badge, color: COLORS.gray600, textAlign: 'center' },
	chipTextActive: { color: COLORS.background },
	bottomButtonIcon: { height: 16, tintColor: COLORS.background, width: 16 },
	bottomButtonInactive: { backgroundColor: COLORS.disabledPrimary },
	ocrFailedBackdrop: {
		alignItems: 'center',
		backgroundColor: COLORS.overlay,
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: SPACING.xxxl,
	},
	ocrFailedCard: {
		alignSelf: 'stretch',
		backgroundColor: COLORS.gray100,
		borderColor: COLORS.primary,
		borderRadius: RADIUS.lg,
		borderWidth: 1.5,
		gap: SPACING.xxs,
		paddingHorizontal: SPACING.xxl,
		paddingVertical: SPACING.xl,
	},
	ocrFailed: {
		...TYPOGRAPHY.segmentActive,
		color: COLORS.black,
		fontFamily: TYPOGRAPHY.button.fontFamily,
		textAlign: 'center',
	},
});
