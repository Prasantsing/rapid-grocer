const Category = require('../models/Category');

const categoryRepository = {
  create(data) {
    return Category.create(data);
  },

  findById(id) {
    return Category.findById(id);
  },

  findBySlug(slug) {
    return Category.findOne({ slug });
  },

  list({ includeInactive = false } = {}) {
    const filter = includeInactive ? {} : { isActive: true };
    return Category.find(filter).sort({ sortOrder: 1, name: 1 });
  },

  save(category) {
    return category.save();
  },
};

module.exports = categoryRepository;
