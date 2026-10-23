const mongoose = require('mongoose');

const storeConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    closedReason: {
      type: String,
      default: 'ZapBasket is currently closed. We will be back open shortly!',
    },
    openingTime: {
      type: String,
      default: '06:00', // 24-hr format HH:mm
    },
    closingTime: {
      type: String,
      default: '23:59', // 24-hr format HH:mm
    },
    storeLocation: {
      lat: { type: Number, default: 12.9352 },
      lng: { type: Number, default: 77.6245 },
      address: { type: String, default: 'Koramangala 4th Block, Bengaluru, Karnataka 560034' },
      city: { type: String, default: 'Bengaluru' },
      state: { type: String, default: 'Karnataka' },
      pincode: { type: String, default: '560034' },
    },
    deliveryRadiusKm: {
      type: Number,
      default: 8.0,
      min: 0.5,
      max: 50.0,
    },
    minOrderAmount: {
      type: Number,
      default: 99,
      min: 0,
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 299,
      min: 0,
    },
    deliveryFee: {
      type: Number,
      default: 25,
      min: 0,
    },
    upiVpa: {
      type: String,
      default: '9101516662@ybl',
      trim: true,
    },
    payeeName: {
      type: String,
      default: 'ZapBasket',
      trim: true,
    },
    webhookSecret: {
      type: String,
      default: 'zb_webhook_secret_live',
    },
    supportPhone: {
      type: String,
      default: '+91 9101516662',
    },
    supportEmail: {
      type: String,
      default: 'support@zapbasket.store',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('StoreConfig', storeConfigSchema);
