const productRepository = require('../repositories/product.repository');
const categoryRepository = require('../repositories/category.repository');
const { presentProduct } = require('../utils/presenters');
const { pageMeta } = require('../utils/pagination');
const { slugify, escapeRegex } = require('../utils/slug');
const ApiError = require('../utils/ApiError');

async function uniqueSlug(name, currentId) {
  const base = slugify(name) || 'product';
  let slug = base;
  let n = 2;
  while (true) {
    const existing = await productRepository.findBySlug(slug);
    if (!existing || String(existing._id) === String(currentId)) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

function assertPrice(price, mrp) {
  if (mrp < price) throw new ApiError(422, 'MRP cannot be lower than the selling price');
}

async function requireCategory(categoryId) {
  const category = await categoryRepository.findById(categoryId);
  if (!category) throw new ApiError(404, 'Category not found');
  return category;
}

const productService = {
  async list(query, { includeInactive = false } = {}) {
    const page = query.page || 1;
    const limit = query.limit || 24;
    const filter = {};
    if (!includeInactive || query.includeInactive !== 'true') filter.isActive = true;

    if (query.category) {
      const category = await categoryRepository.findBySlug(query.category);
      if (!category) {
        return { items: [], meta: pageMeta(page, limit, 0) };
      }
      filter.category = category._id;
    }

    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: pattern }, { brand: pattern }, { tags: pattern }, { description: pattern }];
    }

    const { items, total } = await productRepository.search({
      filter,
      sort: query.sort || 'newest',
      page,
      limit,
    });

    return {
      items: items.map(presentProduct),
      meta: pageMeta(page, limit, total),
    };
  },

  async getBySlug(slug) {
    const product = await productRepository.findBySlug(slug);
    if (!product || !product.isActive) throw new ApiError(404, 'Product not found');
    return presentProduct(product);
  },

  async create(input) {
    await requireCategory(input.categoryId);
    assertPrice(input.price, input.mrp);
    const product = await productRepository.create({
      name: input.name.trim(),
      slug: await uniqueSlug(input.name),
      description: input.description || '',
      category: input.categoryId,
      brand: input.brand || '',
      price: input.price,
      mrp: input.mrp,
      unit: input.unit,
      stock: input.stock,
      emoji: input.emoji || '🛍️',
      tint: input.tint || '#F4F1E8',
      tags: input.tags || [],
      isActive: input.isActive !== false,
    });
    const populated = await productRepository.findById(product._id);
    return presentProduct(populated);
  },

  async update(id, input) {
    const product = await productRepository.findById(id);
    if (!product) throw new ApiError(404, 'Product not found');
    if (input.categoryId) {
      await requireCategory(input.categoryId);
      product.category = input.categoryId;
    }
    if (input.name && input.name !== product.name) {
      product.name = input.name.trim();
      product.slug = await uniqueSlug(product.name, product._id);
    }
    if (input.description !== undefined) product.description = input.description;
    if (input.brand !== undefined) product.brand = input.brand;
    if (input.price !== undefined) product.price = input.price;
    if (input.mrp !== undefined) product.mrp = input.mrp;
    assertPrice(product.price, product.mrp);
    if (input.unit) product.unit = input.unit;
    if (input.stock !== undefined) product.stock = input.stock;
    if (input.emoji) product.emoji = input.emoji;
    if (input.tint) product.tint = input.tint;
    if (input.tags) product.tags = input.tags;
    if (input.isActive !== undefined) product.isActive = input.isActive;
    await productRepository.save(product);
    const populated = await productRepository.findById(product._id);
    return presentProduct(populated);
  },

  async archive(id) {
    const product = await productRepository.findById(id);
    if (!product) throw new ApiError(404, 'Product not found');
    product.isActive = false;
    await productRepository.save(product);
    return { archived: true, product: presentProduct(product) };
  },
};

module.exports = productService;
