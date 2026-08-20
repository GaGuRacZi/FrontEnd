import * as ImagePicker from 'expo-image-picker';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton, AppIcon, DatePickerSheet } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { AppModal } from '@/src/components/modal';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';

import { useHealthSummaryStore } from '../HealthSummaryStore';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { MedicalExpenseRecord } from '../types';

type ExpenseItem = {
	id: string;
	name: string;
	cost: string;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatRecordDate = (date: Date) =>
	`${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

function parseRecordDate(value: string) {
	const [year, month, day] = value.split('.').map(Number);
	const date = new Date(year, (month || 1) - 1, day || 1);
	return Number.isNaN(date.valueOf()) ? new Date() : date;
}

const formatNumberWithComma = (value: string) => {
	const numericOnly = value.replace(/[^0-9]/g, '');
	if (!numericOnly) return '';
	return Number(numericOnly).toLocaleString();
};

const parseNumericValue = (value: string) => {
	const numericOnly = value.replace(/[^0-9]/g, '');
	return numericOnly ? Number(numericOnly) : 0;
};

const PAYMENT_METHOD_OPTIONS = ['가상계좌', '카드결제', '계좌이체', '모바일결제', '간편결제'];

export function MedicalExpenseRecordScreen() {
	const router = useRouter();
	const isSaving = useRef(false);
	const { selectedPet } = usePetStore();
	const { addMedicalExpenseRecord, deleteMedicalExpenseRecord, medicalExpenseRecords } = useHealthSummaryStore();
	const { recordId } = useLocalSearchParams<{ recordId?: string }>();
	const existingRecord = recordId
		? medicalExpenseRecords.find(({ id }) => id === recordId)
		: undefined;
	const [isEditing, setIsEditing] = useState(!existingRecord);
	const [recordedAt, setRecordedAt] = useState(() =>
		existingRecord ? parseRecordDate(existingRecord.date) : new Date(),
	);
	const [datePickerVisible, setDatePickerVisible] = useState(false);
	const [items, setItems] = useState<ExpenseItem[]>(
		existingRecord?.items.map((item) => ({
			...item,
			cost: item.cost.toLocaleString(),
		})) ?? [],
	);
	const [amount, setAmount] = useState(existingRecord?.totalCost.toLocaleString() ?? '');
	const [hospitalName, setHospitalName] = useState(existingRecord?.hospitalName ?? '');
	const [paymentMethod, setPaymentMethod] = useState<string | null>(existingRecord?.paymentMethod ?? null);
	const [paymentMethodModalVisible, setPaymentMethodModalVisible] = useState(false);
	const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null);

	const recordDate = formatRecordDate(recordedAt);
	const [isAddModalVisible, setIsAddModalVisible] = useState(false);
	const [newItemName, setNewItemName] = useState('');
	const [newItemCost, setNewItemCost] = useState('');
	const [editingItemId, setEditingItemId] = useState<string | null>(null);
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

	const totalItemsCost = items.reduce((sum, item) => sum + parseNumericValue(item.cost), 0);

	const handleAmountChange = (text: string) => {
		setAmount(formatNumberWithComma(text));
	};

	const handleAmountBlur = () => {
		const currentAmountNum = parseNumericValue(amount);
		if (currentAmountNum < totalItemsCost) {
			setAmount(totalItemsCost.toLocaleString());
		}
	};

	const handleCostChange = (text: string) => {
		setNewItemCost(formatNumberWithComma(text));
	};

	const handleScanReceipt = async () => {
		if (!isEditing) return;
		try {
			const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (!permission.granted) {
				Alert.alert('권한 필요', '영수증 사진을 선택하려면 갤러리 접근 권한이 필요해요.');
				return;
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ['images'],
				allowsEditing: true,
				quality: 0.8,
			});

			if (!result.canceled && result.assets && result.assets[0]) {
				setReceiptImageUri(result.assets[0].uri);
			}
		} catch {
			Alert.alert('오류', '영수증 이미지를 불러오는 중 문제가 발생했어요.');
		}
	};

	const openItemEditor = (item?: ExpenseItem) => {
		setEditingItemId(item?.id ?? null);
		setNewItemName(item?.name ?? '');
		setNewItemCost(item?.cost ?? '');
		setIsAddModalVisible(true);
	};

	const closeItemEditor = () => {
		setIsAddModalVisible(false);
		setEditingItemId(null);
		setNewItemName('');
		setNewItemCost('');
	};

	const handleSaveItem = () => {
		if (!newItemName.trim() || !newItemCost.trim()) return;

		const rawCostNum = parseNumericValue(newItemCost);
		const nextItem: ExpenseItem = {
			cost: rawCostNum.toLocaleString(),
			id: editingItemId ?? String(Date.now()),
			name: newItemName.trim(),
		};
		const updatedItems = editingItemId
			? items.map((item) => (item.id === editingItemId ? nextItem : item))
			: [...items, nextItem];

		const newTotalCost = updatedItems.reduce((sum, item) => sum + parseNumericValue(item.cost), 0);
		const currentAmountNum = parseNumericValue(amount);

		if (newTotalCost > currentAmountNum) {
			setAmount(newTotalCost.toLocaleString());
		}

		setItems(updatedItems);
		closeItemEditor();
	};

	const handleDeleteItem = () => {
		if (!selectedItemId) return;
		setIsEditing(true);
		setItems((current) => current.filter(({ id }) => id !== selectedItemId));
		setSelectedItemId(null);
	};

	const handleSaveRecord = () => {
		if (isSaving.current) return;
		if (!selectedPet) {
			Alert.alert('반려동물 선택 필요', '의료비를 기록할 반려동물을 먼저 선택해주세요.');
			return;
		}
		if (parseNumericValue(amount) <= 0) {
			Alert.alert('입력 오류', '결제 금액을 입력해주세요.');
			return;
		}
		if (!hospitalName.trim()) {
			Alert.alert('입력 오류', '병원명을 입력해주세요.');
			return;
		}
		if (!paymentMethod) {
			Alert.alert('입력 오류', '결제수단을 선택해주세요.');
			return;
		}
		isSaving.current = true;
		const finalCost = Math.max(parseNumericValue(amount), totalItemsCost);
		const newRecord: MedicalExpenseRecord = {
			id: existingRecord?.id ?? String(Date.now()),
			petId: existingRecord?.petId ?? selectedPet.id,
			date: recordDate,
			hospitalName: hospitalName.trim(),
			totalCost: finalCost,
			paymentMethod,
			receiptScanned: existingRecord?.receiptScanned || !!receiptImageUri,
			items: items.map((item) => ({
				id: item.id,
				name: item.name,
				cost: parseNumericValue(item.cost),
			})),
		};

		addMedicalExpenseRecord(newRecord);

		router.replace({
			pathname: '/health-summary',
			params: { tab: 'medical' },
		} as Href);
	};

	const handleDeleteRecord = () => {
		if (!existingRecord) return;
		Alert.alert('의료비 기록을 삭제할까요?', '삭제한 기록은 되돌릴 수 없어요.', [
			{ style: 'cancel', text: '취소' },
			{
				style: 'destructive',
				text: '삭제',
				onPress: () => {
					deleteMedicalExpenseRecord(existingRecord.id);
					router.replace({ pathname: '/health-summary', params: { tab: 'medical' } } as Href);
				},
			},
		]);
	};

	const selectedItem = selectedItemId
		? items.find(({ id }) => id === selectedItemId)
		: undefined;

	return (
		<AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
			<TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="의료비 기록하기" />

			<ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.scanBanner}>
					<View style={styles.scanBannerLeft}>
						<View style={styles.scanIconBg}>
							<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.bill} style={styles.scanIcon} />
						</View>
						<View style={styles.scanTextGroup}>
							<Text style={styles.scanBannerTitle}>영수증으로 빠르게 기록해요</Text>
							<Text style={styles.scanBannerSub}>OCR로 병원명, 금액, 날짜를 자동 입력해요.</Text>
						</View>
					</View>
					<TouchableOpacity
						accessibilityLabel="영수증 스캔"
						accessibilityRole="button"
						activeOpacity={0.8}
						disabled={!isEditing}
						onPress={handleScanReceipt}
						style={styles.scanButton}
					>
						<Text style={styles.scanButtonText}>스캔</Text>
					</TouchableOpacity>
				</View>

				{receiptImageUri ? (
					<View style={styles.receiptPreviewCard}>
						<Image source={{ uri: receiptImageUri }} style={styles.receiptImage} />
						<TouchableOpacity
							activeOpacity={0.8}
							disabled={!isEditing}
							onPress={() => setReceiptImageUri(null)}
							style={styles.removeReceiptButton}
						>
							<AppIcon color={COLORS.background} name="close" size={14} />
						</TouchableOpacity>
					</View>
				) : null}

				<View style={styles.card}>
					<Text style={styles.cardLabel}>결제 금액</Text>
					<View style={styles.inputRow}>
						<TextInput
							editable={isEditing}
							keyboardType="number-pad"
							onBlur={handleAmountBlur}
							onChangeText={handleAmountChange}
							placeholder="금액을 입력해주세요"
							placeholderTextColor={COLORS.gray500}
							style={[styles.inputValue, !amount && styles.inputPlaceholder]}
							value={amount}
						/>
						<Text style={styles.inputUnit}>원</Text>
					</View>
				</View>

				<View style={styles.rowTwoCards}>
					<TouchableOpacity activeOpacity={0.8} disabled={!isEditing} onPress={() => setDatePickerVisible(true)} style={styles.metaCard}>
						<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.calendar} style={styles.metaIcon} />
						<View style={styles.metaTextGroup}>
							<Text style={styles.metaLabel}>이용 날짜</Text>
							<Text style={styles.metaValue}>{recordDate}</Text>
						</View>
					</TouchableOpacity>
					<TouchableOpacity activeOpacity={0.8} disabled={!isEditing} onPress={() => setPaymentMethodModalVisible(true)} style={styles.metaCard}>
						<AppIcon color={COLORS.gold} name="card-outline" size={22} />
						<View style={styles.metaTextGroup}>
							<Text style={styles.metaLabel}>결제수단</Text>
							<Text style={[styles.metaValue, !paymentMethod && styles.placeholderText]}>{paymentMethod ?? '결제수단을 선택해주세요'}</Text>
						</View>
					</TouchableOpacity>
				</View>

				<View style={styles.card}>
					<View style={styles.hospitalRow}>
						<View>
							<Text style={styles.cardLabel}>병원</Text>
							<TextInput
								editable={isEditing}
								onChangeText={setHospitalName}
								placeholder="병원을 입력해주세요"
								placeholderTextColor={COLORS.gray500}
								style={styles.hospitalInput}
								value={hospitalName}
							/>
						</View>
						<View style={styles.hospitalTag}>
							<Text style={styles.hospitalTagText}>병원</Text>
						</View>
					</View>
				</View>

				<View style={styles.card}>
					<View style={styles.itemHeader}>
						<Text style={styles.cardLabel}>세부 항목</Text>
						<TouchableOpacity
							activeOpacity={0.7}
							disabled={!isEditing}
							onPress={() => openItemEditor()}
							style={styles.addItemBtn}
						>
							<AppIcon color={COLORS.gold} name="add" size={16} />
						</TouchableOpacity>
					</View>
					<View style={styles.itemList}>
						{items.map((item, index) => (
							<React.Fragment key={item.id}>
								{index > 0 ? <View style={styles.itemDivider} /> : null}
								<TouchableOpacity
									activeOpacity={0.8}
									onLongPress={() => setSelectedItemId(item.id)}
									style={styles.itemRow}
								>
									<Text style={styles.itemName}>{item.name}</Text>
									<Text style={styles.itemCost}>{item.cost}원</Text>
								</TouchableOpacity>
							</React.Fragment>
						))}
						{items.length === 0 ? <Text style={styles.emptyItemText}>등록된 세부 항목이 없어요.</Text> : null}
					</View>
				</View>
			</ScrollView>

			<View style={styles.bottomBar}>
				{existingRecord && !isEditing ? (
					<View style={styles.actionRow}>
						<AppButton onPress={() => setIsEditing(true)} style={styles.actionButton} title="수정" />
						<AppButton onPress={handleDeleteRecord} style={styles.actionButton} title="삭제" variant="danger" />
					</View>
				) : (
					<AppButton onPress={handleSaveRecord} style={{ backgroundColor: COLORS.gold }} title={existingRecord ? '저장하기' : '의료비 기록 저장'} />
				)}
			</View>
			<DatePickerSheet
				onClose={() => setDatePickerVisible(false)}
				onSelect={(date) => setRecordedAt(date)}
				title="이용 날짜 선택"
				value={recordedAt}
				visible={datePickerVisible}
			/>

			<AppModal
				onClose={closeItemEditor}
				primaryAction={{
					disabled: !newItemName.trim() || !newItemCost.trim(),
					label: editingItemId ? '저장' : '추가',
					onPress: handleSaveItem,
				}}
				secondaryAction={{
					label: '취소',
					onPress: closeItemEditor,
				}}
				title={editingItemId ? '세부 항목 수정' : '세부 항목 추가'}
				variant="center"
				visible={isAddModalVisible}
			>
				<View style={styles.modalContent}>
					<AppInput
						label="항목 내용"
						onChangeText={setNewItemName}
						placeholder="예: 진료비, 주사료 등"
						value={newItemName}
					/>
					<AppInput
						keyboardType="number-pad"
						label="가격"
						onChangeText={handleCostChange}
						placeholder="예: 15,000"
						value={newItemCost}
					/>
				</View>
			</AppModal>

			<AppModal
				onClose={() => setPaymentMethodModalVisible(false)}
				title="결제수단 선택"
				variant="center"
				visible={paymentMethodModalVisible}
			>
				<View style={styles.paymentMethodList}>
					{PAYMENT_METHOD_OPTIONS.map((option) => (
						<TouchableOpacity
							activeOpacity={0.8}
							key={option}
							onPress={() => {
								setPaymentMethod(option);
								setPaymentMethodModalVisible(false);
							}}
							style={[styles.paymentMethodOption, paymentMethod === option && styles.paymentMethodOptionActive]}
						>
							<Text style={[styles.paymentMethodText, paymentMethod === option && styles.paymentMethodTextActive]}>{option}</Text>
						</TouchableOpacity>
					))}
				</View>
			</AppModal>

			<AppModal
				onClose={() => setSelectedItemId(null)}
				primaryAction={{
					label: '수정',
					onPress: () => {
						if (selectedItem) {
							setIsEditing(true);
							openItemEditor(selectedItem);
						}
						setSelectedItemId(null);
					},
				}}
				secondaryAction={{
					label: '삭제',
					onPress: handleDeleteItem,
					variant: 'danger',
				}}
				title="세부 항목 관리"
				variant="center"
				visible={Boolean(selectedItem)}
			>
				<Text style={styles.itemActionDescription}>{selectedItem?.name}</Text>
			</AppModal>
		</AppScreen>
	);
}

const styles = StyleSheet.create({
	scrollContent: { gap: SPACING.lg, paddingBottom: SPACING.xxxl, paddingTop: SPACING.xxl },
	scanBanner: { alignItems: 'center', backgroundColor: COLORS.cream, borderRadius: RADIUS.lg, flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.xl },
	scanBannerLeft: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md, flex: 1 },
	scanIconBg: {
		alignItems: 'center',
		backgroundColor: COLORS.background,
		borderRadius: RADIUS.round,
		height: 40,
		justifyContent: 'center',
		width: 40,
	},
	scanIcon: { height: 22, width: 22, tintColor: COLORS.gold },
	scanTextGroup: { flex: 1, gap: 2 },
	scanBannerTitle: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	scanBannerSub: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
	scanButton: { backgroundColor: COLORS.background, borderRadius: RADIUS.round, paddingHorizontal: 16, paddingVertical: 8 },
	scanButtonText: { ...TYPOGRAPHY.smallButton, color: COLORS.gold },
	receiptPreviewCard: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md, position: 'relative', width: 120, height: 120 },
	receiptImage: { width: '100%', height: '100%', borderRadius: RADIUS.md },
	removeReceiptButton: { position: 'absolute', top: 4, right: 4, backgroundColor: COLORS.gray800, borderRadius: RADIUS.round, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
	card: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.xxl },
	cardLabel: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xl, paddingBottom: SPACING.xs, borderBottomWidth: 2, borderBottomColor: COLORS.gold },
	inputValue: { ...TYPOGRAPHY.title1, color: COLORS.black, fontSize: 28, height: 38, lineHeight: 38, margin: 0, padding: 0, textAlignVertical: 'center' },
	inputPlaceholder: { color: COLORS.gray500, fontFamily: TYPOGRAPHY.body2.fontFamily, fontSize: 16, lineHeight: 24 },
	inputUnit: { ...TYPOGRAPHY.body1, color: COLORS.black },
	rowTwoCards: { flexDirection: 'row', gap: SPACING.md },
	metaCard: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, flex: 1, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
	metaIcon: { height: 22, width: 22 },
	metaTextGroup: { flex: 1, gap: 2, justifyContent: 'center' },
	metaLabel: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	metaValue: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	placeholderText: { color: COLORS.gray500, fontFamily: TYPOGRAPHY.body2.fontFamily, fontSize: 12 },
	hospitalRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	hospitalInput: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily, height: 32, lineHeight: 24, marginTop: SPACING.md, paddingBottom: 2, paddingTop: 4, textAlignVertical: 'center' },
	hospitalTag: { backgroundColor: COLORS.cream, borderRadius: RADIUS.round, paddingHorizontal: SPACING.md, paddingVertical: 6 },
	hospitalTagText: { ...TYPOGRAPHY.small, color: COLORS.gold, fontFamily: TYPOGRAPHY.button.fontFamily },
	itemHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	addItemBtn: { alignItems: 'center', backgroundColor: COLORS.cream, borderRadius: RADIUS.round, height: 32, justifyContent: 'center', width: 32 },
	itemList: { marginTop: SPACING.lg },
	itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm },
	itemName: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
	itemCost: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	itemDivider: { backgroundColor: COLORS.gray100, height: 1 },
	emptyItemText: { ...TYPOGRAPHY.body2, color: COLORS.gray500, paddingVertical: SPACING.sm },
	bottomBar: { paddingTop: SPACING.md, paddingBottom: SPACING.md },
	actionRow: { flexDirection: 'row', gap: SPACING.md },
	actionButton: { flex: 1 },
	modalContent: { gap: SPACING.lg, paddingVertical: SPACING.sm },
	paymentMethodList: { gap: SPACING.sm },
	paymentMethodOption: { borderColor: COLORS.gray200, borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
	paymentMethodOptionActive: { backgroundColor: COLORS.cream, borderColor: COLORS.gold },
	paymentMethodText: { ...TYPOGRAPHY.body2, color: COLORS.black },
	paymentMethodTextActive: { color: COLORS.gold, fontFamily: TYPOGRAPHY.button.fontFamily },
	itemActionDescription: { ...TYPOGRAPHY.body2, color: COLORS.gray600, textAlign: 'center' },
});
