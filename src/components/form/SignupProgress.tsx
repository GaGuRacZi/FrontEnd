import { StyleSheet, View } from 'react-native';

import { COLORS, RADIUS, SIZE } from '@/src/constants';

type SignupProgressProps = {
  currentStep: number;
  totalSteps?: number;
};

export function SignupProgress({ currentStep, totalSteps = 5 }: SignupProgressProps) {
  const safeStep = Math.min(Math.max(currentStep, 1), totalSteps);

  return (
    <View
      accessibilityLabel={`${totalSteps}단계 중 ${safeStep}단계`}
      accessibilityRole="progressbar"
      style={styles.container}
    >
      {Array.from({ length: totalSteps }, (_, index) => {
        const step = index + 1;
        const isReached = step <= safeStep;

        return (
          <View key={step} style={styles.step}>
            <View style={[styles.dot, isReached && styles.active]} />
            {step < totalSteps ? (
              <View style={[styles.line, step < safeStep && styles.active]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  step: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  dot: {
    backgroundColor: COLORS.gray300,
    borderRadius: RADIUS.round,
    height: SIZE.progressDot,
    width: SIZE.progressDot,
  },
  line: {
    backgroundColor: COLORS.gray300,
    flex: 1,
    height: 4,
  },
  active: {
    backgroundColor: COLORS.primary,
  },
});
