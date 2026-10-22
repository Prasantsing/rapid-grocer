const Product = require('../models/Product');
const inMemoryStore = require('../services/inMemoryStore');

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name: { name: 1 },
};

const productRepository = {
  async create(data) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.createProduct(data);
    }
    try {
      return await Product.create(data);
    } catch (_) {
      return inMemoryStore.createProduct(data);
    }
  },

  async findById(id) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.findProductById(id);
    }
    try {
      return await Product.findById(id).populate('category', 'name slug emoji tint');
    } catch (_) {
      return inMemoryStore.findProductById(id);
    }
  },

  async findBySlug(slug) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.findProductBySlug(slug);
    }
    try {
      return await Product.findOne({ slug }).populate('category', 'name slug emoji tint isActive');
    } catch (_) {
      return inMemoryStore.findProductBySlug(slug);
    }
  },

  async search({ filter, sort = 'newest', page = 1, limit = 24 }) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.searchProducts({ filter, sort, page, limit });
    }
    try {
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        Product.find(filter)
          .populate('category', 'name slug emoji tint')
          .sort(SORTS[sort] || SORTS.newest)
          .skip(skip)
          .limit(limit),
        Product.countDocuments(filter),
      ]);
      return { items, total };
    } catch (_) {
      return inMemoryStore.searchProducts({ filter, sort, page, limit });
    }
  },

  countByCategory(categoryId) {
    return Product.countDocuments({ category: categoryId });
  },

  async save(product) {
    if (!inMemoryStore.isDbConnected() || typeof product.save !== 'function') {
      return inMemoryStore.saveProduct(product);
    }
    try {
      return await product.save();
    } catch (_) {
      return inMemoryStore.saveProduct(product);
    }
  },

  decrementStock(productId, quantity) {
    return Product.findOneAndUpdate(
      { _id: productId, isActive: true, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { new: true }
    );
  },

  restoreStock(productId, quantity) {
    return Product.updateOne({ _id: productId }, { $inc: { stock: quantity } });
  },

  async restock(productId, quantity) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.restockProduct(productId, quantity);
    }
    try {
      return await Product.findByIdAndUpdate(
        productId,
        { $inc: { stock: Number(quantity) } },
        { new: true }
      ).populate('category', 'name slug emoji tint');
    } catch (_) {
      return inMemoryStore.restockProduct(productId, quantity);
    }
  },
};

module.exports = productRepository;
