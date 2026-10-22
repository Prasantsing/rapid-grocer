const Category = require('../models/Category');
const inMemoryStore = require('../services/inMemoryStore');

const categoryRepository = {
  create(data) {
    return Category.create(data);
  },

  async findById(id) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.listCategories().find((c) => String(c._id) === String(id)) || null;
    }
    try {
      return await Category.findById(id);
    } catch (_) {
      return inMemoryStore.listCategories().find((c) => String(c._id) === String(id)) || null;
    }
  },

  async findBySlug(slug) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.findCategoryBySlug(slug);
    }
    try {
      return await Category.findOne({ slug });
    } catch (_) {
      return inMemoryStore.findCategoryBySlug(slug);
    }
  },

  async list({ includeInactive = false } = {}) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.listCategories();
    }
    try {
      const filter = includeInactive ? {} : { isActive: true };
      return await Category.find(filter).sort({ sortOrder: 1, name: 1 });
    } catch (_) {
      return inMemoryStore.listCategories();
    }
  },

  save(category) {
    return category.save ? category.save() : category;
  },
};

module.exports = categoryRepository;
