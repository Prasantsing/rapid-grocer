const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Address = require('../models/Address');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const Wishlist = require('../models/Wishlist');
const RefreshToken = require('../models/RefreshToken');
const { categories, coupons, users } = require('./catalog');
const { slugify } = require('../utils/slug');
const { summarize } = require('../domain/pricing');
const { connectDb, disconnectDb } = require('../config/db');

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function seed() {
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Coupon.deleteMany({}),
    Address.deleteMany({}),
    Cart.deleteMany({}),
    Order.deleteMany({}),
    Notification.deleteMany({}),
    Wishlist.deleteMany({}),
    RefreshToken.deleteMany({}),
  ]);

  const createdUsers = {};
  for (const entry of users) {
    createdUsers[entry.role === 'customer' ? 'customer' : entry.role] = await User.create({
      name: entry.name,
      email: entry.email,
      phone: entry.phone,
      password: await bcrypt.hash(entry.password, 12),
      role: entry.role,
    });
  }
  const customer = createdUsers.customer;
  const admin = createdUsers.admin;
  const delivery = createdUsers.delivery;

  const productDocs = [];
  for (const category of categories) {
    const savedCategory = await Category.create({
      name: category.name,
      slug: slugify(category.name),
      description: category.description,
      emoji: category.emoji,
      tint: category.tint,
      sortOrder: category.sortOrder,
      isActive: true,
    });
    for (const product of category.products) {
      productDocs.push(await Product.create({
        ...product,
        slug: slugify(product.name),
        category: savedCategory._id,
        isActive: true,
      }));
    }
  }

  const expires = new Date();
  expires.setMonth(expires.getMonth() + 6);
  for (const coupon of coupons) {
    await Coupon.create({ ...coupon, expiresAt: expires, isActive: true, usedCount: 0 });
  }

  const address = await Address.create({
    user: customer._id,
    label: 'Home',
    fullName: customer.name,
    phone: customer.phone,
    line1: '42, 4th Cross, Koramangala 5th Block',
    line2: 'Near the old bakery',
    landmark: 'Yellow gate',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560095',
    isDefault: true,
  });

  const byName = (name) => productDocs.find((product) => product.name === name);
  const banana = byName('Robusta Banana');
  const milk = byName('Toned Milk');
  const oats = byName('Masala Oats Cup');
  const bread = byName('Sourdough Loaf');
  const chips = byName('Masala Potato Chips');
  const spinach = byName('Baby Spinach');

  await Cart.create({
    user: customer._id,
    items: [
      { product: banana._id, quantity: 1 },
      { product: milk._id, quantity: 2 },
      { product: oats._id, quantity: 1 },
    ],
    couponCode: '',
  });

  await Wishlist.create({
    user: customer._id,
    products: [bread._id, spinach._id],
  });

  async function makeOrder({ items, status, partner, createdAt, paymentStatus = 'cod' }) {
    const priced = items.map((item) => ({ price: item.product.price, quantity: item.quantity }));
    const summary = summarize(priced);
    const timeline = [
      { status: 'placed', note: 'Order placed', at: createdAt, by: customer._id },
    ];
    if (['confirmed', 'packed', 'out_for_delivery', 'delivered'].includes(status)) {
      timeline.push({ status: 'confirmed', note: 'Store confirmed the order', at: new Date(createdAt.getTime() + 4 * 60000), by: admin._id });
    }
    if (['packed', 'out_for_delivery', 'delivered'].includes(status)) {
      timeline.push({ status: 'packed', note: `${partner.name} accepted the delivery`, at: new Date(createdAt.getTime() + 8 * 60000), by: partner._id });
    }
    if (['out_for_delivery', 'delivered'].includes(status)) {
      timeline.push({ status: 'out_for_delivery', note: 'Out for delivery', at: new Date(createdAt.getTime() + 12 * 60000), by: partner._id });
    }
    if (status === 'delivered') {
      timeline.push({ status: 'delivered', note: 'Delivered', at: new Date(createdAt.getTime() + 24 * 60000), by: partner._id });
    }

    const order = await Order.create({
      orderNumber: `ZBSEED${String(productDocs.indexOf(items[0].product) + 10)}${status.slice(0, 3).toUpperCase()}`,
      user: customer._id,
      items: items.map((item) => ({
        product: item.product._id,
        name: item.product.name,
        slug: item.product.slug,
        emoji: item.product.emoji,
        tint: item.product.tint,
        unit: item.product.unit,
        price: item.product.price,
        mrp: item.product.mrp,
        quantity: item.quantity,
      })),
      address: {
        label: address.label,
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },
      subtotal: summary.subtotal,
      discount: 0,
      deliveryFee: summary.deliveryFee,
      total: summary.total,
      paymentMethod: 'cod',
      paymentStatus,
      status,
      deliveryPartner: partner ? partner._id : null,
      timeline,
      createdAt,
      updatedAt: timeline[timeline.length - 1].at,
    });

    for (const item of items) {
      await Product.updateOne({ _id: item.product._id }, { $inc: { stock: -item.quantity } });
    }
    return order;
  }

  const delivered = await makeOrder({
    items: [{ product: chips, quantity: 2 }, { product: milk, quantity: 1 }],
    status: 'delivered',
    partner: delivery,
    createdAt: hoursAgo(30),
  });
  const active = await makeOrder({
    items: [{ product: bread, quantity: 1 }, { product: banana, quantity: 1 }],
    status: 'packed',
    partner: delivery,
    createdAt: hoursAgo(1),
  });
  const available = await makeOrder({
    items: [{ product: spinach, quantity: 1 }, { product: oats, quantity: 2 }],
    status: 'confirmed',
    partner: null,
    createdAt: hoursAgo(0.4),
  });

  await Notification.create([
    {
      user: customer._id,
      title: 'Welcome to ZapBasket',
      body: 'Aisha, your Koramangala address is saved. The next slot is about 12 minutes out.',
      type: 'system',
      link: '/',
      read: false,
    },
    {
      user: customer._id,
      title: 'Delivered',
      body: `${delivered.orderNumber} was left at the yellow gate.`,
      type: 'order',
      link: `/orders/${delivered._id}`,
      read: true,
      createdAt: hoursAgo(28),
    },
    {
      user: delivery._id,
      title: 'Delivery assigned',
      body: `${active.orderNumber} is packed and waiting for you.`,
      type: 'order',
      link: '/delivery',
      read: false,
    },
    {
      user: customer._id,
      title: 'Order confirmed',
      body: `${available.orderNumber} is confirmed. A rider can pick it up next.`,
      type: 'order',
      link: `/orders/${available._id}`,
      read: false,
    },
  ]);

  return {
    users: Object.values(createdUsers).length,
    categories: categories.length,
    products: productDocs.length,
    coupons: coupons.length,
  };
}

async function seedIfEmpty() {
  const count = await Product.countDocuments();
  if (count > 0) return false;
  await seed();
  return true;
}

module.exports = { seed, seedIfEmpty };

if (require.main === module) {
  connectDb()
    .then(() => seed())
    .then((summary) => {
      console.log('ZapBasket database reset and seeded.', summary);
      console.log('admin@zapbasket.dev / Admin@12345');
      console.log('aisha@zapbasket.dev / Customer@123');
      console.log('ravi@zapbasket.dev / Delivery@123');
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => disconnectDb());
}
