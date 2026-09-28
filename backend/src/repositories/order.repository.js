const Order = require('../models/Order');

const POPULATE = [
  { path: 'user', select: 'name email phone role' },
  { path: 'deliveryPartner', select: 'name phone role' },
];

const orderRepository = {
  create(data) {
    return Order.create(data);
  },

  findById(id) {
    return Order.findById(id).populate(POPULATE);
  },

  findByOrderNumber(orderNumber) {
    return Order.findOne({ orderNumber });
  },

  async search(filter, { page, limit }) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Order.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);
    return { items, total };
  },

  save(order) {
    return order.save();
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
