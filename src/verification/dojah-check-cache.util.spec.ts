import {
  buildAmlInputKey,
  canReuseDojahCheck,
  getDojahCheckCacheDays,
  isWithinDojahCheckCacheWindow,
} from './dojah-check-cache.util';

describe('dojah-check-cache.util', () => {
  const originalEnv = process.env.DOJAH_CHECK_CACHE_DAYS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DOJAH_CHECK_CACHE_DAYS;
    } else {
      process.env.DOJAH_CHECK_CACHE_DAYS = originalEnv;
    }
  });

  it('defaults cache window to 7 days', () => {
    delete process.env.DOJAH_CHECK_CACHE_DAYS;
    expect(getDojahCheckCacheDays()).toBe(7);
  });

  it('detects fresh cache window', () => {
    process.env.DOJAH_CHECK_CACHE_DAYS = '7';
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(isWithinDojahCheckCacheWindow(recent)).toBe(true);
  });

  it('reuses nin when cache entry matches and is fresh', () => {
    process.env.DOJAH_CHECK_CACHE_DAYS = '7';
    const lookup = canReuseDojahCheck(
      'nin',
      {
        nin: '12345678901',
        ninVerificationStatus: 'completed',
        ninVerificationResult: { status: 'success' },
        dojahCheckCache: {
          nin: { at: new Date(), nin: '12345678901' },
        },
      },
      false,
    );
    expect(lookup.hit).toBe(true);
  });

  it('does not reuse nin when nin input changed', () => {
    process.env.DOJAH_CHECK_CACHE_DAYS = '7';
    const lookup = canReuseDojahCheck(
      'nin',
      {
        nin: '99999999999',
        ninVerificationStatus: 'completed',
        ninVerificationResult: { status: 'success' },
        dojahCheckCache: {
          nin: { at: new Date(), nin: '12345678901' },
        },
      },
      false,
    );
    expect(lookup.hit).toBe(false);
    expect(lookup.reason).toBe('input_changed');
  });

  it('builds stable aml input keys', () => {
    const a = buildAmlInputKey({
      fullName: 'Jane Doe',
      dateOfBirth: '1990-05-01',
      gender: 'Female',
    });
    const b = buildAmlInputKey({
      fullName: 'jane doe',
      dateOfBirth: new Date('1990-05-01'),
      gender: 'female',
    });
    expect(a).toBe(b);
  });

  it('bypasses cache when forceRefresh is true', () => {
    process.env.DOJAH_CHECK_CACHE_DAYS = '7';
    const lookup = canReuseDojahCheck(
      'aml',
      {
        amlScreeningResult: { entity: {} },
        dojahCheckCache: {
          aml: { at: new Date(), amlInputKey: 'jane|1990-05-01|female' },
        },
      },
      true,
    );
    expect(lookup.hit).toBe(false);
  });
});
