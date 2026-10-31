const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['admin', 'customer', 'delivery'],
      default: 'customer',
      index: true,
    },
    permissionGrants: { type: [String], default: [] },
    permissionRevokes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    cashInHand: { type: Number, default: 0, min: 0 },
    cashSettlements: [
      {
        amount: { type: Number, required: true },
        settledAt: { type: Date, default: Date.now },
        settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        receiptNumber: { type: String, default: '' },
        note: { type: String, default: '' },
      },
    ],
    notificationPreferences: {
      orderUpdates: { type: Boolean, default: true },
      promotionalAlerts: { type: Boolean, default: true },
    },
    fcmTokens: [
      {
        token: { type: String, required: true },
        device: { type: String, default: 'web' },
        createdAt: { type: Date, default: Date.now },
        lastUsedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
