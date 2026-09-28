const Wishlist = require('../models/Wishlist');

const wishlistRepository = {
  findByUser(userId) {
    return Wishlist.findOne({ user: userId }).populate({
      path: 'products',
      populate: { path: 'category', select: 'name slug emoji tint' },
    });
  },

  create(userId) {
    return Wishlist.create({ user: userId, products: [] });
  },

  save(wishlist) {
    return wishlist.save();
  },
};

module.exports = wishlistRepository;
