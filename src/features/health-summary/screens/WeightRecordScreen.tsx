import * as ImagePicker from 'expo-image-picker';
import { Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton, AppIcon } from '@/src/components/common';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { MOCK_WEIGHT_RECORDS } from '../mock';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';
import { AppetiteCondition, BodyCondition, WeightRecord } from '../types';

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatRecordDate = (date: Date) =>
	`${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

const formatRecordTime = (date: Date) => {
	const hours24 = date.getHours();
	const period = hours24 < 12 ? '오전' : '오후';
	const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
	return `${period} ${hours12}:${pad2(date.getMinutes())}`;
};

export function WeightRecordScreen() {
	const router = useRouter();
	const [recordedAt] = useState(() => new Date());
	const [weight, setWeight] = useState('4.2');
	const [bodyCondition, setBodyCondition] = useState<BodyCondition>('ideal');
	const [appetite, setAppetite] = useState<AppetiteCondition>('low');
	const [memo, setMemo] = useState('');
	const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

	const recordDate = formatRecordDate(recordedAt);
	const recordTime = formatRecordTime(recordedAt);

	const bodyOptions: { key: BodyCondition; label: string }[] = [
		{ key: 'lean', label: '마름' },
		{ key: 'ideal', label: '적정' },
		{ key: 'overweight', label: '과체중' },
	];

	const appetiteOptions: { key: AppetiteCondition; label: string }[] = [
		{ key: 'low', label: '식욕이 떨어짐' },
		{ key: 'normal', label: '식욕 평범' },
		{ key: 'high', label: '식욕이 많음' },
	];

	const handlePickImage = async () => {
		try {
			const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (!permission.granted) {
				Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 허용되어야 사진을 추가할 수 있어요.');
				return;
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ['images'],
				allowsEditing: true,
				aspect: [1, 1],
				quality: 0.8,
			});

			if (!result.canceled && result.assets && result.assets[0]) {
				setSelectedImageUri(result.assets[0].uri);
			}
		} catch (error) {
			console.error('Image picker error:', error);
			Alert.alert('오류', '사진을 불러오는 중 문제가 발생했어요.');
		}
	};

	const handleSaveRecord = () => {
		const newRecord: WeightRecord = {
			id: String(Date.now()),
			date: recordDate,
			time: recordTime,
			weight: parseFloat(weight) || 0,
			bodyCondition,
			appetite,
			memo: memo.trim() || undefined,
			photoUri: selectedImageUri ?? undefined,
			isDirectInput: true,
		};

		MOCK_WEIGHT_RECORDS.unshift(newRecord);

		router.replace({
			pathname: '/health-summary',
			params: { tab: 'weight' },
		} as Href);
	};

	return (
		<AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
			<TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="체중 기록하기" />

			<ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.rowTwoCards}>
					<View style={styles.metaCard}>
						<Image resizeMode="contain" source={HEALTH_SUMMARY_IMAGES.icons.calendar} style={styles.metaIcon} />
						<View style={styles.metaTextGroup}>
							<Text style={styles.metaLabel}>기록 날짜</Text>
							<Text style={styles.metaValue}>{recordDate}</Text>
						</View>
					</View>
					<View style={styles.metaCard}>
						<View style={styles.metaTextGroup}>
							<Text style={styles.metaLabel}>측정 시간</Text>
							<Text style={styles.metaValue}>{recordTime}</Text>
						</View>
					</View>
				</View>

				<View style={styles.card}>
					<Text style={styles.cardLabel}>몸무게</Text>
					<View style={styles.inputRow}>
						<TextInput keyboardType="decimal-pad" onChangeText={setWeight} style={styles.inputValue} value={weight} />
						<Text style={styles.inputUnit}>kg</Text>
					</View>
				</View>

				<View style={styles.card}>
					<Text style={styles.cardLabel}>체형 상태</Text>
					<Text style={styles.cardHint}>육안으로 봤을 때 가장 가까운 상태를 골라요.</Text>
					<View style={styles.chipRow}>
						{bodyOptions.map((opt) => (
							<TouchableOpacity
								activeOpacity={0.8}
								key={opt.key}
								onPress={() => setBodyCondition(opt.key)}
								style={[styles.chip, bodyCondition === opt.key && styles.chipActive]}
							>
								<Text style={[styles.chipText, bodyCondition === opt.key && styles.chipTextActive]}>{opt.label}</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>

				<View style={[styles.card, { backgroundColor: COLORS.cream, borderColor: 'transparent' }]}>
					<Text style={styles.cardLabel}>컨디션 체크</Text>
					<View style={styles.radioGroup}>
						{appetiteOptions.map((opt) => {
							const active = appetite === opt.key;
							return (
								<TouchableOpacity activeOpacity={0.8} key={opt.key} onPress={() => setAppetite(opt.key)} style={styles.radioOption}>
									<View style={[styles.radioCircle, active && styles.radioCircleActive]}>
										{active && <AppIcon color={COLORS.background} name="checkmark" size={14} />}
									</View>
									<Text style={styles.radioLabel}>{opt.label}</Text>
								</TouchableOpacity>
							);
						})}
					</View>
				</View>

				<View style={styles.card}>
					<View style={styles.memoHeader}>
						<Text style={styles.cardLabel}>메모</Text>
						<TouchableOpacity
							accessibilityLabel="사진 추가"
							accessibilityRole="button"
							activeOpacity={0.7}
							onPress={handlePickImage}
							style={styles.photoButton}
						>
							<AppIcon color={COLORS.primary} name="camera" size={16} />
							<Text style={styles.photoButtonText}>사진</Text>
						</TouchableOpacity>
					</View>

					{selectedImageUri ? (
						<View style={styles.imagePreviewContainer}>
							<Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
							<TouchableOpacity
								activeOpacity={0.8}
								onPress={() => setSelectedImageUri(null)}
								style={styles.removeImageButton}
							>
								<AppIcon color={COLORS.background} name="close" size={14} />
							</TouchableOpacity>
						</View>
					) : null}

					<TextInput
						multiline
						scrollEnabled={false}
						onChangeText={setMemo}
						placeholder="식사 후 같은 시간대에 측정했어요."
						placeholderTextColor={COLORS.gray500}
						style={styles.memoInput}
						value={memo}
					/>
				</View>
			</ScrollView>

			<View style={styles.bottomBar}>
				<AppButton onPress={handleSaveRecord} title="체중 기록 저장" />
			</View>
		</AppScreen>
	);
}

const styles = StyleSheet.create({
	scrollContent: { gap: SPACING.lg, paddingBottom: SPACING.xxxl, paddingTop: SPACING.md },
	rowTwoCards: { flexDirection: 'row', gap: SPACING.md },
	metaCard: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, flex: 1, paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
	metaIcon: { height: 22, width: 22 },
	metaTextGroup: { flex: 1, gap: 2, justifyContent: 'center' },
	metaLabel: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	metaValue: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	card: { backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.xxl },
	cardLabel: { ...TYPOGRAPHY.body1, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	cardHint: { ...TYPOGRAPHY.small, color: COLORS.gray500, marginVertical: 4 },
	inputRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: SPACING.xl, paddingBottom: SPACING.xs, borderBottomWidth: 2, borderBottomColor: COLORS.primary },
	inputValue: { ...TYPOGRAPHY.title1, color: COLORS.black, fontSize: 36, lineHeight: 46, padding: 0, margin: 0 },
	inputUnit: { ...TYPOGRAPHY.body1, color: COLORS.gray600 },
	chipRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
	chip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.round, backgroundColor: COLORS.background, borderColor: COLORS.gray200, borderWidth: 1 },
	chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
	chipText: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
	chipTextActive: { color: COLORS.background, fontFamily: TYPOGRAPHY.button.fontFamily },
	radioGroup: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.lg, paddingHorizontal: SPACING.xs },
	radioOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
	radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: COLORS.gray300, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
	radioCircleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
	radioLabel: { ...TYPOGRAPHY.body2, color: COLORS.black, fontFamily: TYPOGRAPHY.button.fontFamily },
	memoHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
	photoButton: { alignItems: 'center', backgroundColor: COLORS.summarycontainer, borderRadius: RADIUS.round, flexDirection: 'row', gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: 6 },
	photoButtonText: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontFamily: TYPOGRAPHY.button.fontFamily },
	imagePreviewContainer: { marginTop: SPACING.md, position: 'relative', width: 80, height: 80 },
	previewImage: { width: '100%', height: '100%', borderRadius: RADIUS.md },
	removeImageButton: { position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.gray800, borderRadius: RADIUS.round, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
	memoInput: {
		...TYPOGRAPHY.body2,
		color: COLORS.black,
		marginTop: SPACING.lg,
		padding: 0,
		minHeight: 60,
		textAlignVertical: 'top'
	},
	bottomBar: { paddingTop: SPACING.md, paddingBottom: SPACING.md },
});