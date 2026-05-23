import { formatPhoneForDojah } from './dojah-env.util';

describe('formatPhoneForDojah', () => {
  it('prepends 234 for local numbers starting with 0', () => {
    expect(formatPhoneForDojah('08031234567')).toBe('2348031234567');
  });

  it('prepends 234 when country code is missing', () => {
    expect(formatPhoneForDojah('8031234567')).toBe('2348031234567');
  });

  it('keeps numbers that already start with 234', () => {
    expect(formatPhoneForDojah('+234 803 123 4567')).toBe('2348031234567');
    expect(formatPhoneForDojah('2348031234567')).toBe('2348031234567');
  });
});
