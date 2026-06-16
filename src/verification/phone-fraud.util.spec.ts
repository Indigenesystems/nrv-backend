import {
  extractPhoneFraudEntity,
  isPhoneFraudEntityValid,
  resolvePhoneLandlordStatus,
} from './phone-fraud.util';

describe('phone-fraud.util', () => {
  it('reads valid from production-style entity', () => {
    const entity = extractPhoneFraudEntity({
      entity: {
        phone: '2348101234567',
        valid: true,
        active: true,
      },
    });
    expect(entity?.phone).toBe('2348101234567');
    expect(isPhoneFraudEntityValid(entity)).toBe(true);
    expect(resolvePhoneLandlordStatus('08010123456', { entity: { valid: true, phone: '2348101234567' } })).toBe(
      'valid',
    );
  });

  it('unwraps sandbox entity.report and treats formatted phone as valid', () => {
    const payload = {
      entity: {
        report: {
          phone: '2348031234567',
          information: {},
          format: {},
        },
      },
    };
    const entity = extractPhoneFraudEntity(payload);
    expect(entity?.phone).toBe('2348031234567');
    expect(isPhoneFraudEntityValid(entity)).toBe(true);
    expect(resolvePhoneLandlordStatus('08031234567', payload)).toBe('valid');
  });

  it('marks explicit valid false as invalid', () => {
    expect(
      resolvePhoneLandlordStatus('08031234567', {
        entity: { valid: false, phone: '2348031234567' },
      }),
    ).toBe('invalid');
  });

  it('coerces string valid values', () => {
    expect(isPhoneFraudEntityValid({ valid: 'true', phone: '2348031234567' })).toBe(true);
  });
});
