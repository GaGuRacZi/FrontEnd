import type { PropsWithChildren } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/common';
import type { AppIconName } from '@/src/components/common';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

type DiagnosisSectionCardProps = PropsWithChildren<{
	actionLabel?: string;
	iconBgColor?: string;
	iconColor?: string;
	iconName?: AppIconName;
	iconSize?: number;
	iconSource?: ImageSourcePropType;
	innerSubtitle?: string;
	innerTitle: string;
	onPressAction?: () => void;
	title: string;
}>;

export function DiagnosisSectionCard({
	actionLabel,
	children,
	iconBgColor = COLORS.primarySoft,
	iconColor = COLORS.primary,
	iconName,
	iconSize = 16,
	iconSource,
	innerSubtitle,
	innerTitle,
	onPressAction,
	title,
}: DiagnosisSectionCardProps) {
	return (
		<View style={styles.section}>
			<View style={styles.headerRow}>
				<Text style={styles.title}>{title}</Text>
				{actionLabel && onPressAction ? (
					<Pressable
						accessibilityLabel={actionLabel}
						accessibilityRole="button"
						onPress={onPressAction}
						style={styles.actionButton}
					>
						<AppIcon color={COLORS.primary} name="add" size={16} />
						<Text style={styles.actionLabel}>{actionLabel}</Text>
					</Pressable>
				) : null}
			</View>

			<View style={styles.card}>
				<View style={styles.innerHeaderRow}>
					<View style={[styles.iconBadge, { backgroundColor: iconBgColor }]}>
						{iconSource ? (
							<Image resizeMode="contain" source={iconSource} style={{ height: iconSize, width: iconSize }} />
						) : (
							<AppIcon color={iconColor} name={iconName ?? 'ellipse-outline'} size={iconSize} />
						)}
					</View>
					<View style={styles.innerHeaderTextGroup}>
						<Text style={styles.innerTitle}>{innerTitle}</Text>
						{innerSubtitle ? (
							<Text style={styles.innerSubtitle}>{innerSubtitle}</Text>
						) : null}
					</View>
				</View>

				<View style={styles.content}>{children}</View>
			</View>
		</View>
	);
}

type BulletItemProps = { dotColor?: string; text: string };

export function BulletItem({ dotColor = COLORS.primary, text }: BulletItemProps) {
	return (
		<View style={styles.bulletRow}>
			<View style={[styles.bulletDot, { backgroundColor: dotColor }]} />
			<Text style={styles.bulletText}>{text}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	section: { gap: SPACING.md },
	headerRow: {
		alignItems: 'center',
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	title: { ...TYPOGRAPHY.title3, color: COLORS.black },
	actionButton: { alignItems: 'center', flexDirection: 'row', gap: SPACING.xxs },
	actionLabel: { ...TYPOGRAPHY.body2, color: COLORS.primary },
	card: {
		backgroundColor: COLORS.background,
		borderColor: COLORS.gray200,
		borderRadius: RADIUS.lg,
		borderWidth: 1,
		gap: SPACING.lg,
		padding: SPACING.xxl,
	},
	innerHeaderRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.md },
	iconBadge: {
		alignItems: 'center',
		borderRadius: RADIUS.round,
		height: 32,
		justifyContent: 'center',
		width: 32,
	},
	innerHeaderTextGroup: { gap: 2 },
	innerTitle: {
		...TYPOGRAPHY.title3,
		color: COLORS.black,
		fontFamily: TYPOGRAPHY.button.fontFamily,
	},
	innerSubtitle: { ...TYPOGRAPHY.small, color: COLORS.gray500 },
	content: {
		gap: SPACING.sm,
	},
	bulletRow: { alignItems: 'center', flexDirection: 'row', gap: SPACING.sm },
	bulletDot: { borderRadius: 3, height: 6, width: 6 },
	bulletText: { ...TYPOGRAPHY.body2, color: COLORS.gray800 },
});