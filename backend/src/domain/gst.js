/**
 * Indian GST Tax Calculation & Grocery HSN Slab Rules
 *
 * Slabs for Retail Grocery:
 * - 0% (Nil-Rated): Fresh Vegetables, Fresh Fruits, Fresh Milk, Plain Curd, Eggs, Unbranded Cereals
 * - 5%: Grains, Pulses, Atta, Edible Oils, Tea, Coffee, Spices, Sugar, Salt
 * - 12%: Packaged Snack Foods, Biscuits, Fruit Juices, Cheese, Butter, Processed Sauces
 *
 * Intra-State Supply (Karnataka): Split 50% CGST + 50% SGST
 */

const GST_SLABS = {
  NIL: {
    rate: 0,
    label: '0% Nil-Rated (Fresh Produce & Dairy)',
    cgstRate: 0,
    sgstRate: 0,
    defaultHsn: '0709',
  },
  FIVE: {
    rate: 5,
    label: '5% Essential Groceries & Staples',
    cgstRate: 2.5,
    sgstRate: 2.5,
    defaultHsn: '1006',
  },
  TWELVE: {
    rate: 12,
    label: '12% Packaged Foods & Beverages',
    cgstRate: 6.0,
    sgstRate: 6.0,
    defaultHsn: '2106',
  },
};

/**
 * Determine GST slab and HSN code based on category slug/name and product name
 */
function getProductGstConfig(productOrCategory) {
  const catSlug = String(productOrCategory?.category?.slug || productOrCategory?.category || productOrCategory?.slug || '').toLowerCase();
  const name = String(productOrCategory?.name || '').toLowerCase();

  // 0% Nil-Rated Fresh Grocery
  if (
    catSlug.includes('fruit') ||
    catSlug.includes('vegetable') ||
    catSlug.includes('fresh') ||
    name.includes('banana') ||
    name.includes('apple') ||
    name.includes('mango') ||
    name.includes('tomato') ||
    name.includes('onion') ||
    name.includes('potato') ||
    name.includes('milk') ||
    name.includes('egg')
  ) {
    let hsn = '0709'; // Vegetables
    if (name.includes('fruit') || name.includes('banana') || name.includes('mango') || name.includes('apple')) hsn = '0803';
    else if (name.includes('milk')) hsn = '0401';
    else if (name.includes('egg')) hsn = '0407';
    return { ...GST_SLABS.NIL, hsn, code: '0%' };
  }

  // 12% Packaged snacks, beverages, chocolates, confectionery
  if (
    catSlug.includes('snack') ||
    catSlug.includes('beverage') ||
    catSlug.includes('sweet') ||
    catSlug.includes('biscuit') ||
    catSlug.includes('chocolate') ||
    name.includes('chips') ||
    name.includes('juice') ||
    name.includes('biscuit') ||
    name.includes('cookie') ||
    name.includes('cola') ||
    name.includes('drink') ||
    name.includes('cheese') ||
    name.includes('butter')
  ) {
    let hsn = '2106'; // Food preparations
    if (name.includes('juice') || name.includes('drink') || name.includes('cola')) hsn = '2202';
    else if (name.includes('biscuit') || name.includes('cookie')) hsn = '1905';
    else if (name.includes('cheese') || name.includes('butter')) hsn = '0406';
    return { ...GST_SLABS.TWELVE, hsn, code: '12%' };
  }

  // 5% Default for all other grocery staples (atta, rice, oil, pulses, spices, tea)
  let hsn = '1006'; // Rice/cereals
  if (name.includes('oil')) hsn = '1515';
  else if (name.includes('tea') || name.includes('coffee')) hsn = '0902';
  else if (name.includes('spice') || name.includes('masala')) hsn = '0910';
  else if (name.includes('dal') || name.includes('pulse')) hsn = '0713';
  return { ...GST_SLABS.FIVE, hsn, code: '5%' };
}

/**
 * Calculates GST breakdown for a gross total (inclusive of GST)
 * Taxable Value = Gross / (1 + rate / 100)
 * Total Tax = Gross - Taxable Value
 * CGST = Total Tax / 2
 * SGST = Total Tax / 2
 */
function calculateGstFromGross(grossAmount, gstRatePercent) {
  const gross = Number(grossAmount) || 0;
  const rate = Number(gstRatePercent) || 0;

  if (rate === 0 || gross === 0) {
    return {
      grossAmount: Math.round(gross * 100) / 100,
      taxableAmount: Math.round(gross * 100) / 100,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      totalGst: 0,
    };
  }

  const taxableAmount = Math.round((gross / (1 + rate / 100)) * 100) / 100;
  const totalGst = Math.round((gross - taxableAmount) * 100) / 100;
  const halfTax = Math.round((totalGst / 2) * 100) / 100;
  const cgstAmount = halfTax;
  const sgstAmount = Math.round((totalGst - cgstAmount) * 100) / 100;

  return {
    grossAmount: Math.round(gross * 100) / 100,
    taxableAmount,
    cgstRate: rate / 2,
    cgstAmount,
    sgstRate: rate / 2,
    sgstAmount,
    totalGst,
  };
}

module.exports = {
  GST_SLABS,
  getProductGstConfig,
  calculateGstFromGross,
};
