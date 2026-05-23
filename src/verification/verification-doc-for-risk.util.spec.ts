import {
  buildDocForRiskFromResponse,
  coerceMonthlyIncome,
  hasGuarantorContact,
  hasGuarantorIdentity,
  resolveEmployerName,
} from './verification-doc-for-risk.util';
import { buildTenantRiskBreakdown } from './verification-risk-display.util';

describe('verification-doc-for-risk.util', () => {
  it('coerces currency string income', () => {
    expect(coerceMonthlyIncome('₦500,000')).toBe(500000);
  });

  it('resolves alternate employer field names', () => {
    expect(resolveEmployerName({ nameOfCompany: 'Acme Ltd' })).toBe('Acme Ltd');
  });

  it('detects guarantor identity and contact', () => {
    expect(
      hasGuarantorIdentity({ guarantorFirstName: 'Ada', guarantorLastName: 'Okafor' }),
    ).toBe(true);
    expect(hasGuarantorContact({ guarantorPhone: '08012345678' })).toBe(true);
  });

  it('risk breakdown shows declared when income submitted after run-all', () => {
    const doc = buildDocForRiskFromResponse({
      monthlyIncome: '750000',
      companyName: 'Tech Co',
      guarantorFirstName: 'John',
      guarantorLastName: 'Doe',
      guarantorPhone: '2348012345678',
    });
    const breakdown = buildTenantRiskBreakdown(
      doc,
      {
        nin: 'verified',
        aml: 'low_risk',
        phone: 'valid',
        idDocument: 'failed',
        utilityBill: 'verified',
        personalSection: 'not_reviewed',
        employmentSection: 'not_reviewed',
        guarantorSection: 'not_reviewed',
        documentsSection: 'not_reviewed',
      },
      'standard',
    );
    const employment = breakdown.find((c) => c.key === 'employment');
    const incomeCheck = employment?.checks.find((c) => c.name === 'Monthly income');
    const employerCheck = employment?.checks.find((c) => c.name === 'Employer');
    expect(incomeCheck?.outcome).toBe('declared');
    expect(employerCheck?.outcome).toBe('provided');

    const guarantor = breakdown.find((c) => c.key === 'guarantor');
    expect(
      guarantor?.checks.find((c) => c.name === 'Guarantor identity')?.outcome,
    ).toBe('provided');
    expect(
      guarantor?.checks.find((c) => c.name === 'Guarantor contact')?.outcome,
    ).toBe('provided');
  });
});
