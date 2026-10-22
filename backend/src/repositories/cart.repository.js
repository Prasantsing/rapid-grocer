const Cart = require('../models/Cart');
const inMemoryStore = require('../services/inMemoryStore');

const cartRepository = {
  async findByUser(userId) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.getCart(userId);
    }
    try {
      return await Cart.findOne({ user: userId });
    } catch (_) {
      return inMemoryStore.getCart(userId);
    }
  },

  async create(userId) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.getCart(userId);
    }
    try {
      return await Cart.create({ user: userId, items: [], couponCode: '' });
    } catch (_) {
      return inMemoryStore.getCart(userId);
    }
  },

  save(cart) {
    return cart.save ? cart.save() : cart;
  },

  async clear(userId) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.clearCart(userId);
    }
    try {
      await Cart.updateOne({ user: userId }, { $set: { items: [], couponCode: '' } });
    } catch (_) {
      inMemoryStore.clearCart(userId);
    }
  },

  async setItems(userId, items, couponCode = '') {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.setCartItems(userId, items, couponCode);
    }
    try {
      await Cart.updateOne(
        { user: userId },
        { $set: { items, couponCode } },
        { upsert: true }
      );
    } catch (_) {
      inMemoryStore.setCartItems(userId, items, couponCode);
    }
  },
};

module.exports = cartRepository;
