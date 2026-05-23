import {
  resolveUtilityBillLandlordStatus,
  toDojahUtilityBillImageUrl,
} from './utility-bill.util';

describe('toDojahUtilityBillImageUrl', () => {
  it('converts Cloudinary raw PDF to first-page JPG URL', () => {
    const raw =
      'https://res.cloudinary.com/demo/raw/upload/v123/folder/bill.pdf';
    expect(toDojahUtilityBillImageUrl(raw)).toBe(
      'https://res.cloudinary.com/demo/image/upload/pg_1,f_jpg/v123/folder/bill.jpg',
    );
  });

  it('leaves non-Cloudinary URLs unchanged', () => {
    const url = 'https://example.com/bill.png';
    expect(toDojahUtilityBillImageUrl(url)).toBe(url);
  });
});

describe('resolveUtilityBillLandlordStatus', () => {
  it('returns failed when analysis status is failed', () => {
    expect(
      resolveUtilityBillLandlordStatus('https://x.com/b.pdf', {
        status: 'failed',
        error: 'timeout',
      }),
    ).toBe('failed');
  });

  it('returns verified when Dojah entity has address', () => {
    expect(
      resolveUtilityBillLandlordStatus('https://x.com/b.jpg', {
        entity: { address_info: { street: '1 Main' }, result: { status: 'success' } },
      }),
    ).toBe('verified');
  });
});
