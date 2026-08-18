import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet } from 'react-native';

const CAT_FRAMES = [
	require('@/assets/images/dashboard/recording/cat-01.png'),
	require('@/assets/images/dashboard/recording/cat-02.png'),
	require('@/assets/images/dashboard/recording/cat-03.png'),
	require('@/assets/images/dashboard/recording/cat-04.png'),
	require('@/assets/images/dashboard/recording/cat-05.png'),
	require('@/assets/images/dashboard/recording/cat-06.png'),
	require('@/assets/images/dashboard/recording/cat-07.png'),
	require('@/assets/images/dashboard/recording/cat-08.png'),
	require('@/assets/images/dashboard/recording/cat-09.png'),
];

const DOG_FRAMES = [
	require('@/assets/images/dashboard/recording/dog-01.png'),
	require('@/assets/images/dashboard/recording/dog-02.png'),
	require('@/assets/images/dashboard/recording/dog-03.png'),
	require('@/assets/images/dashboard/recording/dog-04.png'),
	require('@/assets/images/dashboard/recording/dog-05.png'),
	require('@/assets/images/dashboard/recording/dog-06.png'),
	require('@/assets/images/dashboard/recording/dog-07.png'),
	require('@/assets/images/dashboard/recording/dog-08.png'),
	require('@/assets/images/dashboard/recording/dog-09.png'),
];

const FRAME_INTERVAL_MS = 600;

type RecordingPetAnimationProps = {
	isPaused: boolean;
	petType: 'cat' | 'dog';
};

export function RecordingPetAnimation({ isPaused, petType }: RecordingPetAnimationProps) {
	const [frameIndex, setFrameIndex] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const frames = petType === 'cat' ? CAT_FRAMES : DOG_FRAMES;

	useEffect(() => {
		if (isPaused) return undefined;

		intervalRef.current = setInterval(() => {
			setFrameIndex((current) => (current + 1) % frames.length);
		}, FRAME_INTERVAL_MS);

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [isPaused, frames.length]);

	return (
		<Image resizeMode="contain" source={frames[frameIndex]} style={styles.image} />
	);
}

const styles = StyleSheet.create({
	image: { height: 108, width: 160 },
});