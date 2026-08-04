import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {AppIcon} from '@/src/components/common/AppIcon';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/constants';
import { PetAvatar } from '@/src/features/pet/components/PetAvatar';

import type { PetEntity } from '@/src/features/pet/types';
import type { PetSummary } from '../types';

type PetProfuleCardProps = {
    onPressAddDiagnosis: () => void;
    onPressDetail: () => void;
    pet: PetSummary;
    rawPet: PetEntity;

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
    pillIcon: { height: 14, width: 14 },
    pressed: { opacity: 0.7},
    pillText: { ...TYPOGRAPHY.checkboxLabel, color: COLORS.black },
    dot: { backgroundColor: COLORS.green, borderRadius: 4, height: 8, width: 8 },
});

export function PetProfileCard( { onPressAddDiagnosis, onPressDetail, pet, rawPet } : PetProfuleCardProps ) {
    return (
        <View style = {styles.container}>
            <PetAvatar pet={rawPet} size={64} />

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
                        <Image
                            accessibilityIgnoresInvertColors
                            source={require('../../../../assets/images/decorations/paw-tiny.png')}
                            style={styles.pillIcon}
                        />
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

