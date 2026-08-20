import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, TYPOGRAPHY } from '@/src/constants';

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
  pressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.5,
  },
});
