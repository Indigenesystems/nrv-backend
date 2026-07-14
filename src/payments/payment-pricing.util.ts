/** Paystack processing fee (2.1% of base subtotal). Baked into displayed unit price — not shown separately. */
export const PAYSTACK_FEE_RATE = 0.021;

/** VAT (7.5% of base subtotal). */
export const VAT_RATE = 0.075;

export type PackPricingBreakdown = {
  subtotalNaira: number;
  paystackFeeNaira: number;
  vatNaira: number;
  totalNaira: number;
  displayUnitPriceNaira: number;
  displaySubtotalNaira: number;
};

export const calculatePackPricing = (
  quantity: number,
  unitPriceNaira: number,
): PackPricingBreakdown => {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const unit = Math.max(0, Number(unitPriceNaira) || 0);
  const subtotalNaira = qty * unit;
  const paystackFeeNaira = Math.round(subtotalNaira * PAYSTACK_FEE_RATE * 100) / 100;
  const vatNaira = Math.round(subtotalNaira * VAT_RATE * 100) / 100;
  const totalNaira =
    Math.round((subtotalNaira + paystackFeeNaira + vatNaira) * 100) / 100;
  const displayUnitPriceNaira =
    Math.round(unit * (1 + PAYSTACK_FEE_RATE) * 100) / 100;
  const displaySubtotalNaira =
    Math.round((subtotalNaira + paystackFeeNaira) * 100) / 100;

  return {
    subtotalNaira,
    paystackFeeNaira,
    vatNaira,
    totalNaira,
    displayUnitPriceNaira,
    displaySubtotalNaira,
  };
};
