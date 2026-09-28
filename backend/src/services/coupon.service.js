const couponRepository = require('../repositories/coupon.repository');
const { presentCoupon } = require('../utils/presenters');
const { evaluateCoupon } = require('../domain/pricing');
const ApiError = require('../utils/ApiError');

function assertCouponShape(input) {
  if (input.type === 'percent' && input.value > 100) {
    throw new ApiError(422, 'Percent coupons cannot exceed 100');
  }
}

const couponService = {
  async listAdmin() {
    const coupons = await couponRepository.list();
    return coupons.map((coupon) => presentCoupon(coupon));
  },

  async listActive() {
    const coupons = await couponRepository.listActive();
    return coupons
      .filter((coupon) => coupon.usageLimit === 0 || coupon.usedCount < coupon.usageLimit)
      .map((coupon) => ({
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        minOrder: coupon.minOrder,
        maxDiscount: coupon.maxDiscount,
        expiresAt: coupon.expiresAt,
      }));
  },

  async create(input) {
    assertCouponShape(input);
    const existing = await couponRepository.findByCode(input.code);
    if (existing) throw new ApiError(409, 'A coupon with this code already exists');
    const coupon = await couponRepository.create({
      code: input.code,
      description: input.description || '',
      type: input.type,
      value: input.value,
      minOrder: input.minOrder || 0,
      maxDiscount: input.maxDiscount || 0,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      usageLimit: input.usageLimit || 0,
      isActive: input.isActive !== false,
    });
    return presentCoupon(coupon);
  },

  async update(id, input) {
    const coupon = await couponRepository.findById(id);
    if (!coupon) throw new ApiError(404, 'Coupon not found');
    if (input.code && input.code.toUpperCase() !== coupon.code) {
      const existing = await couponRepository.findByCode(input.code);
      if (existing) throw new ApiError(409, 'A coupon with this code already exists');
      coupon.code = input.code;
    }
    if (input.description !== undefined) coupon.description = input.description;
    if (input.type) coupon.type = input.type;
    if (input.value !== undefined) coupon.value = input.value;
    if (input.minOrder !== undefined) coupon.minOrder = input.minOrder;
    if (input.maxDiscount !== undefined) coupon.maxDiscount = input.maxDiscount;
    if (input.expiresAt !== undefined) coupon.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (input.usageLimit !== undefined) coupon.usageLimit = input.usageLimit;
    if (input.isActive !== undefined) coupon.isActive = input.isActive;
    assertCouponShape(coupon);
    await couponRepository.save(coupon);
    return presentCoupon(coupon);
  },

  async archive(id) {
    const coupon = await couponRepository.findById(id);
    if (!coupon) throw new ApiError(404, 'Coupon not found');
    coupon.isActive = false;
    await couponRepository.save(coupon);
    return presentCoupon(coupon);
  },

  async assertUsable(code, subtotal) {
    const coupon = await couponRepository.findByCode(code);
    const evaluation = evaluateCoupon(coupon, subtotal);
    if (!evaluation.ok) throw new ApiError(400, evaluation.message);
    return { coupon, discount: evaluation.discount };
  },

  async consume(code, subtotal) {
    const { coupon, discount } = await this.assertUsable(code, subtotal);
    const updated = await couponRepository.consume(coupon);
    if (!updated) throw new ApiError(409, 'This coupon has reached its usage limit');
    return { coupon: updated, discount };
  },
};

module.exports = couponService;
