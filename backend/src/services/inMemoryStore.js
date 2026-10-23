const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { categories, coupons, users } = require('../seed/catalog');
const { slugify } = require('../utils/slug');

// Pre-hashed demo passwords
const HASHED_PASSWORDS = {
  'admin@zapbasket.dev': bcrypt.hashSync('Admin@12345', 10),
  'aisha@zapbasket.dev': bcrypt.hashSync('Customer@123', 10),
  'ravi@zapbasket.dev': bcrypt.hashSync('Delivery@123', 10),
};

const DEMO_USER_IDS = {
  'admin@zapbasket.dev': '6ad1f1aac3fe9206da48c701',
  'aisha@zapbasket.dev': '6ad1f1aac3fe9206da48c702',
  'ravi@zapbasket.dev': '6ad1f1aac3fe9206da48c703',
};

const storeUsers = users.map((u, idx) => {
  const id = DEMO_USER_IDS[u.email] || `6ad1f1aac3fe9206da48c70${idx + 1}`;
  return {
    _id: id,
    id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    password: HASHED_PASSWORDS[u.email] || bcrypt.hashSync(u.password, 10),
    role: u.role,
    isActive: true,
    permissionGrants: [],
    permissionRevokes: [],
    createdAt: new Date(),
  };
});

const storeCategories = categories.map((cat, idx) => {
  const id = `6ad1f1aac3fe9206da48c80${idx + 1}`;
  return {
    _id: id,
    id,
    name: cat.name,
    slug: slugify(cat.name),
    description: cat.description,
    emoji: cat.emoji,
    tint: cat.tint,
    sortOrder: cat.sortOrder,
    isActive: true,
  };
});

const storeProducts = [];
let pIdx = 100;
for (const cat of categories) {
  const matchedCat = storeCategories.find((c) => c.name === cat.name);
  for (const prod of cat.products) {
    pIdx += 1;
    const id = `6ad1f1aac3fe9206da48c9${pIdx}`;
    storeProducts.push({
      _id: id,
      id,
      name: prod.name,
      slug: slugify(prod.name),
      brand: prod.brand,
      category: matchedCat,
      price: prod.price,
      mrp: prod.mrp,
      unit: prod.unit,
      stock: prod.stock,
      emoji: prod.emoji,
      tint: prod.tint,
      imageUrl: prod.imageUrl || '',
      tags: prod.tags || [],
      description: prod.description,
      isActive: true,
      createdAt: new Date(),
    });
  }
}

const storeCoupons = coupons.map((cpn, idx) => {
  const id = `6ad1f1aac3fe9206da48ca0${idx + 1}`;
  return {
    _id: id,
    id,
    ...cpn,
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    isActive: true,
    usedCount: 0,
  };
});

const storeCarts = new Map();
const storeOrders = [];
const storeRefreshTokens = new Map();
const storeAddresses = new Map();
const storeWishlists = new Map();

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

const inMemoryStore = {
  isDbConnected,

  findUserByEmailOrPhone(identifier) {
    const raw = String(identifier || '').trim().toLowerCase();
    const phoneDigits = raw.replace(/^(?:\+91|91|0)/, '').replace(/\D/g, '');
    return storeUsers.find((u) => u.email.toLowerCase() === raw || (phoneDigits && u.phone === phoneDigits)) || null;
  },

  findUserById(id) {
    return storeUsers.find((u) => String(u._id) === String(id)) || null;
  },

  createUser(data) {
    const id = `6ad1f1aac3fe9206da48cb${Date.now().toString().slice(-4)}`;
    const user = {
      _id: id,
      id,
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone || '',
      password: data.password,
      role: data.role || 'customer',
      isActive: true,
      permissionGrants: [],
      permissionRevokes: [],
      createdAt: new Date(),
    };
    storeUsers.push(user);
    return user;
  },

  listCategories() {
    return storeCategories.filter((c) => c.isActive);
  },

  findCategoryBySlug(slug) {
    return storeCategories.find((c) => c.slug === slug && c.isActive) || null;
  },

  searchProducts({ filter = {}, sort = 'newest', page = 1, limit = 24 } = {}) {
    let items = storeProducts.filter((p) => p.isActive);
    if (filter.category) {
      items = items.filter((p) => String(p.category._id) === String(filter.category) || p.category.slug === filter.category);
    }
    if (filter.name && filter.name.$regex) {
      const reg = new RegExp(filter.name.$regex, filter.name.$options || 'i');
      items = items.filter((p) => reg.test(p.name) || reg.test(p.brand) || reg.test(p.description));
    }
    if (Array.isArray(filter.$or) && filter.$or.length > 0) {
      items = items.filter((p) => {
        const text = `${p.name} ${p.brand || ''} ${p.description || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
        return filter.$or.some((cond) => {
          for (const key of ['name', 'brand', 'tags', 'description']) {
            if (cond[key] && cond[key].test) {
              return cond[key].test(text);
            }
          }
          return false;
        });
      });
    }
    if (sort === 'price_asc') items.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') items.sort((a, b) => b.price - a.price);
    else if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));

    const total = items.length;
    const paginated = items.slice((page - 1) * limit, page * limit);
    return { items: paginated, total };
  },

  findProductBySlug(slug) {
    return storeProducts.find((p) => p.slug === slug && p.isActive) || null;
  },

  findProductById(id) {
    return storeProducts.find((p) => String(p._id) === String(id) && p.isActive) || null;
  },

  createProduct(data) {
    const pId = `6ad1f1aac3fe9206da48c9${Date.now().toString().slice(-4)}`;
    const category = storeCategories.find((c) => String(c._id) === String(data.category)) || data.category;
    const newProd = {
      _id: pId,
      id: pId,
      ...data,
      category,
      createdAt: new Date(),
      save: async function() { return this; },
      toJSON: function() { return this; },
    };
    storeProducts.unshift(newProd);
    return newProd;
  },

  saveProduct(prod) {
    const idx = storeProducts.findIndex((p) => String(p._id) === String(prod._id || prod.id));
    if (idx !== -1) {
      storeProducts[idx] = { ...storeProducts[idx], ...prod };
      return storeProducts[idx];
    }
    return prod;
  },

  restockProduct(productId, quantity) {
    const prod = storeProducts.find((p) => String(p._id) === String(productId) || p.id === productId);
    if (prod) {
      prod.stock = Math.max(0, (prod.stock || 0) + Number(quantity));
      return prod;
    }
    return null;
  },

  getActiveCoupons() {
    return storeCoupons.filter((c) => c.isActive && new Date(c.expiresAt) > new Date());
  },

  findCouponByCode(code) {
    return storeCoupons.find((c) => c.code.toUpperCase() === String(code).toUpperCase()) || null;
  },

  getCart(userId) {
    const key = String(userId);
    if (!storeCarts.has(key)) {
      storeCarts.set(key, { user: key, items: [], couponCode: '' });
    }
    return storeCarts.get(key);
  },

  setCartItems(userId, items, couponCode = '') {
    const key = String(userId);
    const cart = { user: key, items: items || [], couponCode: couponCode || '' };
    storeCarts.set(key, cart);
    return cart;
  },

  clearCart(userId) {
    const key = String(userId);
    const cart = { user: key, items: [], couponCode: '' };
    storeCarts.set(key, cart);
    return cart;
  },

  saveRefreshToken(tokenData) {
    storeRefreshTokens.set(tokenData.tokenHash, {
      ...tokenData,
      revokedAt: null,
    });
  },

  findRefreshToken(tokenHash) {
    const token = storeRefreshTokens.get(tokenHash);
    if (!token) return null;
    if (token.revokedAt || new Date(token.expiresAt) <= new Date()) return null;
    return token;
  },

  revokeRefreshToken(tokenHash) {
    const token = storeRefreshTokens.get(tokenHash);
    if (token) token.revokedAt = new Date();
  },

  getAddresses(userId) {
    return storeAddresses.get(String(userId)) || [];
  },

  saveAddress(userId, address) {
    const key = String(userId);
    const list = storeAddresses.get(key) || [];
    const id = address._id || `6ad1f1aac3fe9206da48cc${Date.now().toString().slice(-4)}`;
    const saved = { ...address, _id: id, id };
    list.push(saved);
    storeAddresses.set(key, list);
    return saved;
  },

  createOrder(data) {
    const orderNum = `ZB-${Date.now().toString().slice(-6)}`;
    const order = {
      _id: `6ad1f1aac3fe9206da48cd${Date.now().toString().slice(-4)}`,
      orderNumber: orderNum,
      ...data,
      status: 'confirmed',
      paymentStatus: data.paymentMethod === 'cod' ? 'pending' : 'paid',
      createdAt: new Date(),
      timeline: [
        {
          status: 'confirmed',
          note: 'Order confirmed (Demo Mode)',
          at: new Date(),
        },
      ],
    };
    storeOrders.unshift(order);
    return order;
  },

  findOrderById(id) {
    return storeOrders.find((o) => String(o._id) === String(id) || o.orderNumber === id) || null;
  },

  updateOrder(id, updates) {
    const order = this.findOrderById(id);
    if (!order) return null;
    Object.assign(order, updates);
    return order;
  },

  saveOrder(order) {
    const id = order._id || order.id;
    const existing = this.findOrderById(id);
    if (existing) {
      Object.assign(existing, order);
      return existing;
    }
    storeOrders.unshift(order);
    return order;
  },

  searchOrders(filter = {}, { page = 1, limit = 20 } = {}) {
    let items = [...storeOrders];
    if (filter.user) items = items.filter((o) => String(o.user) === String(filter.user));
    if (filter.status) items = items.filter((o) => o.status === filter.status);
    const total = items.length;
    const paginated = items.slice((page - 1) * limit, page * limit);
    return { items: paginated, total };
  },
};

module.exports = inMemoryStore;
