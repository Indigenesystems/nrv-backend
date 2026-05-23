import {
  extractIdDocumentIdentity,
  getIdDocumentNinAlignment,
  resolveIdDocumentLandlordStatus,
} from './id-document.util';

const ninResult = {
  entity: {
    first_name: 'CHIDI',
    middle_name: 'EMEKA',
    last_name: 'OKAFOR',
    date_of_birth: '03-05-1996',
  },
};

describe('extractIdDocumentIdentity', () => {
  it('reads name parts from text_data', () => {
    const id = extractIdDocumentIdentity({
      entity: {
        text_data: [
          { field_key: 'surname', value: 'Okafor' },
          { field_key: 'first_name', value: 'Chidi' },
        ],
      },
    });
    expect(id.lastName).toBe('Okafor');
    expect(id.firstName).toBe('Chidi');
    expect(id.fullName).toContain('Chidi');
  });
});

describe('getIdDocumentNinAlignment', () => {
  const url = 'https://res.cloudinary.com/demo/id.jpg';

  it('is authentic when Dojah VALID and ID name matches NIN', () => {
    const alignment = getIdDocumentNinAlignment(
      {
        entity: {
          status: { overall_status: 1, reason: 'VALID' },
          text_data: [
            { field_key: 'first_name', value: 'Chidi' },
            { field_key: 'surname', value: 'Okafor' },
          ],
        },
      },
      ninResult,
    );
    expect(alignment.technicallyValid).toBe(true);
    expect(alignment.namesMatch).toBe(true);
    expect(alignment.authentic).toBe(true);
  });

  it('fails authenticity when Dojah VALID but name differs from NIN', () => {
    const alignment = getIdDocumentNinAlignment(
      {
        entity: {
          status: { overall_status: 1, reason: 'VALID' },
          text_data: [
            { field_key: 'first_name', value: 'Jane' },
            { field_key: 'surname', value: 'Smith' },
          ],
        },
      },
      ninResult,
    );
    expect(alignment.technicallyValid).toBe(true);
    expect(alignment.namesMatch).toBe(false);
    expect(alignment.authentic).toBe(false);
    expect(alignment.mismatchReason).toBe('name_mismatch_with_nin');
  });

  it('fails when Dojah INVALID even if names would match', () => {
    const alignment = getIdDocumentNinAlignment(
      {
        entity: {
          status: { overall_status: 0, reason: 'INVALID' },
          text_data: [
            { field_key: 'first_name', value: 'Chidi' },
            { field_key: 'surname', value: 'Okafor' },
          ],
        },
      },
      ninResult,
    );
    expect(alignment.authentic).toBe(false);
    expect(alignment.mismatchReason).toBe('document_not_valid');
  });
});

describe('resolveIdDocumentLandlordStatus', () => {
  const url = 'https://res.cloudinary.com/demo/id.jpg';

  it('returns not_provided without upload URL', () => {
    expect(resolveIdDocumentLandlordStatus(null, { entity: {} })).toBe('not_provided');
  });

  it('returns not_run when analysis missing', () => {
    expect(resolveIdDocumentLandlordStatus(url, null)).toBe('not_run');
  });

  it('returns failed on transport/API error shape', () => {
    expect(
      resolveIdDocumentLandlordStatus(url, {
        status: 'failed',
        error: 'This service is not enabled for this account',
      }),
    ).toBe('failed');
  });

  it('returns verified only when VALID and NIN name match', () => {
    expect(
      resolveIdDocumentLandlordStatus(
        url,
        {
          entity: {
            status: { overall_status: 1, reason: 'VALID' },
            text_data: [
              { field_key: 'first_name', value: 'Chidi' },
              { field_key: 'surname', value: 'Okafor' },
            ],
          },
        },
        ninResult,
      ),
    ).toBe('verified');
  });

  it('returns failed when VALID but no NIN to compare', () => {
    expect(
      resolveIdDocumentLandlordStatus(url, {
        entity: {
          status: { overall_status: 1, reason: 'VALID' },
          text_data: [{ field_key: 'first_name', value: 'Chidi' }],
        },
      }),
    ).toBe('failed');
  });
});
