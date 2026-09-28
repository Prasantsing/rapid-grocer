const Product = require('../models/Product');

const SORTS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name: { name: 1 },
};

const productRepository = {
  create(data) {
    return Product.create(data);
  },

  findById(id) {
    return Product.findById(id).populate('category', 'name slug emoji tint');
  },

  findBySlug(slug) {
    return Product.findOne({ slug }).populate('category', 'name slug emoji tint isActive');
  },

  async search({ filter, sort = 'newest', page = 1, limit = 24 }) {
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
  },

  countByCategory(categoryId) {
    return Product.countDocuments({ category: categoryId });
  },

  save(product) {
    return product.save();
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
};

module.exports = productRepository;
