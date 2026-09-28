const cartRepository = require('../repositories/cart.repository');
const productRepository = require('../repositories/product.repository');
const couponRepository = require('../repositories/coupon.repository');
const couponService = require('./coupon.service');
const { summarize } = require('../domain/pricing');
const { presentCoupon } = require('../utils/presenters');
const ApiError = require('../utils/ApiError');

async function getOrCreate(userId) {
  const existing = await cartRepository.findByUser(userId);
  if (existing) return existing;
  return cartRepository.create(userId);
}

async function present(userId) {
  const cart = await getOrCreate(userId);
  await cart.populate({
    path: 'items.product',
    select: 'name slug price mrp unit stock emoji tint isActive',
  });

  const cleaned = [];
  for (const item of cart.items) {
    const product = item.product;
    if (!product || product.isActive === false) continue;
    const quantity = Math.min(item.quantity, product.stock, 20);
    if (quantity < 1) continue;
    cleaned.push({ product, quantity });
  }

  const changed = cleaned.length !== cart.items.length
    || cleaned.some((entry, index) => {
      const original = cart.items[index];
      if (!original) return true;
      const originalId = String(original.product?._id || original.product);
      return originalId !== String(entry.product._id) || original.quantity !== entry.quantity;
    });

  if (changed) {
    cart.items = cleaned.map((entry) => ({ product: entry.product._id, quantity: entry.quantity }));
    cart.markModified('items');
  }

  const items = cleaned.map((entry) => ({
    productId: String(entry.product._id),
    name: entry.product.name,
    slug: entry.product.slug,
    price: entry.product.price,
    mrp: entry.product.mrp,
    unit: entry.product.unit,
    stock: entry.product.stock,
    emoji: entry.product.emoji,
    tint: entry.product.tint,
    quantity: entry.quantity,
    lineTotal: Math.round(entry.product.price * entry.quantity * 100) / 100,
  }));

  const priced = items.map((item) => ({ price: item.price, quantity: item.quantity }));
  let coupon = null;
  let couponMessage = null;
  if (cart.couponCode) {
    const found = await couponRepository.findByCode(cart.couponCode);
    const summaryCheck = summarize(priced, found);
    if (!found || !summaryCheck.couponOk) {
      couponMessage = summaryCheck.couponMessage || 'Coupon is no longer valid';
      cart.couponCode = '';
    } else {
      coupon = found;
    }
  }

  if (changed || (couponMessage && !cart.couponCode)) {
    await cartRepository.save(cart);
  }

  const summary = summarize(priced, coupon);
  return {
    items,
    coupon: coupon ? presentCoupon(coupon, summary.discount) : null,
    couponMessage,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    ...summary,
  };
}

const cartService = {
  get(userId) {
    return present(userId);
  },

  async addItem(userId, productId, quantity) {
    const product = await productRepository.findById(productId);
    if (!product || !product.isActive) throw new ApiError(404, 'Product not found');
    if (product.stock < 1) throw new ApiError(409, `${product.name} is sold out`);

    const cart = await getOrCreate(userId);
    const existing = cart.items.find((item) => String(item.product) === String(productId));
    const nextQty = (existing ? existing.quantity : 0) + quantity;
    if (nextQty > product.stock) {
      throw new ApiError(409, `Only ${product.stock} ${product.unit} of ${product.name} left`);
    }
    if (nextQty > 20) throw new ApiError(409, 'You can add up to 20 of one item');

    if (existing) existing.quantity = nextQty;
    else cart.items.push({ product: productId, quantity });
    await cartRepository.save(cart);
    return present(userId);
  },

  async updateItem(userId, productId, quantity) {
    const cart = await getOrCreate(userId);
    const index = cart.items.findIndex((item) => String(item.product) === String(productId));
    if (index === -1) throw new ApiError(404, 'Item is not in your cart');

    if (quantity < 1) {
      cart.items.splice(index, 1);
    } else {
      const product = await productRepository.findById(productId);
      if (!product || !product.isActive) throw new ApiError(404, 'Product not found');
      if (quantity > product.stock) {
        throw new ApiError(409, `Only ${product.stock} ${product.unit} of ${product.name} left`);
      }
      cart.items[index].quantity = quantity;
    }
    await cartRepository.save(cart);
    return present(userId);
  },

  async removeItem(userId, productId) {
    const cart = await getOrCreate(userId);
    cart.items = cart.items.filter((item) => String(item.product) !== String(productId));
    await cartRepository.save(cart);
    return present(userId);
  },

  async clear(userId) {
    await cartRepository.clear(userId);
    return present(userId);
  },

  async applyCoupon(userId, code) {
    const current = await present(userId);
    if (!current.items.length) throw new ApiError(400, 'Add items before applying a coupon');
    await couponService.assertUsable(code, current.subtotal);
    const cart = await getOrCreate(userId);
    cart.couponCode = code.toUpperCase();
    await cartRepository.save(cart);
    return present(userId);
  },

  async removeCoupon(userId) {
    const cart = await getOrCreate(userId);
    cart.couponCode = '';
    await cartRepository.save(cart);
    return present(userId);
  },
};

module.exports = cartService;
