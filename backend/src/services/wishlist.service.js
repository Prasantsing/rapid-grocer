const wishlistRepository = require('../repositories/wishlist.repository');
const productRepository = require('../repositories/product.repository');
const { presentProduct } = require('../utils/presenters');
const ApiError = require('../utils/ApiError');

async function getOrCreate(userId) {
  const existing = await wishlistRepository.findByUser(userId);
  if (existing) return existing;
  await wishlistRepository.create(userId);
  return wishlistRepository.findByUser(userId);
}

function present(wishlist) {
  const products = (wishlist.products || [])
    .filter((product) => product && product.isActive !== false && product.name)
    .map(presentProduct);
  return {
    products,
    ids: products.map((product) => product.id),
  };
}

const wishlistService = {
  async get(userId) {
    const wishlist = await getOrCreate(userId);
    return present(wishlist);
  },

  async add(userId, productId) {
    const product = await productRepository.findById(productId);
    if (!product || !product.isActive) throw new ApiError(404, 'Product not found');
    const wishlist = await getOrCreate(userId);
    const exists = wishlist.products.some((entry) => String(entry._id || entry) === String(productId));
    if (!exists) {
      if (wishlist.products.length >= 100) throw new ApiError(409, 'Wishlist is full');
      wishlist.products.push(productId);
      await wishlistRepository.save(wishlist);
    }
    const fresh = await wishlistRepository.findByUser(userId);
    return present(fresh);
  },

  async remove(userId, productId) {
    const wishlist = await getOrCreate(userId);
    wishlist.products = wishlist.products.filter((entry) => String(entry._id || entry) !== String(productId));
    await wishlistRepository.save(wishlist);
    const fresh = await wishlistRepository.findByUser(userId);
    return present(fresh);
  },
};

module.exports = wishlistService;
