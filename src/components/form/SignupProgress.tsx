import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { COLORS, RADIUS, SIZE } from '@/src/constants';

type SignupProgressProps = {
  currentStep: number;
  totalSteps?: number;
};

export function SignupProgress({ currentStep, totalSteps = 5 }: SignupProgressProps) {
  const safeTotalSteps = Number.isFinite(totalSteps) ? Math.max(1, Math.floor(totalSteps)) : 1;
  const normalizedCurrentStep = Number.isFinite(currentStep) ? Math.floor(currentStep) : 1;
  const safeStep = Math.min(Math.max(normalizedCurrentStep, 1), safeTotalSteps);

  return (
    <View
      accessibilityLabel={`${safeTotalSteps}단계 중 ${safeStep}단계`}
      accessibilityRole="progressbar"
      style={styles.container}
    >
      {Array.from({ length: safeTotalSteps }, (_, index) => {
        const step = index + 1;
        const isCurrent = step === safeStep;

        return (
          <Fragment key={step}>
            <View style={[styles.dot, isCurrent && styles.active]} />
            {step < safeTotalSteps ? <View style={styles.line} /> : null}
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    marginHorizontal: 3,
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
