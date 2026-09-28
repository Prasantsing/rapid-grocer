const Coupon = require('../models/Coupon');

const couponRepository = {
  findByCode(code) {
    return Coupon.findOne({ code: String(code || '').toUpperCase() });
  },

  findById(id) {
    return Coupon.findById(id);
  },

  create(data) {
    return Coupon.create(data);
  },

  list() {
    return Coupon.find().sort({ createdAt: -1 });
  },

  listActive(now = new Date()) {
    return Coupon.find({
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).sort({ minOrder: 1 });
  },

  save(coupon) {
    return coupon.save();
  },

  consume(coupon) {
    const filter = { _id: coupon._id, isActive: true };
    if (coupon.usageLimit > 0) filter.usedCount = { $lt: coupon.usageLimit };
    return Coupon.findOneAndUpdate(filter, { $inc: { usedCount: 1 } }, { new: true });
  },

  release(code) {
    return Coupon.updateOne(
      { code: String(code).toUpperCase(), usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } }
    );
  },
};

module.exports = couponRepository;
