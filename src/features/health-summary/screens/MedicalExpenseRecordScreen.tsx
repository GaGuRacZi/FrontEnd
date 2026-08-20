import * as ImagePicker from 'expo-image-picker';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton, AppIcon, DatePickerSheet, EmptyState, LoadingView } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { AppModal } from '@/src/components/modal';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';

import { useHealthSummaryStore } from '../HealthSummaryStore';
import { getHealthRequestErrorMessage, getMedicalExpenseRecord } from '../services/healthSummaryApi';
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
	const { hasLoadError: petLoadError, isReady: petsReady, reloadPets, selectedPet } = usePetStore();
	const { deleteMedicalExpenseRecord, medicalExpenseRecords, saveMedicalExpenseRecord } = useHealthSummaryStore();
	const { recordId } = useLocalSearchParams<{ recordId?: string }>();
	const cachedRecord = recordId
		? medicalExpenseRecords.find(({ id }) => id === recordId)
		: undefined;
	const [remoteRecord, setRemoteRecord] = useState<MedicalExpenseRecord>();
	const existingRecord = remoteRecord ?? cachedRecord;
	const [isEditing, setIsEditing] = useState(!recordId);
	const [detailLoading, setDetailLoading] = useState(Boolean(recordId && !cachedRecord));
	const [detailLoadError, setDetailLoadError] = useState(false);
	const [detailRequest, setDetailRequest] = useState(0);
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

	const recordDate = formatRecordDate(recordedAt);
	const [isAddModalVisible, setIsAddModalVisible] = useState(false);
	const [newItemName, setNewItemName] = useState('');
	const [newItemCost, setNewItemCost] = useState('');
	const [editingItemId, setEditingItemId] = useState<string | null>(null);
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

	useEffect(() => {
		if (!recordId || isEditing) return;
		let active = true;
		void getMedicalExpenseRecord(recordId)
			.then((record) => {
				if (!active) return;
				setRemoteRecord(record);
				setRecordedAt(parseRecordDate(record.date));
				setItems(record.items.map((item) => ({ ...item, cost: item.cost.toLocaleString() })));
				setAmount(record.totalCost.toLocaleString());
				setHospitalName(record.hospitalName);
				setPaymentMethod(record.paymentMethod);
				setDetailLoadError(false);
			})
			.catch(() => {
				if (active && !cachedRecord) setDetailLoadError(true);
			})
			.finally(() => {
				if (active) setDetailLoading(false);
			});
		return () => {
			active = false;
		};
	}, [cachedRecord, detailRequest, isEditing, recordId]);

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
		try {
			if (Platform.OS === 'ios') {
				const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
				if (!permission.granted) {
					Alert.alert('권한 필요', '영수증 사진을 선택하려면 사진 라이브러리 접근 권한이 필요해요.');
					return;
				}
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				defaultTab: 'photos',
				mediaTypes: ['images'],
				quality: 0.8,
			});
			if (!result.canceled) {
				Alert.alert('영수증 스캔에 실패하였습니다.', '의료비 정보를 직접 입력해주세요.');
			}
		} catch {
			Alert.alert('영수증 스캔에 실패하였습니다.', '의료비 정보를 직접 입력해주세요.');
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
		setAmount(newTotalCost.toLocaleString());
		setItems(updatedItems);
		closeItemEditor();
	};

	const handleDeleteItem = () => {
		if (!selectedItemId) return;
		setIsEditing(true);
		const next = items.filter(({ id }) => id !== selectedItemId);
		setItems(next);
		setAmount(next.reduce((sum, item) => sum + parseNumericValue(item.cost), 0).toLocaleString());
		setSelectedItemId(null);
	};

	const handleSaveRecord = async () => {
		if (isSaving.current) return;
		if (!selectedPet) {
			Alert.alert('반려동물 선택 필요', '의료비를 기록할 반려동물을 먼저 선택해주세요.');
			return;
		}
		if (parseNumericValue(amount) <= 0) {
			Alert.alert('입력 오류', '결제 금액을 입력해주세요.');
			return;
		}
		if (items.length === 0) {
			Alert.alert('입력 오류', '세부 항목을 하나 이상 추가해주세요.');
			return;
		}
		if (parseNumericValue(amount) !== totalItemsCost) {
			Alert.alert('입력 오류', '결제 금액과 세부 항목 금액 합계가 같아야 해요.');
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
			id: existingRecord?.id ?? '',
			petId: existingRecord?.petId ?? selectedPet.id,
			date: recordDate,
			hospitalName: hospitalName.trim(),
			totalCost: finalCost,
			paymentMethod,
			items: items.map((item) => ({
				id: item.id,
				name: item.name,
				cost: parseNumericValue(item.cost),
			})),
		};

		try {
			await saveMedicalExpenseRecord(newRecord);
			router.replace({
				pathname: '/health-summary',
				params: { tab: 'medical' },
			} as Href);
		} catch (error) {
			Alert.alert('저장할 수 없어요', getHealthRequestErrorMessage(error, '의료비 기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요.'));
		} finally {
			isSaving.current = false;
		}
	};

	const handleDeleteRecord = () => {
		if (!existingRecord) return;
		Alert.alert('의료비 기록을 삭제할까요?', '삭제한 기록은 되돌릴 수 없어요.', [
			{ style: 'cancel', text: '취소' },
			{
				style: 'destructive',
				text: '삭제',
				onPress: () => {
					void (async () => {
						try {
							await deleteMedicalExpenseRecord(existingRecord);
							router.replace({ pathname: '/health-summary', params: { tab: 'medical' } } as Href);
						} catch {
							Alert.alert('삭제할 수 없어요', '의료비 기록을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.');
						}
					})();
				},
			},
		]);
	};

	const selectedItem = selectedItemId
		? items.find(({ id }) => id === selectedItemId)
		: undefined;

	if (!petsReady) {
		return <AppScreen><TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="의료비 기록하기" /><LoadingView label="반려동물 정보를 불러오고 있어요." /></AppScreen>;
	}

	if (!selectedPet) {
		return <AppScreen><TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="의료비 기록하기" /><EmptyState actionLabel={petLoadError ? '다시 시도' : '반려동물 등록'} onActionPress={petLoadError ? reloadPets : () => router.push('/pet/add' as Href)} title={petLoadError ? '반려동물 정보를 불러오지 못했어요' : '등록된 반려동물이 없어요'} /></AppScreen>;
	}

	if (detailLoading) {
		return <AppScreen><TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="의료비 기록하기" /><LoadingView label="의료비 기록을 불러오고 있어요." /></AppScreen>;
	}

	if (detailLoadError && !existingRecord) {
		return <AppScreen><TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="의료비 기록하기" /><EmptyState actionLabel="다시 시도" onActionPress={() => { setDetailLoading(true); setDetailRequest((current) => current + 1); }} title="의료비 기록을 불러오지 못했어요" /></AppScreen>;
	}

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
							<Text style={styles.scanBannerSub}>영수증 사진을 선택해 정보를 확인해보세요.</Text>
						</View>
					</View>
					<TouchableOpacity
						accessibilityLabel="영수증 사진 선택"
						accessibilityRole="button"
						activeOpacity={0.8}
						onPress={() => void handleScanReceipt()}
						style={styles.scanButton}
					>
						<Text style={styles.scanButtonText}>선택</Text>
					</TouchableOpacity>
				</View>

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
							<Text style={[styles.metaValue, !paymentMethod && styles.placeholderText]}>{paymentMethod ?? '선택해주세요'}</Text>
						</View>
					</TouchableOpacity>
				</View>

				<View style={styles.card}>
					<View style={styles.hospitalRow}>
						<View style={styles.hospitalTextGroup}>
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
					<Text style={styles.itemHint}>각 목록을 꾹 눌러 수정하거나 삭제할 수 있어요.</Text>
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
						<AppButton onPress={() => void handleSaveRecord()} style={{ backgroundColor: COLORS.gold }} title={existingRecord ? '저장하기' : '의료비 기록 저장'} />
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
	scanBanner: { alignItems: 'center', backgroundColor: COLORS.cream, borderRadius: RADIUS.lg, flexDirection: 'row', gap: SPACING.md, padding: SPACING.xl },
	scanBannerLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: SPACING.md },
	scanIconBg: { alignItems: 'center', backgroundColor: COLORS.background, borderRadius: RADIUS.round, height: 40, justifyContent: 'center', width: 40 },
	scanIcon: { height: 22, tintColor: COLORS.gold, width: 22 },
	scanTextGroup: { flex: 1, gap: 2 },
	scanBannerTitle: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	scanBannerSub: { ...TYPOGRAPHY.caption, color: COLORS.gray500 },
	scanButton: { backgroundColor: COLORS.background, borderRadius: RADIUS.round, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm },
	scanButtonText: { ...TYPOGRAPHY.smallButton, color: COLORS.gold },
	card: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.xxl },
	cardLabel: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xl, paddingBottom: SPACING.xs, borderBottomWidth: 2, borderBottomColor: COLORS.gold },
	inputValue: { ...TYPOGRAPHY.title1, color: COLORS.black, flex: 1, fontSize: 28, height: 38, lineHeight: 38, margin: 0, paddingHorizontal: 2, paddingVertical: 0, textAlign: 'left', textAlignVertical: 'center' },
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
	hospitalTextGroup: { flex: 1, minWidth: 0 },
	hospitalInput: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily, height: 34, includeFontPadding: false, lineHeight: 34, marginTop: SPACING.md, paddingHorizontal: 0, paddingVertical: 0, textAlignVertical: 'center' },
	hospitalTag: { backgroundColor: COLORS.cream, borderRadius: RADIUS.round, paddingHorizontal: SPACING.md, paddingVertical: 6 },
	hospitalTagText: { ...TYPOGRAPHY.small, color: COLORS.gold, fontFamily: TYPOGRAPHY.button.fontFamily },
	itemHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	itemHint: { ...TYPOGRAPHY.caption, color: COLORS.gray500, marginTop: SPACING.sm },
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
