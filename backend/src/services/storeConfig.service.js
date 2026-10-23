const storeConfigRepository = require('../repositories/storeConfig.repository');
const ApiError = require('../utils/ApiError');

/**
 * Calculates great-circle distance between two coordinates in kilometers (Haversine)
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Returns current IST (Indian Standard Time, UTC+5:30) date object
 */
function getIstDate(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000);
}

/**
 * Checks if current IST time falls between openingTime ("07:00") and closingTime ("23:00")
 */
function checkHours(openingTime = '07:00', closingTime = '23:00', now = new Date()) {
  const ist = getIstDate(now);
  const currentMinutes = ist.getHours() * 60 + ist.getMinutes();

  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);

  const openMinutes = (openH || 7) * 60 + (openM || 0);
  const closeMinutes = (closeH || 23) * 60 + (closeM || 0);

  if (closeMinutes >= openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }
  // Crosses midnight
  return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
}

const storeConfigService = {
  async getConfig() {
    const doc = await storeConfigRepository.get();
    const config = doc.toObject ? doc.toObject() : { ...doc };

    const now = new Date();
    const ist = getIstDate(now);
    const inHours = checkHours(config.openingTime, config.closingTime, now);
    const isCurrentlyOpen = Boolean(config.isOpen && inHours);

    const istTimeStr = `${String(ist.getHours()).padStart(2, '0')}:${String(ist.getMinutes()).padStart(2, '0')}`;

    return {
      isOpen: config.isOpen,
      isCurrentlyOpen,
      inOperatingHours: inHours,
      currentTimeIst: istTimeStr,
      closedReason: isCurrentlyOpen
        ? ''
        : (!config.isOpen
          ? (config.closedReason || 'Store is currently paused by store manager.')
          : `Store is closed outside business hours (${config.openingTime} - ${config.closingTime} IST).`),
      openingTime: config.openingTime,
      closingTime: config.closingTime,
      storeLocation: config.storeLocation,
      deliveryRadiusKm: config.deliveryRadiusKm,
      minOrderAmount: config.minOrderAmount,
      freeDeliveryThreshold: config.freeDeliveryThreshold,
      deliveryFee: config.deliveryFee,
      upiVpa: config.upiVpa || '9101516662@ybl',
      payeeName: config.payeeName || 'ZapBasket',
      supportPhone: config.supportPhone,
      supportEmail: config.supportEmail,
      allowCustomerCancellation: config.allowCustomerCancellation !== false,
      cancellationWindowMinutes: config.cancellationWindowMinutes || 3,
      allowDirectRiderContact: config.allowDirectRiderContact !== false,
      nonReturnableNotice: config.nonReturnableNotice || 'Perishable groceries (fresh produce, dairy, bakery) cannot be returned once delivered.',
      updatedAt: config.updatedAt || new Date(),
    };
  },

  async getAdminConfig() {
    const doc = await storeConfigRepository.get();
    const config = doc.toObject ? doc.toObject() : { ...doc };
    const publicData = await this.getConfig();
    return {
      ...publicData,
      webhookSecret: config.webhookSecret || 'zb_webhook_secret_live',
    };
  },

  async updateConfig(user, patch) {
    const allowed = [
      'isOpen',
      'closedReason',
      'openingTime',
      'closingTime',
      'storeLocation',
      'deliveryRadiusKm',
      'minOrderAmount',
      'freeDeliveryThreshold',
      'deliveryFee',
      'upiVpa',
      'payeeName',
      'webhookSecret',
      'supportPhone',
      'supportEmail',
      'allowCustomerCancellation',
      'cancellationWindowMinutes',
      'allowDirectRiderContact',
      'nonReturnableNotice',
    ];

    const cleanPatch = {};
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        cleanPatch[key] = patch[key];
      }
    }

    if (cleanPatch.cancellationWindowMinutes !== undefined) {
      cleanPatch.cancellationWindowMinutes = Math.max(1, Math.min(30, Number(cleanPatch.cancellationWindowMinutes)));
    }

    if (cleanPatch.deliveryRadiusKm !== undefined) {
      cleanPatch.deliveryRadiusKm = Math.max(0.5, Math.min(50, Number(cleanPatch.deliveryRadiusKm)));
    }
    if (cleanPatch.minOrderAmount !== undefined) {
      cleanPatch.minOrderAmount = Math.max(0, Number(cleanPatch.minOrderAmount));
    }
    if (cleanPatch.freeDeliveryThreshold !== undefined) {
      cleanPatch.freeDeliveryThreshold = Math.max(0, Number(cleanPatch.freeDeliveryThreshold));
    }

    await storeConfigRepository.update(cleanPatch);
    return this.getAdminConfig();
  },

  async validateDeliveryEligibility(address, options = { checkHours: true }) {
    const config = await this.getConfig();

    if (options.checkHours && !config.isCurrentlyOpen) {
      throw new ApiError(400, config.closedReason || 'ZapBasket is currently closed. Please check back during operating hours.');
    }

    if (address && address.lat !== undefined && address.lng !== undefined) {
      const storeLoc = config.storeLocation;
      const distance = haversineDistanceKm(storeLoc.lat, storeLoc.lng, Number(address.lat), Number(address.lng));
      const withinRadius = distance <= config.deliveryRadiusKm;

      if (options.checkHours && !withinRadius) {
        throw new ApiError(
          400,
          `Delivery address is ${distance} km away, which exceeds our maximum service radius of ${config.deliveryRadiusKm} km from our Koramangala store hub.`
        );
      }

      return { eligible: withinRadius, distanceKm: distance, maxRadiusKm: config.deliveryRadiusKm };
    }

    return { eligible: true, distanceKm: null, maxRadiusKm: config.deliveryRadiusKm };
  },

  calculateDistance(customerLat, customerLng) {
    const config = storeConfigRepository.getSync();
    const storeLoc = config.storeLocation || { lat: 12.9352, lng: 77.6245 };
    return haversineDistanceKm(storeLoc.lat, storeLoc.lng, customerLat, customerLng);
  },
};

module.exports = storeConfigService;
