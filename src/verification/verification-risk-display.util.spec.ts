import {
  buildTenantRiskBreakdown,
  computeCategoryScores,
} from './verification-risk-display.util';

describe('buildTenantRiskBreakdown', () => {
  it('returns five standard categories (no rental, no financial) totalling 100 points', () => {
    const breakdown = buildTenantRiskBreakdown(
      {
        email: 'a@b.com',
        address: 'Lagos',
        monthlyIncome: 500000,
        companyName: 'Acme',
      },
      {
        nin: 'verified',
        aml: 'low_risk',
        phone: 'valid',
        idDocument: 'verified',
        utilityBill: 'verified',
        personalSection: 'approved',
        employmentSection: 'approved',
        guarantorSection: 'not_reviewed',
        documentsSection: 'approved',
      },
      'standard',
    );
    const maxTotal = breakdown.reduce((s, c) => s + c.maxPoints, 0);
    expect(maxTotal).toBe(100);
    expect(breakdown.find((c) => c.key === 'rental')).toBeUndefined();
    expect(breakdown.find((c) => c.key === 'financial')).toBeUndefined();
    expect(breakdown).toHaveLength(5);
  });

  it('returns seven categories totalling 100 max points for premium', () => {
    const breakdown = buildTenantRiskBreakdown(
      {
        email: 'a@b.com',
        address: 'Lagos',
        monthlyIncome: 500000,
        companyName: 'Acme',
        ninVerificationResult: { namesMatch: true, dobMatch: true, status: 'success' },
      },
      {
        nin: 'verified',
        aml: 'low_risk',
        phone: 'valid',
        idDocument: 'verified',
        utilityBill: 'verified',
        personalSection: 'approved',
        employmentSection: 'approved',
        guarantorSection: 'not_reviewed',
        documentsSection: 'approved',
        creditSummary: 'adequate',
      },
      'premium',
    );
    const maxTotal = breakdown.reduce((s, c) => s + c.maxPoints, 0);
    expect(maxTotal).toBe(100);
    expect(breakdown.find((c) => c.key === 'financial')).toBeDefined();
  });

  it('earned points stay within max per category', () => {
    const scores = computeCategoryScores(
      {},
      {
        nin: 'failed',
        aml: 'not_run',
        phone: 'invalid',
        idDocument: 'failed',
        utilityBill: 'failed',
        personalSection: 'not_reviewed',
        employmentSection: 'not_reviewed',
        guarantorSection: 'not_reviewed',
        documentsSection: 'not_reviewed',
      },
      'standard',
    );
    const breakdown = buildTenantRiskBreakdown(
      {},
      {
        nin: 'failed',
        aml: 'not_run',
        phone: 'invalid',
        idDocument: 'failed',
        utilityBill: 'failed',
        personalSection: 'not_reviewed',
        employmentSection: 'not_reviewed',
        guarantorSection: 'not_reviewed',
        documentsSection: 'not_reviewed',
      },
      'standard',
    );
    for (const cat of breakdown) {
      expect(cat.earnedPoints).toBeLessThanOrEqual(cat.maxPoints);
    }
    expect(scores.identityScore).toBe(0);
  });
});
