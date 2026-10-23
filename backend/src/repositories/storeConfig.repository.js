const StoreConfig = require('../models/StoreConfig');

const DEFAULT_CONFIG = {
  key: 'default',
  isOpen: true,
  closedReason: 'ZapBasket is currently closed. We will be back open shortly!',
  openingTime: '06:00',
  closingTime: '23:59',
  storeLocation: {
    lat: 12.9352,
    lng: 77.6245,
    address: 'Koramangala 4th Block, Bengaluru, Karnataka 560034',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560034',
  },
  deliveryRadiusKm: 8.0,
  minOrderAmount: 99,
  freeDeliveryThreshold: 299,
  deliveryFee: 25,
  upiVpa: '9101516662@ybl',
  payeeName: 'ZapBasket',
  webhookSecret: 'zb_webhook_secret_live',
  supportPhone: '+91 9101516662',
  supportEmail: 'support@zapbasket.store',
};

let inMemoryConfig = { ...DEFAULT_CONFIG };

const storeConfigRepository = {
  async get() {
    try {
      let config = await StoreConfig.findOne({ key: 'default' });
      if (!config) {
        config = await StoreConfig.create(DEFAULT_CONFIG);
      }
      inMemoryConfig = config.toObject ? config.toObject() : config;
      return config;
    } catch {
      return inMemoryConfig;
    }
  },

  async update(patch) {
    try {
      const config = await StoreConfig.findOneAndUpdate(
        { key: 'default' },
        { $set: patch },
        { new: true, upsert: true, runValidators: true }
      );
      inMemoryConfig = config.toObject ? config.toObject() : config;
      return config;
    } catch {
      inMemoryConfig = { ...inMemoryConfig, ...patch };
      return inMemoryConfig;
    }
  },

  getSync() {
    return inMemoryConfig;
  },
};

module.exports = storeConfigRepository;
