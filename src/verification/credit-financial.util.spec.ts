import {
  creditFinancialScoreComponent,
  parseCreditFinancialSnapshot,
  resolveLandlordCreditOutcome,
} from './credit-financial.util';

describe('parseCreditFinancialSnapshot', () => {
  it('returns not_run when summary is missing', () => {
    const snap = parseCreditFinancialSnapshot(null, 500_000);
    expect(snap.status).toBe('not_run');
    expect(snap.landlordCreditOutcome).toBe('not_run');
  });

  it('returns error when summary has error field', () => {
    const snap = parseCreditFinancialSnapshot({ error: 'failed' }, 500_000);
    expect(snap.status).toBe('error');
    expect(snap.landlordCreditOutcome).toBe('error');
  });

  it('computes high_risk when debt to income is high', () => {
    const snap = parseCreditFinancialSnapshot(
      {
        entity: {
          score: {
            bureauStatus: { crc: 'hit' },
            totalOutstanding: [{ source: 'crc', value: 600_000 }],
            totalNoOfActiveLoans: [{ source: 'crc', value: 4 }],
          },
        },
      },
      500_000,
    );
    expect(snap.status).toBe('ok');
    expect(snap.affordabilityBand).toBe('high_risk');
    expect(snap.debtToIncomeRatio).toBe(1.2);
  });

  it('returns strong for low outstanding and income', () => {
    const snap = parseCreditFinancialSnapshot(
      {
        entity: {
          score: {
            bureauStatus: { crc: 'found' },
            totalOutstanding: [{ source: 'crc', value: 100_000 }],
            totalNoOfActiveLoans: [{ source: 'crc', value: 1 }],
          },
        },
      },
      800_000,
    );
    expect(snap.affordabilityBand).toBe('strong');
  });
});

describe('creditFinancialScoreComponent', () => {
  it('is neutral for standard tier', () => {
    expect(creditFinancialScoreComponent(null, 'standard', false)).toBe(0.7);
  });

  it('penalizes high_risk on premium', () => {
    const snap = parseCreditFinancialSnapshot(
      {
        entity: {
          score: {
            bureauStatus: { x: 'ok' },
            totalOutstanding: [{ value: 2_000_000 }],
          },
        },
      },
      400_000,
    );
    expect(creditFinancialScoreComponent(snap, 'premium', true)).toBeLessThan(0.2);
  });
});

describe('resolveLandlordCreditOutcome', () => {
  it('returns not_provided without bvn', () => {
    expect(resolveLandlordCreditOutcome(null, false)).toBe('not_provided');
  });
});
