import * as ImagePicker from 'expo-image-picker';
import { Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton, AppIcon } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { AppModal } from '@/src/components/modal';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { MOCK_EXPENSE_RECORDS } from '../mock';
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

const formatNumberWithComma = (value: string) => {
	const numericOnly = value.replace(/[^0-9]/g, '');
	if (!numericOnly) return '';
	return Number(numericOnly).toLocaleString();
};

const parseNumericValue = (value: string) => {
	const numericOnly = value.replace(/[^0-9]/g, '');
	return numericOnly ? Number(numericOnly) : 0;
};

export function MedicalExpenseRecordScreen() {
	const router = useRouter();
	const [recordedAt] = useState(() => new Date());
	const [amount, setAmount] = useState('72,000');
	const [hospitalName, setHospitalName] = useState('??동물병원');
	const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null);

	const recordDate = formatRecordDate(recordedAt);

	const [items, setItems] = useState<ExpenseItem[]>([
		{ id: '1', name: '진찰료', cost: '35,000원' },
		{ id: '2', name: '유선종양 수술', cost: '42,000원' },
	]);
	const [isAddModalVisible, setIsAddModalVisible] = useState(false);
	const [newItemName, setNewItemName] = useState('');
	const [newItemCost, setNewItemCost] = useState('');

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
		} catch (error) {
			console.error('Receipt scan error:', error);
			Alert.alert('오류', '영수증 이미지를 불러오는 중 문제가 발생했어요.');
		}
	};

	const handleAddItem = () => {
		if (!newItemName.trim() || !newItemCost.trim()) return;

		const rawCostNum = parseNumericValue(newItemCost);
		const formattedCost = `${rawCostNum.toLocaleString()}원`;

		const updatedItems = [
			...items,
			{ id: String(Date.now()), name: newItemName.trim(), cost: formattedCost },
		];

		const newTotalCost = updatedItems.reduce((sum, item) => sum + parseNumericValue(item.cost), 0);
		const currentAmountNum = parseNumericValue(amount);

		if (newTotalCost > currentAmountNum) {
			setAmount(newTotalCost.toLocaleString());
		}

		setItems(updatedItems);
		setNewItemName('');
		setNewItemCost('');
		setIsAddModalVisible(false);
	};

	const handleSaveRecord = () => {
		const newRecord: MedicalExpenseRecord = {
			id: String(Date.now()),
			date: recordDate,
			hospitalName: hospitalName.trim() || '병원 미입력',
			totalCost: parseNumericValue(amount),
			paymentMethod: '카카오페이',
			receiptScanned: !!receiptImageUri,
			items: items.map((item) => ({
				id: item.id,
				name: item.name,
				cost: parseNumericValue(item.cost),
			})),
		};

		MOCK_EXPENSE_RECORDS.unshift(newRecord);

		router.replace({
			pathname: '/health-summary',
			params: { tab: 'medical' },
		} as Href);
	};

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
							keyboardType="number-pad"
							onBlur={handleAmountBlur}
							onChangeText={handleAmountChange}
							style={styles.inputValue}
							value={amount}
						/>
						<Text style={styles.inputUnit}>원</Text>
					</View>
				</View>

				<View style={styles.rowTwoCards}>
					<View style={styles.metaCard}>
						<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.calendar} style={styles.metaIcon} />
						<View style={styles.metaTextGroup}>
							<Text style={styles.metaLabel}>이용 날짜</Text>
							<Text style={styles.metaValue}>{recordDate}</Text>
						</View>
					</View>
					<View style={styles.metaCard}>
						<AppIcon color={COLORS.gold} name="card-outline" size={22} />
						<View style={styles.metaTextGroup}>
							<Text style={styles.metaLabel}>결제수단</Text>
							<Text style={styles.metaValue}>카카오페이</Text>
						</View>
					</View>
				</View>

				<View style={styles.card}>
					<View style={styles.hospitalRow}>
						<View>
							<Text style={styles.cardLabel}>병원</Text>
							<TextInput onChangeText={setHospitalName} style={styles.hospitalInput} value={hospitalName} />
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
							onPress={() => setIsAddModalVisible(true)}
							style={styles.addItemBtn}
						>
							<AppIcon color={COLORS.gold} name="add" size={16} />
						</TouchableOpacity>
					</View>
					<View style={styles.itemList}>
						{items.map((item, index) => (
							<React.Fragment key={item.id}>
								{index > 0 ? <View style={styles.itemDivider} /> : null}
								<View style={styles.itemRow}>
									<Text style={styles.itemName}>{item.name}</Text>
									<Text style={styles.itemCost}>{item.cost}</Text>
								</View>
							</React.Fragment>
						))}
					</View>
				</View>
			</ScrollView>

			<View style={styles.bottomBar}>
				<AppButton onPress={handleSaveRecord} style={{ backgroundColor: COLORS.gold }} title="의료비 기록 저장" />
			</View>

			<AppModal
				onClose={() => setIsAddModalVisible(false)}
				primaryAction={{
					disabled: !newItemName.trim() || !newItemCost.trim(),
					label: '추가',
					onPress: handleAddItem,
				}}
				secondaryAction={{
					label: '취소',
					onPress: () => setIsAddModalVisible(false),
				}}
				title="세부 항목 추가"
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
		</AppScreen>
	);
}

const styles = StyleSheet.create({
	scrollContent: { gap: SPACING.lg, paddingBottom: SPACING.xxxl, paddingTop: SPACING.md },
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
	inputRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: SPACING.xl, paddingBottom: SPACING.xs, borderBottomWidth: 2, borderBottomColor: COLORS.gold },
	inputValue: { ...TYPOGRAPHY.title1, color: COLORS.black, fontSize: 36, lineHeight: 46, padding: 0, margin: 0 },
	inputUnit: { ...TYPOGRAPHY.body1, color: COLORS.black },
	rowTwoCards: { flexDirection: 'row', gap: SPACING.md },
	metaCard: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, flex: 1, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
	metaIcon: { height: 22, width: 22 },
	metaTextGroup: { flex: 1, gap: 2, justifyContent: 'center' },
	metaLabel: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	metaValue: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	hospitalRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	hospitalInput: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily, marginTop: SPACING.sm, padding: 0 },
	hospitalTag: { backgroundColor: COLORS.cream, borderRadius: RADIUS.round, paddingHorizontal: SPACING.md, paddingVertical: 6 },
	hospitalTagText: { ...TYPOGRAPHY.small, color: COLORS.gold, fontFamily: TYPOGRAPHY.button.fontFamily },
	itemHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	addItemBtn: { alignItems: 'center', backgroundColor: COLORS.cream, borderRadius: RADIUS.round, height: 32, justifyContent: 'center', width: 32 },
	itemList: { marginTop: SPACING.lg },
	itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm },
	itemName: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
	itemCost: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	itemDivider: { backgroundColor: COLORS.gray100, height: 1 },
	bottomBar: { paddingTop: SPACING.md, paddingBottom: SPACING.md },
	modalContent: { gap: SPACING.lg, paddingVertical: SPACING.sm },
});