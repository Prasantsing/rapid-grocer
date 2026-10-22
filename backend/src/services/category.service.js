const categoryRepository = require('../repositories/category.repository');
const productRepository = require('../repositories/product.repository');
const { presentCategory } = require('../utils/presenters');
const { slugify } = require('../utils/slug');
const ApiError = require('../utils/ApiError');

async function uniqueSlug(name, currentId) {
  const base = slugify(name) || 'category';
  let slug = base;
  let n = 2;
  while (true) {
    const existing = await categoryRepository.findBySlug(slug);
    if (!existing || String(existing._id) === String(currentId)) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

const categoryService = {
  async list({ includeInactive = false } = {}) {
    const categories = await categoryRepository.list({ includeInactive });
    return categories.map(presentCategory);
  },

  async getBySlug(slug) {
    const category = await categoryRepository.findBySlug(slug);
    if (!category || !category.isActive) throw new ApiError(404, 'Category not found');
    return presentCategory(category);
  },

  async create(input) {
    const category = await categoryRepository.create({
      name: input.name.trim(),
      slug: await uniqueSlug(input.name),
      description: input.description || '',
      emoji: input.emoji || '🛒',
      tint: input.tint || '#E7F6EF',
      isActive: input.isActive !== false,
      sortOrder: input.sortOrder ?? 0,
    });
    return presentCategory(category);
  },

  async update(id, input) {
    const category = await categoryRepository.findById(id);
    if (!category) throw new ApiError(404, 'Category not found');
    if (input.name && input.name !== category.name) {
      category.name = input.name.trim();
      category.slug = await uniqueSlug(category.name, category._id);
    }
    if (input.description !== undefined) category.description = input.description;
    if (input.emoji) category.emoji = input.emoji;
    if (input.tint) category.tint = input.tint;
    if (input.isActive !== undefined) category.isActive = input.isActive;
    if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
    await categoryRepository.save(category);
    return presentCategory(category);
  },

  async archive(id) {
    const category = await categoryRepository.findById(id);
    if (!category) throw new ApiError(404, 'Category not found');
    const productCount = await productRepository.countByCategory(category._id);
    if (productCount > 0 && category.isActive) {
      category.isActive = false;
      await categoryRepository.save(category);
      return { archived: true, category: presentCategory(category) };
    }
    category.isActive = false;
    await categoryRepository.save(category);
    return { archived: true, category: presentCategory(category) };
  },
};

module.exports = categoryService;
