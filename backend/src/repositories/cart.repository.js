const Cart = require('../models/Cart');

const cartRepository = {
  findByUser(userId) {
    return Cart.findOne({ user: userId });
  },

  create(userId) {
    return Cart.create({ user: userId, items: [], couponCode: '' });
  },

  save(cart) {
    return cart.save();
  },

  async clear(userId) {
    await Cart.updateOne({ user: userId }, { $set: { items: [], couponCode: '' } });
  },
};

module.exports = cartRepository;
