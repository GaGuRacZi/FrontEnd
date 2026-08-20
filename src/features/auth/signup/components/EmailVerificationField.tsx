import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/common/AppButton';
import { AppIcon } from '@/src/components/common/AppIcon';
import { AppInput } from '@/src/components/form/AppInput';
import { COLORS, RADIUS, SIZE, SPACING, TYPOGRAPHY } from '@/src/constants';
import { getEmailError } from '@/src/features/auth/authValidation';
import { useTerms } from '@/src/features/auth/terms';

import {
  confirmSignupEmailVerification,
  getEmailVerificationExpiresAt,
  isEmailVerificationExpired,
  normalizeSignupEmail,
  requestSignupEmailVerification,
  resolveEmailVerificationError,
} from '../services/emailVerificationService';
import { useSignup } from '../SignupContext';

export function EmailVerificationField() {
  const { signupIdentityFinalized } = useTerms();
  const {
    data,
    emailVerification,
    updateEmailVerification,
    updateField,
    updateFields,
  } = useSignup();
  const actionInFlight = useRef(false);
  const normalizedEmail = normalizeSignupEmail(data.email);
  const isVerified = data.emailVerified;
  const hasPendingVerification =
    emailVerification.requestedEmail === normalizedEmail && !isVerified;
  const emailError =
    emailVerification.error?.field === 'email'
      ? emailVerification.error.message
      : undefined;
  const verificationCodeError =
    emailVerification.error?.field === 'code'
      ? emailVerification.error.message
      : undefined;
  const helperText = isVerified
    ? '이메일 인증이 완료되었어요.'
    : hasPendingVerification
      ? '인증번호를 전송했어요. 5분 안에 입력해주세요.'
      : undefined;

  const clearVerificationData = () => {
    updateFields({
      emailVerificationCode: '',
      emailVerified: false,
    });
  };

  const resetVerification = () => {
    clearVerificationData();
    updateEmailVerification({
      error: null,
      expiresAt: null,
      requestedEmail: null,
      status: 'idle',
    });
  };

  const handleEmailChange = (value: string) => {
    if (signupIdentityFinalized) return;

    updateField('email', value);
    resetVerification();
  };

  const handleRequest = async () => {
    if (signupIdentityFinalized) return;

    const validationError = getEmailError(data.email);

    if (validationError) {
      updateEmailVerification({
        error: { field: 'email', message: validationError },
      });
      return;
    }

    if (actionInFlight.current) return;

    actionInFlight.current = true;

    updateEmailVerification({ error: null, status: 'requesting' });

    try {
      const requestedEmail = await requestSignupEmailVerification(normalizedEmail);

      updateFields({
        email: requestedEmail,
        emailVerificationCode: '',
        emailVerified: false,
      });
      updateEmailVerification({
        error: null,
        expiresAt: getEmailVerificationExpiresAt(),
        requestedEmail,
        status: 'idle',
      });
    } catch (error) {
      const verificationError = resolveEmailVerificationError(error, 'request');

      if (verificationError.alreadyRegistered) {
        resetVerification();
      }

      updateEmailVerification({
        error: { field: 'email', message: verificationError.message },
        status: 'idle',
      });
    } finally {
      actionInFlight.current = false;
    }
  };

  const handleConfirm = async () => {
    if (signupIdentityFinalized) return;

    if (!hasPendingVerification) {
      updateEmailVerification({
        error: { field: 'code', message: '인증번호를 다시 요청해주세요.' },
      });
      return;
    }

    if (isEmailVerificationExpired(emailVerification.expiresAt)) {
      clearVerificationData();
      updateEmailVerification({
        error: {
          field: 'email',
          message: '인증번호가 만료됐어요. 다시 인증해주세요.',
        },
        expiresAt: null,
        requestedEmail: null,
        status: 'idle',
      });
      return;
    }

    if (data.emailVerificationCode.length !== 6) {
      updateEmailVerification({
        error: { field: 'code', message: '인증번호 6자리를 입력해주세요.' },
      });
      return;
    }

    if (actionInFlight.current) return;

    actionInFlight.current = true;

    updateEmailVerification({ error: null, status: 'confirming' });

    try {
      const response = await confirmSignupEmailVerification(
        normalizedEmail,
        data.emailVerificationCode,
      );

      if (response !== normalizedEmail) {
        throw new Error('Email verification response does not match.');
      }

      updateFields({
        emailVerificationCode: '',
        emailVerified: true,
      });
      updateEmailVerification({
        error: null,
        expiresAt: null,
        requestedEmail: normalizedEmail,
        status: 'idle',
      });
    } catch (error) {
      const verificationError = resolveEmailVerificationError(error, 'confirm');

      if (verificationError.alreadyRegistered) {
        resetVerification();
      }

      updateEmailVerification({
        error: {
          field: verificationError.alreadyRegistered ? 'email' : 'code',
          message: verificationError.message,
        },
        status: 'idle',
      });
    } finally {
      actionInFlight.current = false;
    }
  };

  const actionTitle = (() => {
    if (isVerified) return '인증 완료';
    if (emailVerification.status === 'requesting') return '전송 중';
    if (hasPendingVerification) return '재전송';

    return '인증하기';
  })();

  return (
    <>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>이메일</Text>
        <View style={styles.fieldRow}>
          <AppInput
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            containerStyle={styles.flexField}
            editable={!signupIdentityFinalized && emailVerification.status === 'idle'}
            error={emailError}
            helperText={helperText}
            keyboardType="email-address"
            leftElement={<AppIcon color={COLORS.gray500} name="mail-outline" size={22} />}
            onBlur={() => {
              const formatError = getEmailError(data.email);

              if (formatError) {
                updateEmailVerification({
                  error: { field: 'email', message: formatError },
                });
              }
            }}
            onChangeText={handleEmailChange}
            placeholder="example@email.com"
            textContentType="emailAddress"
            value={data.email}
          />
          <AppButton
            disabled={
              Boolean(getEmailError(data.email)) ||
              isVerified ||
              signupIdentityFinalized ||
              emailVerification.status !== 'idle'
            }
            fullWidth={false}
            loading={emailVerification.status === 'requesting'}
            onPress={() => void handleRequest()}
            size="medium"
            style={[styles.action, isVerified && styles.completedAction]}
            title={actionTitle}
            variant={isVerified ? 'success' : 'primary'}
          />
        </View>
      </View>

      {hasPendingVerification ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>이메일 인증번호</Text>
          <View style={styles.fieldRow}>
            <AppInput
              autoComplete="one-time-code"
              containerStyle={styles.flexField}
              editable={!signupIdentityFinalized && emailVerification.status === 'idle'}
              error={verificationCodeError}
              importantForAutofill="yes"
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => {
                updateField(
                  'emailVerificationCode',
                  value.replace(/\D/g, '').slice(0, 6),
                );
                updateEmailVerification({ error: null });
              }}
              placeholder="인증번호 6자리"
              textContentType="oneTimeCode"
              value={data.emailVerificationCode}
            />
            <AppButton
              disabled={
                data.emailVerificationCode.length !== 6 ||
                signupIdentityFinalized ||
                emailVerification.status !== 'idle'
              }
              fullWidth={false}
              loading={emailVerification.status === 'confirming'}
              onPress={() => void handleConfirm()}
              size="medium"
              style={styles.action}
              title={emailVerification.status === 'confirming' ? '확인 중' : '확인'}
            />
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.black,
  },
  fieldRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  flexField: {
    flex: 1,
    width: undefined,
  },
  action: {
    borderRadius: RADIUS.md,
    height: SIZE.inputHeight,
    paddingHorizontal: SPACING.md,
    width: 116,
  },
  completedAction: {
    opacity: 1,
  },
});
