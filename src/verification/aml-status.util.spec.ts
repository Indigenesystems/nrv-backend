import { resolveAmlLandlordStatus } from './aml-status.util';

describe('resolveAmlLandlordStatus', () => {
  it('returns not_run when screening was never run', () => {
    expect(resolveAmlLandlordStatus(null)).toBe('not_run');
  });

  it('maps explicit Dojah risk levels', () => {
    expect(
      resolveAmlLandlordStatus({
        entity: { risk_level: 'high', match_found: false, results: [] },
      }),
    ).toBe('high_risk');
  });

  it('does not default unknown payloads with matches to low_risk', () => {
    expect(
      resolveAmlLandlordStatus({
        entity: {
          match_found: true,
          results: [{ score: 0.91, source_type: 'sanctions' }],
        },
      }),
    ).toBe('high_risk');
  });

  it('returns low_risk when screening ran with no matches and no risk level', () => {
    expect(
      resolveAmlLandlordStatus({
        entity: { match_found: false, results: [] },
      }),
    ).toBe('low_risk');
  });
});
