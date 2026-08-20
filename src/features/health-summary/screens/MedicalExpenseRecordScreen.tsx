import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AppButton, AppIcon, DatePickerSheet } from '@/src/components/common';
import { AppInput } from '@/src/components/form';
import { AppModal } from '@/src/components/modal';
import { AppScreen, TopHeader } from '@/src/components/layout';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { usePetStore } from '@/src/features/pet/PetStore';

import {
    PaymentType,
    createExpense,
    deleteExpense,
    getExpense,
    updateExpense,
} from '../services/medicalCostService';
import { HEALTH_SUMMARY_IMAGES } from '../utils/images';

// ─── 결제수단 매핑 ────────────────────────────────────────────────────────────

const PAYMENT_OPTIONS: { type: PaymentType; label: string }[] = [
    { type: 'CARD', label: '카드' },
    { type: 'TRANSFER', label: '계좌이체' },
    { type: 'VIRTUAL_ACCOUNT', label: '가상계좌' },
    { type: 'MOBILE', label: '휴대폰 결제' },
    { type: 'EASY_PAY', label: '간편결제' },
];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

type ExpenseItem = {
    id: string;
    name: string;
    cost: string; // 쉼표 포함 문자열 (표시용)
};

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Date → "yyyy-MM-dd" (로컬 날짜 기준 — date-only 필드이므로 로컬 메서드 사용) */
const toDateString = (date: Date) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** "yyyy-MM-dd" → 표시용 "yyyy.MM.dd" */
const formatDisplayDate = (dateStr: string) => dateStr.replace(/-/g, '.');

/** Date → 표시용 "yyyy.MM.dd" */
const formatRecordDate = (date: Date) => formatDisplayDate(toDateString(date));

/** "yyyy-MM-dd" → Date (로컬 자정) */
const parseApiDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    return Number.isNaN(date.valueOf()) ? new Date() : date;
};

/** "yyyy.MM.dd" → Date (로컬 자정) */
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

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function MedicalExpenseRecordScreen() {
    const router = useRouter();
    const isSaving = useRef(false);
    const { selectedPet } = usePetStore();
    const { expenseId: expenseIdParam } = useLocalSearchParams<{ expenseId?: string }>();
    const expenseId = expenseIdParam ? Number(expenseIdParam) : null;

    // ── 뷰/편집 모드 ──
    const [isEditing, setIsEditing] = useState(!expenseId);
    const [isLoadingRecord, setIsLoadingRecord] = useState(!!expenseId);

    // ── 폼 상태 ──
    const [recordedAt, setRecordedAt] = useState(() => new Date());
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [items, setItems] = useState<ExpenseItem[]>([]);
    const [amount, setAmount] = useState('');
    const [hospitalName, setHospitalName] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentType | null>(null);
    const [paymentMethodModalVisible, setPaymentMethodModalVisible] = useState(false);

    // ── 세부 항목 편집 모달 ──
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemCost, setNewItemCost] = useState('');
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

    const recordDate = formatRecordDate(recordedAt);
    const totalItemsCost = items.reduce((sum, item) => sum + parseNumericValue(item.cost), 0);

    // ── 기존 기록 로드 ──
    useEffect(() => {
        if (!expenseId) return;
        setIsLoadingRecord(true);
        getExpense(expenseId)
            .then((record) => {
                setHospitalName(record.expenseName);
                setAmount(record.expenseAmount.toLocaleString());
                setPaymentMethod(record.paymentType);
                setRecordedAt(parseApiDate(record.expenseDate));
                setItems(
                    record.expenseDetails.map((d) => ({
                        id: String(d.expenseDetailId),
                        name: d.expenseDetailName,
                        cost: d.expenseAmount.toLocaleString(),
                    })),
                );
            })
            .catch(() => {
                Alert.alert('오류', '기록을 불러오는 중 문제가 발생했어요.');
                router.back();
            })
            .finally(() => {
                setIsLoadingRecord(false);
            });
    }, [expenseId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── 금액 핸들러 ──
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

    // ── 세부 항목 핸들러 ──
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

    // ── 저장 ──
    const handleSaveRecord = () => {
        if (isSaving.current) return;

        if (!selectedPet) {
            Alert.alert('반려동물 선택 필요', '의료비를 기록할 반려동물을 먼저 선택해주세요.');
            return;
        }

        const amountNum = parseNumericValue(amount);
        if (amountNum <= 0) {
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
        if (items.length === 0) {
            Alert.alert('입력 오류', '세부 항목을 최소 1개 이상 입력해주세요.');
            return;
        }
        if (amountNum !== totalItemsCost) {
            Alert.alert(
                '금액 불일치',
                `결제 금액(${amountNum.toLocaleString()}원)과 세부 항목 합계(${totalItemsCost.toLocaleString()}원)가 일치해야 합니다.`,
            );
            return;
        }

        // 미래 날짜 클램프 (내일 이후 → 오늘로)
        const now = Date.now();
        const clampedDate = new Date(Math.min(recordedAt.getTime(), now));
        const expenseDateStr = toDateString(clampedDate);

        const detailsPayload = items.map((item) => ({
            expenseDetailName: item.name,
            expenseAmount: parseNumericValue(item.cost),
        }));

        isSaving.current = true;

        const request = expenseId
            ? updateExpense(expenseId, {
                  expenseAmount: amountNum,
                  expenseDate: expenseDateStr,
                  paymentType: paymentMethod,
                  expenseName: hospitalName.trim(),
                  expenseDetails: detailsPayload,
              })
            : createExpense(selectedPet.id, {
                  expenseAmount: amountNum,
                  expenseDate: expenseDateStr,
                  paymentType: paymentMethod,
                  expenseName: hospitalName.trim(),
                  expenseDetails: detailsPayload,
              });

        request
            .then(() => {
                router.replace({
                    pathname: '/health-summary',
                    params: { tab: 'medical' },
                } as Href);
            })
            .catch((err: unknown) => {
                Alert.alert('저장 실패', err instanceof Error ? err.message : '저장에 실패했어요. 다시 시도해주세요.');
                isSaving.current = false;
            });
    };

    // ── 삭제 ──
    const handleDeleteRecord = () => {
        if (!expenseId) return;
        Alert.alert('의료비 기록을 삭제할까요?', '삭제한 기록은 되돌릴 수 없어요.', [
            { style: 'cancel', text: '취소' },
            {
                style: 'destructive',
                text: '삭제',
                onPress: () => {
                    deleteExpense(expenseId)
                        .then(() => {
                            router.replace({
                                pathname: '/health-summary',
                                params: { tab: 'medical' },
                            } as Href);
                        })
                        .catch((err: unknown) => {
                            Alert.alert('삭제 실패', err instanceof Error ? err.message : '삭제에 실패했어요.');
                        });
                },
            },
        ]);
    };

    const selectedItem = selectedItemId ? items.find(({ id }) => id === selectedItemId) : undefined;
    const paymentLabel =
        PAYMENT_OPTIONS.find((o) => o.type === paymentMethod)?.label ?? null;

    if (isLoadingRecord) {
        return (
            <AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
                <TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="의료비 기록하기" />
            </AppScreen>
        );
    }

    return (
        <AppScreen scrollable={false} contentContainerStyle={{ flex: 1 }}>
            <TopHeader leftAccessibilityLabel="뒤로가기" leftIcon="chevron-back" onLeftPress={() => router.back()} title="의료비 기록하기" />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* 영수증 스캔 배너 (UI 유지, OCR 미연동) */}
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
                        style={styles.scanButton}
                    >
                        <Text style={styles.scanButtonText}>스캔</Text>
                    </TouchableOpacity>
                </View>

                {/* 결제 금액 */}
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

                {/* 이용 날짜 / 결제수단 */}
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
                            <Text style={[styles.metaValue, !paymentLabel && styles.placeholderText]}>
                                {paymentLabel ?? '결제수단을 선택해주세요'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* 병원명 */}
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

                {/* 세부 항목 */}
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
                                    onLongPress={() => isEditing && setSelectedItemId(item.id)}
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

            {/* 하단 버튼 */}
            <View style={styles.bottomBar}>
                {expenseId && !isEditing ? (
                    <View style={styles.actionRow}>
                        <AppButton onPress={() => setIsEditing(true)} style={styles.actionButton} title="수정" />
                        <AppButton onPress={handleDeleteRecord} style={styles.actionButton} title="삭제" variant="danger" />
                    </View>
                ) : (
                    <AppButton
                        onPress={handleSaveRecord}
                        style={{ backgroundColor: COLORS.gold }}
                        title={expenseId ? '저장하기' : '의료비 기록 저장'}
                    />
                )}
            </View>

            {/* 날짜 선택 */}
            <DatePickerSheet
                onClose={() => setDatePickerVisible(false)}
                onSelect={(date) => setRecordedAt(date)}
                title="이용 날짜 선택"
                value={recordedAt}
                visible={datePickerVisible}
            />

            {/* 세부 항목 추가/수정 모달 */}
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

            {/* 결제수단 선택 모달 */}
            <AppModal
                onClose={() => setPaymentMethodModalVisible(false)}
                title="결제수단 선택"
                variant="center"
                visible={paymentMethodModalVisible}
            >
                <View style={styles.paymentMethodList}>
                    {PAYMENT_OPTIONS.map((option) => (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            key={option.type}
                            onPress={() => {
                                setPaymentMethod(option.type);
                                setPaymentMethodModalVisible(false);
                            }}
                            style={[
                                styles.paymentMethodOption,
                                paymentMethod === option.type && styles.paymentMethodOptionActive,
                            ]}
                        >
                            <Text style={[styles.paymentMethodText, paymentMethod === option.type && styles.paymentMethodTextActive]}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </AppModal>

            {/* 세부 항목 관리 모달 (롱프레스) */}
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
