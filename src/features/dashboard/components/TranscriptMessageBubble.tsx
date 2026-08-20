import type { ImageSourcePropType } from 'react-native';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { PetAvatar } from '@/src/features/pet/components/PetAvatar';
import type { PetEntity } from '@/src/features/pet/types';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { DiagnosisTranscriptMessage } from '../types';

const AVATAR_SIZE = 28;

type TranscriptMessageBubbleProps = {
	message: DiagnosisTranscriptMessage;
	pet: PetEntity | null;
	showAvatar: boolean;
	vetAvatarSource?: ImageSourcePropType;
};

export function TranscriptMessageBubble({
	message,
	pet,
	showAvatar,
	vetAvatarSource,
}: TranscriptMessageBubbleProps) {
	const { width: screenWidth } = useWindowDimensions();
	const bubbleMaxWidth = screenWidth * (240 / 402);
	const isOwner = message.speaker === 'owner';

	return (
		<View style={[styles.row, isOwner && styles.rowReversed]}>
			<View style={styles.avatarSlot}>
				{showAvatar ? (
					isOwner ? (
						<PetAvatar pet={pet} size={AVATAR_SIZE} />
					) : vetAvatarSource ? (
						<Image resizeMode="contain" source={vetAvatarSource} style={styles.vetAvatarImage} />
					) : (
						<View style={styles.vetAvatarFallback} />
					)
				) : null}
			</View>

            <View
				style={[
					styles.bubble,
					isOwner && styles.bubbleOwner,
					showAvatar && (isOwner ? styles.bubbleFirstOwner : styles.bubbleFirstVet),
					{ maxWidth: bubbleMaxWidth },
				]}
			>
				<Text style={styles.bubbleText}>{message.text}</Text>
			</View>
		</View>
	);
}
const styles = StyleSheet.create({
	row: { alignItems: 'flex-start', flexDirection: 'row', gap: SPACING.sm },
	rowReversed: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
	avatarSlot: { width: AVATAR_SIZE },
	vetAvatarImage: { borderRadius: RADIUS.round, height: AVATAR_SIZE, width: AVATAR_SIZE },
	vetAvatarFallback: {
		backgroundColor: COLORS.primarySoft,
		borderRadius: RADIUS.round,
		height: AVATAR_SIZE,
		width: AVATAR_SIZE,
	},
	bubble: {
		backgroundColor: COLORS.background,
		borderRadius: RADIUS.lg,
		paddingHorizontal: SPACING.lg,
		paddingVertical: SPACING.md,
	},
	bubbleOwner: { backgroundColor: COLORS.primarySoft },
	bubbleFirstVet: { borderTopLeftRadius: 3 },
	bubbleFirstOwner: { borderTopRightRadius: 3 },
	bubbleText: { ...TYPOGRAPHY.body2, color: COLORS.black },
});
