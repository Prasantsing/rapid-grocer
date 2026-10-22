const FREE_DELIVERY_ABOVE = 299;
const DELIVERY_FEE = 25;

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function discountPercent(price, mrp) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

function evaluateCoupon(coupon, subtotal, now = new Date(), orderCount = 0) {
  if (!coupon || !coupon.isActive) {
    return { ok: false, discount: 0, isFreeDelivery: false, message: 'This coupon is not active' };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    return { ok: false, discount: 0, isFreeDelivery: false, message: 'This coupon has expired' };
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, discount: 0, isFreeDelivery: false, message: 'This coupon has reached its usage limit' };
  }
  if (coupon.firstOrderOnly && orderCount > 0) {
    return { ok: false, discount: 0, isFreeDelivery: false, message: 'This coupon is valid only on your first order' };
  }
  if (subtotal < coupon.minOrder) {
    const more = round2(coupon.minOrder - subtotal);
    return {
      ok: false,
      discount: 0,
      isFreeDelivery: false,
      message: `Add ₹${more} more to use ${coupon.code}`,
    };
  }

  let discount = 0;
  const isFreeDelivery = coupon.type === 'free_delivery';
  if (coupon.type === 'percent') {
    discount = (subtotal * coupon.value) / 100;
  } else if (coupon.type === 'flat') {
    discount = coupon.value;
  } else if (isFreeDelivery) {
    discount = 0;
  }
  if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
  discount = round2(Math.min(Math.max(discount, 0), subtotal));
  return { ok: true, discount, isFreeDelivery, message: null };
}

function summarize(items, coupon, now, orderCount = 0) {
  const subtotal = round2(items.reduce((sum, item) => sum + (item.price * item.quantity), 0));
  const evaluation = coupon
    ? evaluateCoupon(coupon, subtotal, now, orderCount)
    : { ok: true, discount: 0, isFreeDelivery: false, message: null };
  const discount = evaluation.ok ? evaluation.discount : 0;
  const afterDiscount = round2(Math.max(0, subtotal - discount));
  const isFreeDelivery = Boolean(evaluation.ok && (evaluation.isFreeDelivery || coupon?.type === 'free_delivery'));
  const deliveryFee = afterDiscount === 0 || afterDiscount >= FREE_DELIVERY_ABOVE || isFreeDelivery ? 0 : DELIVERY_FEE;
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
    isFreeDelivery,
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
