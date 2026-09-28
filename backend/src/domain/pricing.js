const FREE_DELIVERY_ABOVE = 299;
const DELIVERY_FEE = 25;

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function discountPercent(price, mrp) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

function evaluateCoupon(coupon, subtotal, now = new Date()) {
  if (!coupon || !coupon.isActive) {
    return { ok: false, discount: 0, message: 'This coupon is not active' };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    return { ok: false, discount: 0, message: 'This coupon has expired' };
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, discount: 0, message: 'This coupon has reached its usage limit' };
  }
  if (subtotal < coupon.minOrder) {
    const more = round2(coupon.minOrder - subtotal);
    return {
      ok: false,
      discount: 0,
      message: `Add ₹${more} more to use ${coupon.code}`,
    };
  }

  let discount = coupon.type === 'percent'
    ? (subtotal * coupon.value) / 100
    : coupon.value;
  if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  discount = round2(Math.min(Math.max(discount, 0), subtotal));
  return { ok: true, discount, message: null };
}

function summarize(items, coupon, now) {
  const subtotal = round2(items.reduce((sum, item) => sum + (item.price * item.quantity), 0));
  const evaluation = coupon
    ? evaluateCoupon(coupon, subtotal, now)
    : { ok: true, discount: 0, message: null };
  const discount = evaluation.ok ? evaluation.discount : 0;
  const afterDiscount = round2(Math.max(0, subtotal - discount));
  const deliveryFee = afterDiscount === 0 || afterDiscount >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
  const total = round2(afterDiscount + deliveryFee);
  return {
    subtotal,
    discount,
    deliveryFee,
    total,
    freeDeliveryAbove: FREE_DELIVERY_ABOVE,
    deliveryFeeAmount: DELIVERY_FEE,
    couponOk: evaluation.ok,
    couponMessage: evaluation.message,
  };
}

module.exports = {
  FREE_DELIVERY_ABOVE,
  DELIVERY_FEE,
  round2,
  discountPercent,
  evaluateCoupon,
  summarize,
};
