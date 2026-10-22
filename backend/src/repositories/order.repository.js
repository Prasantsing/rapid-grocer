const Order = require('../models/Order');
const inMemoryStore = require('../services/inMemoryStore');

const POPULATE = [
  { path: 'user', select: 'name email phone role' },
  { path: 'deliveryPartner', select: 'name phone role' },
];

const orderRepository = {
  async create(data) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.createOrder(data);
    }
    try {
      return await Order.create(data);
    } catch (_) {
      return inMemoryStore.createOrder(data);
    }
  },

  async findById(id) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.findOrderById(id);
    }
    try {
      const order = await Order.findById(id).populate(POPULATE);
      return order || inMemoryStore.findOrderById(id);
    } catch (_) {
      return inMemoryStore.findOrderById(id);
    }
  },

  findByOrderNumber(orderNumber) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.findOrderById(orderNumber);
    }
    return Order.findOne({ orderNumber });
  },

  countByUser(userId) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.searchOrders({ user: userId }).total;
    }
    return Order.countDocuments({ user: userId, status: { $ne: 'cancelled' } });
  },

  async search(filter, { page, limit }) {
    if (!inMemoryStore.isDbConnected()) {
      return inMemoryStore.searchOrders(filter, { page, limit });
    }
    try {
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        Order.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Order.countDocuments(filter),
      ]);
      return { items, total };
    } catch (_) {
      return inMemoryStore.searchOrders(filter, { page, limit });
    }
  },

  async save(order) {
    if (!inMemoryStore.isDbConnected() || typeof order.save !== 'function') {
      return inMemoryStore.saveOrder(order);
    }
    try {
      return await order.save();
    } catch (_) {
      return inMemoryStore.saveOrder(order);
    }
  },

  claim(orderId, partner) {
    return Order.findOneAndUpdate(
      {
        _id: orderId,
        status: { $in: ['confirmed', 'packed'] },
        $and: [
          { $or: [{ deliveryPartner: null }, { deliveryPartner: partner._id }] },
          { $or: [{ paymentMethod: 'cod' }, { paymentStatus: 'paid' }] },
        ],
      },
      {
        $set: { deliveryPartner: partner._id, status: 'packed' },
        $push: {
          timeline: {
            status: 'packed',
            note: `${partner.name} accepted the delivery`,
            at: new Date(),
            by: partner._id,
          },
        },
      },
      { new: true }
    ).populate(POPULATE);
  },
};

module.exports = orderRepository;
