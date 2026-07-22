import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import { PET_SELECTION_TITLES } from '../petData';
import type { PetSelectionField } from '../types';

const CARE_ROW_META: Record<
  PetSelectionField,
  { description: string; icon: AppIconName }
> = {
  excludedIngredients: {
    description: '알레르기·주의 원료',
    icon: 'ban-outline',
  },
  surgeries: {
    description: '과거 수술 및 진료 이력',
    icon: 'medical-outline',
  },
  careAreas: {
    description: '피부·관절·신장 등',
    icon: 'person-outline',
  },
};

type PetInfoCardProps = {
  children: ReactNode;
  description: string;
  minHeight?: number;
  required?: boolean;
  title: string;
};

type PetInfoRowProps = {
  children: ReactNode;
  label: string;
  required?: boolean;
};

type PetChoiceButtonProps = {
  compact?: boolean;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
  selected: boolean;
};

type PetCareInfoRowProps = {
  disabled?: boolean;
  field: PetSelectionField;
  onPress?: () => void;
  values: string[];
};

export function PetInfoCard({
  children,
  description,
  minHeight,
  required = false,
  title,
}: PetInfoCardProps) {
  return (
    <View style={[styles.card, minHeight ? { minHeight } : undefined]}>
      <View style={styles.labelRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        {required ? <Text style={styles.requiredMark}>*</Text> : null}
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function PetInfoRow({ children, label, required = false }: PetInfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.labelRow, styles.infoLabel]}>
        <Text style={styles.infoLabelText}>{label}</Text>
        {required ? <Text style={styles.requiredMark}>*</Text> : null}
      </View>
      <View style={styles.infoContent}>{children}</View>
    </View>
  );
}

export function PetChoiceButton({
  compact = false,
  disabled = false,
  label,
  onPress,
  selected,
}: PetChoiceButtonProps) {
  const buttonStyle = [
    styles.choiceButton,
    compact && styles.compactChoiceButton,
    selected && styles.selectedChoiceButton,
    disabled && styles.disabled,
  ];
  const labelElement = (
    <Text style={[styles.choiceLabel, selected && styles.selectedChoiceLabel]}>{label}</Text>
  );

  if (!onPress) {
    return (
      <View accessibilityLabel={`${label}${selected ? ', 선택됨' : ''}`} style={buttonStyle}>
        {labelElement}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [buttonStyle, pressed && styles.pressed]}
    >
      {labelElement}
    </Pressable>
  );
}

export function PetCareInfoRow({
  disabled = false,
  field,
  onPress,
  values,
}: PetCareInfoRowProps) {
  const meta = CARE_ROW_META[field];
  const isEditable = Boolean(onPress);
  const description = values.length
    ? values.join(' · ')
    : isEditable
      ? meta.description
      : '등록된 정보 없음';
  const content = (
    <>
      <View style={styles.careIcon}>
        <AppIcon color={COLORS.primary} name={meta.icon} size={21} />
      </View>
      <View style={styles.careTextArea}>
        <Text style={styles.careTitle}>{PET_SELECTION_TITLES[field]}</Text>
        <Text numberOfLines={isEditable ? 1 : 2} style={styles.careDescription}>
          {description}
        </Text>
      </View>
      {isEditable ? (
        <>
          <Text style={styles.careAction}>등록하기</Text>
          <AppIcon color={COLORS.gray500} name="chevron-forward" size={18} />
        </>
      ) : (
        <Text style={styles.careStatus}>{values.length ? `${values.length}개` : '미등록'}</Text>
      )}
    </>
  );

  if (!onPress) {
    return (
      <View
        accessibilityLabel={`${PET_SELECTION_TITLES[field]}: ${description}`}
        style={styles.careRow}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={`${PET_SELECTION_TITLES[field]} 등록`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.careRow,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    ...TYPOGRAPHY.title3,
    color: COLORS.black,
  },
  cardDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    marginTop: 1,
  },
  cardBody: {
    gap: 10,
    marginTop: 11,
  },
  labelRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 3,
  },
  requiredMark: {
    ...TYPOGRAPHY.input,
    color: COLORS.error,
  },
  infoRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    minHeight: 44,
  },
  infoLabel: {
    paddingTop: 12,
    width: 82,
  },
  infoLabelText: {
    ...TYPOGRAPHY.input,
    color: COLORS.black,
    fontFamily: TYPOGRAPHY.label.fontFamily,
  },
  infoContent: {
    flex: 1,
    maxWidth: 232,
  },
  choiceButton: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  compactChoiceButton: {
    height: 34,
    marginTop: 5,
  },
  selectedChoiceButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  choiceLabel: {
    ...TYPOGRAPHY.selection,
    color: COLORS.gray800,
  },
  selectedChoiceLabel: {
    ...TYPOGRAPHY.selectionActive,
    color: COLORS.background,
  },
  careRow: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.borderSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  careIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.round,
    height: 32,
    justifyContent: 'center',
    marginRight: 10,
    width: 32,
  },
  careTextArea: {
    flex: 1,
    minWidth: 0,
  },
  careTitle: {
    ...TYPOGRAPHY.input,
    color: COLORS.black,
  },
  careDescription: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
  },
  careAction: {
    ...TYPOGRAPHY.smallButton,
    color: COLORS.primary,
    marginLeft: SPACING.md,
  },
  careStatus: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray500,
    marginLeft: SPACING.md,
  },
  pressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.5,
  },
});
