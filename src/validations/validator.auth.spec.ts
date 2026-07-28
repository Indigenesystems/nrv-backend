import {
  createUserSchema,
  resetPasswordSchema,
  requestPasswordResetSchema,
  personFirstNameRule,
  personLastNameRule,
} from './validator';

describe('Auth validation (NRV registration & reset)', () => {
  const validRegistrationPayload = {
    firstName: 'Mary-Jane',
    lastName: 'O Connor',
    email: 'tenant@example.com',
    password: 'Password1!',
    phoneNumber: '08031234567',
    accountType: 'tenant',
  };

  describe('NRV 008 / NRV 033 — registration schema', () => {
    it('accepts valid landlord/tenant registration payload', () => {
      const landlordPayload = {
        ...validRegistrationPayload,
        accountType: 'landlord',
        nin: '12345678901',
      };
      const { error } = createUserSchema.validate(landlordPayload);
      expect(error).toBeUndefined();
    });
  });

  describe('NRV 011 / NRV 036 — first name characters', () => {
    it('rejects invalid first name characters', () => {
      const { error } = personFirstNameRule.validate('John@Paul');
      expect(error?.message).toContain(
        'First name can only contain letters, spaces, and hyphens',
      );
    });

    it('rejects invalid first name in registration payload', () => {
      const { error } = createUserSchema.validate({
        ...validRegistrationPayload,
        firstName: 'John123',
      });
      expect(error?.message).toContain(
        'First name can only contain letters, spaces, and hyphens',
      );
    });
  });

  describe('NRV 012 / NRV 037 — last name characters', () => {
    it('rejects invalid last name characters', () => {
      const { error } = personLastNameRule.validate('Smith#');
      expect(error?.message).toContain(
        'Last name can only contain letters, spaces, and hyphens',
      );
    });

    it('rejects invalid last name in registration payload', () => {
      const { error } = createUserSchema.validate({
        ...validRegistrationPayload,
        lastName: 'Smith!',
      });
      expect(error?.message).toContain(
        'Last name can only contain letters, spaces, and hyphens',
      );
    });
  });

  describe('NRV 092 / NRV 150 — password reset request email', () => {
    it('rejects invalid email format', () => {
      const { error } = requestPasswordResetSchema.validate({
        email: 'not-an-email',
      });
      expect(error?.message).toContain('Invalid email address');
    });

    it('rejects missing email', () => {
      const { error } = requestPasswordResetSchema.validate({});
      expect(error?.message).toContain('Email is required');
    });
  });

  describe('NRV 101 / NRV 159 — password policy on reset', () => {
    it('rejects passwords that do not meet policy', () => {
      const { error } = resetPasswordSchema.validate({
        token: '123456',
        newPassword: 'weak',
      });
      expect(error?.message).toMatch(/at least 8 characters|uppercase|special/i);
    });

    it('accepts passwords that meet policy', () => {
      const { error } = resetPasswordSchema.validate({
        token: '123456',
        newPassword: 'Password1!',
      });
      expect(error).toBeUndefined();
    });
  });

  describe('NRV 106 / NRV 164 — reset code format', () => {
    it('rejects missing reset code', () => {
      const { error } = resetPasswordSchema.validate({
        newPassword: 'Password1!',
      });
      expect(error?.message).toContain('Reset code is required');
    });

    it('rejects reset codes that are not 6 digits', () => {
      const { error } = resetPasswordSchema.validate({
        token: '12345',
        newPassword: 'Password1!',
      });
      expect(error?.message).toContain('Reset code must be 6 digits');
    });
  });
});
