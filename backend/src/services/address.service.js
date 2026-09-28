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
};

module.exports = addressService;
