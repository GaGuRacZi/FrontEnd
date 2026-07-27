import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {AppIcon} from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';

import type { PetSummary } from '../types';

type PetProfuleCardProps = {
    onPressAddDiagnosis: () => void;
    onPressDetail: () => void;
    pet: PetSummary;
};

const styles = StyleSheet.create({
    container: { alignItems: 'center', flexDirection: 'row', gap: 16 },
    photo: { borderRadius: RADIUS.round, height: 86, width: 86 },
    photoPlaceholder: {
        alignItems: 'center',
        backgroundColor: COLORS.cream,
        borderRadius: RADIUS.round,
        height: 86,
        justifyContent: 'center',
        width: 86,
    },
    placeholderLogo: { height: 36, width: 36, resizeMode: 'contain' },
    info: { flex: 1, gap: 0 },
    name: { ...TYPOGRAPHY.title2, color: COLORS.black },
    meta: { ...TYPOGRAPHY.body2, color: COLORS.gray600 },
    actionRow: {flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
    pill: {
        alignItems: 'center',
        borderColor: COLORS.gray300,
        borderRadius: RADIUS.round,
        borderWidth: 1,
        flexDirection: 'row',
        gap: SPACING.sm,
        height: 32,
        paddingHorizontal: SPACING.lg
    },
    pressed: { opacity: 0.7},
    pillText: { ...TYPOGRAPHY.small, color: COLORS.black },
    dot: { backgroundColor: COLORS.primary, borderRadius: 4, height: 8, width: 8 },
});

export function PetProfileCard( { onPressAddDiagnosis, onPressDetail, pet } : PetProfuleCardProps ) {
    return (
        <View style = {styles.container}>
            {pet.photoUrl ? (
                <Image source={ {uri: pet.photoUrl} } style={styles.photo} />
            ) : (
                <View style={styles.photoPlaceholder}>
                    <Image
                        accessibilityIgnoresInvertColors
                        source={require('../../../../assets/images/paw-logo.png')}
                        style={styles.placeholderLogo}
                    />
                </View>
            )}

            <View style={styles.info}>
                <Text style={styles.name}>{pet.name}</Text>
                <Text style={styles.meta}>
                    {pet.breedLabel} · {pet.ageLabel}
                </Text>

                <View style={styles.actionRow}>
                    <Pressable
                    accessibilityLabel="반려동물 상세페이지"
                    accessibilityRole='button'
                    onPress={onPressDetail}
                    style={ ({pressed}) => [styles.pill, pressed&&styles.pressed]}
                    >
                        <AppIcon color={COLORS.gray600} name='paw-outline' size={14} />
                        <Text style={styles.pillText}>상세페이지</Text>
                    </Pressable>

                    <Pressable
                    accessibilityLabel='진료 추가하기'
                    accessibilityRole='button'
                    onPress={onPressAddDiagnosis}
                    style={ ({pressed}) => [styles.pill, pressed&&styles.pressed] }
                    >
                        <View style={styles.dot} />
                        <Text style={styles.pillText}>진료 추가하기</Text>
                    </Pressable>
                </View>
            </View>
        
        
        </View>

        
    );
}

