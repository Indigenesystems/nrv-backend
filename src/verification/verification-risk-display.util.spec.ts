import {
  alignBreakdownEarnedToTotal,
  applyRiskScoreCaps,
  buildTenantRiskBreakdown,
  computeCategoryScores,
  sumRiskBreakdownEarned,
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
        financialSection: 'not_reviewed',
      },
      'standard',
    );
    const maxTotal = breakdown.reduce((s, c) => s + c.maxPoints, 0);
    expect(maxTotal).toBe(100);
    expect(breakdown.find((c) => c.key === 'rental')).toBeUndefined();
    expect(breakdown.find((c) => c.key === 'financial')).toBeUndefined();
    expect(breakdown).toHaveLength(5);
  });

  it('returns six premium categories (no rental) totalling 100 points', () => {
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
        financialSection: 'not_reviewed',
        creditSummary: 'adequate',
      },
      'premium',
    );
    const maxTotal = breakdown.reduce((s, c) => s + c.maxPoints, 0);
    expect(maxTotal).toBe(100);
    expect(breakdown.find((c) => c.key === 'rental')).toBeUndefined();
    expect(breakdown.find((c) => c.key === 'financial')).toBeDefined();
    expect(breakdown).toHaveLength(6);
    for (const cat of breakdown) {
      expect(Number.isInteger(cat.maxPoints)).toBe(true);
      expect(Number.isInteger(cat.earnedPoints)).toBe(true);
    }
    expect(sumRiskBreakdownEarned(breakdown)).toBeLessThanOrEqual(100);
  });

  it('alignBreakdownEarnedToTotal trims categories when score is capped', () => {
    const breakdown = buildTenantRiskBreakdown(
      {
        email: 'a@b.com',
        address: 'Lagos',
        monthlyIncome: 500000,
        companyName: 'Acme',
        bvn: '12345678901',
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
        guarantorSection: 'approved',
        documentsSection: 'approved',
        financialSection: 'approved',
        creditSummary: 'strong',
      },
      'premium',
    );
    expect(sumRiskBreakdownEarned(breakdown)).toBeGreaterThan(72);
    const capped = alignBreakdownEarnedToTotal(breakdown, 72);
    expect(sumRiskBreakdownEarned(capped)).toBe(72);
  });

  it('alignBreakdownEarnedToTotal matches NIN-failed cap so subtotals equal final score', () => {
    const report = {
      nin: 'failed',
      aml: 'low_risk',
      phone: 'valid',
      idDocument: 'failed',
      utilityBill: 'verified',
      personalSection: 'approved',
      employmentSection: 'approved',
      guarantorSection: 'not_reviewed',
      documentsSection: 'approved',
      financialSection: 'not_reviewed',
    };
    const doc = {
      fullName: 'Wrong Name',
      dateOfBirth: '1996-05-09',
      email: 'a@b.com',
      address: 'Lagos',
      monthlyIncome: 500000,
      companyName: 'Acme',
      ninVerificationResult: { namesMatch: false, dobMatch: true, status: 'success' },
    };
    const breakdown = buildTenantRiskBreakdown(doc, report, 'standard');
    const rawSum = sumRiskBreakdownEarned(breakdown);
    expect(rawSum).toBeGreaterThan(35);
    const cappedScore = applyRiskScoreCaps(rawSum, report);
    expect(cappedScore).toBe(35);
    const aligned = alignBreakdownEarnedToTotal(breakdown, cappedScore);
    expect(sumRiskBreakdownEarned(aligned)).toBe(35);
  });

  it('alignBreakdownEarnedToTotal is a no-op when already aligned', () => {
    const breakdown = buildTenantRiskBreakdown(
      { email: 'a@b.com', address: 'Lagos' },
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
        financialSection: 'not_reviewed',
      },
      'standard',
    );
    const total = sumRiskBreakdownEarned(breakdown);
    expect(alignBreakdownEarnedToTotal(breakdown, total)).toEqual(breakdown);
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
        financialSection: 'not_reviewed',
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
        financialSection: 'not_reviewed',
      },
      'standard',
    );
    for (const cat of breakdown) {
      expect(cat.earnedPoints).toBeLessThanOrEqual(cat.maxPoints);
    }
    expect(scores.identityScore).toBe(0);
  });

  it('name mismatch awards partial identity score when DOB matches', () => {
    const report = {
      nin: 'failed',
      aml: 'low_risk',
      phone: 'valid',
      idDocument: 'failed',
      utilityBill: 'verified',
      personalSection: 'approved',
      employmentSection: 'approved',
      guarantorSection: 'not_reviewed',
      documentsSection: 'approved',
      financialSection: 'not_reviewed',
    };
    const doc = {
      fullName: 'Wrong Name',
      dateOfBirth: '1996-05-09',
      ninVerificationResult: { namesMatch: false, dobMatch: true, status: 'success' },
    };
    const scores = computeCategoryScores(doc, report, 'standard');
    expect(scores.identityScore).toBe(0.15);
    const breakdown = buildTenantRiskBreakdown(doc, report, 'standard');
    const identity = breakdown.find((c) => c.key === 'identity');
    expect(identity?.earnedPoints).toBe(5);
  });

  it('name mismatch with no DOB match scores zero identity', () => {
    const report = {
      nin: 'failed',
      aml: 'low_risk',
      phone: 'valid',
      idDocument: 'failed',
      utilityBill: 'verified',
      personalSection: 'not_reviewed',
      employmentSection: 'approved',
      guarantorSection: 'not_reviewed',
      documentsSection: 'approved',
      financialSection: 'not_reviewed',
    };
    const doc = {
      fullName: 'Wrong Name',
      ninVerificationResult: { namesMatch: false, dobMatch: false, status: 'success' },
    };
    expect(computeCategoryScores(doc, report, 'standard').identityScore).toBe(0);
  });

  it('name mismatch awards manual review partial when age also fails', () => {
    const report = {
      nin: 'failed',
      aml: 'low_risk',
      phone: 'valid',
      idDocument: 'failed',
      utilityBill: 'verified',
      personalSection: 'approved',
      employmentSection: 'approved',
      guarantorSection: 'not_reviewed',
      documentsSection: 'approved',
      financialSection: 'not_reviewed',
    };
    const doc = {
      fullName: 'Wrong Name',
      ninVerificationResult: { namesMatch: false, dobMatch: false, status: 'success' },
    };
    expect(computeCategoryScores(doc, report, 'standard').identityScore).toBe(0.15);
  });

  it('blends bureau score with salary proof manual review when bank statement exists (premium)', () => {
    const baseReport = {
      nin: 'verified',
      aml: 'low_risk',
      phone: 'valid',
      idDocument: 'verified',
      utilityBill: 'verified',
      personalSection: 'approved',
      employmentSection: 'approved',
      guarantorSection: 'approved',
      documentsSection: 'approved',
      creditSummary: 'strong',
    };
    const doc = {
      monthlyIncome: 500000,
      bvn: '12345678901',
      bankStatementUrl: 'https://example.com/statement.pdf',
      creditFinancialSnapshot: {
        status: 'ok' as const,
        affordabilityBand: 'strong' as const,
        totalOutstandingNgn: 100_000,
        totalActiveLoans: 1,
        debtToIncomeRatio: 0.2,
        landlordCreditOutcome: 'adequate' as const,
      },
    };

    const approved = computeCategoryScores(
      doc,
      { ...baseReport, financialSection: 'approved' },
      'premium',
    );
    const notReviewed = computeCategoryScores(
      doc,
      { ...baseReport, financialSection: 'not_reviewed' },
      'premium',
    );
    const rejected = computeCategoryScores(
      doc,
      { ...baseReport, financialSection: 'rejected' },
      'premium',
    );

    expect(approved.financialScore).toBeGreaterThan(notReviewed.financialScore);
    expect(notReviewed.financialScore).toBe(rejected.financialScore);
  });
});
