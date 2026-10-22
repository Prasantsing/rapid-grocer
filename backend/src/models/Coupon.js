const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '', maxlength: 200 },
    type: { type: String, enum: ['percent', 'flat', 'free_delivery'], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: 0, min: 0 },
    firstOrderOnly: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.set('toJSON', { virtuals: true, versionKey: false });

module.exports = mongoose.model('Coupon', couponSchema);
