import {
  checkNinNameAlignment,
  getNinAlignmentForDoc,
  normalizeApplicantDobForCompare,
  normalizeDojahDobForCompare,
  normalizePersonName,
  resolveDojahNinEntity,
} from './nin-name-match.util';

describe('normalizePersonName', () => {
  it('lowercases for case-insensitive match', () => {
    expect(normalizePersonName('Babajide Ojo')).toBe('babajide ojo');
    expect(normalizePersonName('BABAJIDE')).toBe('babajide');
  });
});

describe('checkNinNameAlignment', () => {
  it('matches when Dojah names are uppercase and applicant mixed case', () => {
    const { namesMatch } = checkNinNameAlignment(
      { first_name: 'BABAJIDE', middle_name: 'OLAYINKA', last_name: 'OJO' },
      'Babajide Ojo',
    );
    expect(namesMatch).toBe(true);
  });

  it('matches full name with middle on NIN only', () => {
    const { namesMatch } = checkNinNameAlignment(
      { first_name: 'BABAJIDE', middle_name: 'OLAYINKA', last_name: 'OJO' },
      'Babajide Olayinka Ojo',
    );
    expect(namesMatch).toBe(true);
  });
});

describe('resolveDojahNinEntity', () => {
  it('reads entity from nested data', () => {
    const entity = resolveDojahNinEntity({
      data: { first_name: 'JOHN', last_name: 'DOE' },
    });
    expect(entity?.first_name).toBe('JOHN');
  });
});

describe('normalizeDojahDobForCompare', () => {
  it('parses Dojah DD-MM-YYYY (day-month-year)', () => {
    expect(normalizeDojahDobForCompare('03-05-1996')).toBe('1996-05-03');
  });
});

describe('normalizeApplicantDobForCompare', () => {
  it('uses local calendar date for Date (no UTC day shift)', () => {
    const dob = new Date(1996, 4, 3);
    expect(normalizeApplicantDobForCompare(dob)).toBe('1996-05-03');
  });

  it('parses ISO applicant DOB', () => {
    expect(normalizeApplicantDobForCompare('1996-05-03')).toBe('1996-05-03');
  });
});

describe('getNinAlignmentForDoc', () => {
  it('recomputes match from stored NIN entity', () => {
    const alignment = getNinAlignmentForDoc({
      fullName: 'Babajide Ojo',
      dateOfBirth: new Date(1996, 4, 3),
      ninVerificationResult: {
        namesMatch: false,
        dobMatch: false,
        entity: {
          first_name: 'BABAJIDE',
          last_name: 'OJO',
          date_of_birth: '03-05-1996',
        },
      },
    });
    expect(alignment.namesMatch).toBe(true);
    expect(alignment.dobMatch).toBe(true);
  });
});
