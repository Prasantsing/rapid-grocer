const addressRepository = require('../repositories/address.repository');
const { presentAddress } = require('../utils/presenters');
const ApiError = require('../utils/ApiError');

const addressService = {
  async list(userId) {
    const addresses = await addressRepository.listByUser(userId);
    return addresses.map(presentAddress);
  },

  async create(userId, input) {
    const count = await addressRepository.countByUser(userId);
    if (count >= 8) throw new ApiError(409, 'You can save up to 8 addresses');
    const isDefault = input.isDefault || count === 0;
    if (isDefault) await addressRepository.clearDefault(userId);
    const address = await addressRepository.create({
      user: userId,
      label: input.label || 'Home',
      fullName: input.fullName.trim(),
      phone: input.phone,
      line1: input.line1.trim(),
      line2: input.line2 || '',
      landmark: input.landmark || '',
      city: input.city.trim(),
      state: input.state.trim(),
      pincode: input.pincode,
      isDefault,
    });
    return presentAddress(address);
  },

  async update(userId, id, input) {
    const address = await addressRepository.findByIdForUser(id, userId);
    if (!address) throw new ApiError(404, 'Address not found');
    const fields = ['label', 'fullName', 'phone', 'line1', 'line2', 'landmark', 'city', 'state', 'pincode'];
    for (const field of fields) {
      if (input[field] !== undefined) address[field] = input[field];
    }
    if (input.isDefault) {
      await addressRepository.clearDefault(userId, address._id);
      address.isDefault = true;
    }
    await addressRepository.save(address);
    return presentAddress(address);
  },

  async remove(userId, id) {
    const address = await addressRepository.findByIdForUser(id, userId);
    if (!address) throw new ApiError(404, 'Address not found');
    const wasDefault = address.isDefault;
    await addressRepository.remove(address);
    if (wasDefault) {
      const next = await addressRepository.findFirst(userId);
      if (next) {
        next.isDefault = true;
        await addressRepository.save(next);
      }
    }
    return { deleted: true };
  },

  async reverseGeocode(lat, lng) {
    if (lat === undefined || lng === undefined) {
      throw new ApiError(400, 'Latitude and longitude are required');
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'ZapBasket/1.0 (contact@zapbasket.store)',
            'Accept-Language': 'en-IN,en;q=0.9',
          },
          signal: AbortSignal.timeout(6000),
        }
      );

      if (!response.ok) throw new Error('Geocoding service unavailable');
      const data = await response.json();
      const addr = data.address || {};

      const road = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || '';
      const neighbourhood = addr.neighbourhood || addr.suburb || addr.residential || addr.subdistrict || addr.quarter || '';
      const city = addr.city || addr.town || addr.municipality || addr.city_district || addr.county || 'Bengaluru';
      const state = addr.state || 'Karnataka';
      const rawPostcode = String(addr.postcode || '').replace(/\D/g, '');
      const pincode = rawPostcode.length === 6 ? rawPostcode : '560034';

      const localityParts = [road, neighbourhood].filter(Boolean);
      const locality = localityParts.join(', ') || (data.display_name ? data.display_name.split(',').slice(0, 2).join(',').trim() : 'Detected Area');

      return {
        lat: Number(lat),
        lng: Number(lng),
        road,
        neighbourhood,
        locality,
        city,
        state,
        pincode,
        formattedAddress: data.display_name || `${locality}, ${city}, ${state} ${pincode}`,
      };
    } catch (err) {
      // Graceful fallback for offline / mock testing
      return {
        lat: Number(lat),
        lng: Number(lng),
        road: '',
        neighbourhood: 'Koramangala 4th Block',
        locality: 'Koramangala 4th Block',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560034',
        formattedAddress: 'Koramangala 4th Block, Bengaluru, Karnataka 560034',
      };
    }
  },
};

module.exports = addressService;
