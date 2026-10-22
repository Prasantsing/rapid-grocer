const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

const reportRepository = {
  ordersByStatus(match = {}) {
    return Order.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$total' } } },
    ]);
  },

  revenue(match) {
    return Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
          discount: { $sum: '$discount' },
        },
      },
    ]);
  },

  ordersByDay(match) {
    return Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  },

  topProducts(match) {
    return Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
    ]);
  },

  usersByRole() {
    return User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  },

  newCustomers(match) {
    return User.countDocuments({ role: 'customer', ...match });
  },

  lowStock() {
    return Product.find({ isActive: true, stock: { $lte: 8 } })
      .sort({ stock: 1 })
      .limit(6)
      .select('name stock unit emoji price');
  },

  recentOrders() {
    return Order.find().sort({ createdAt: -1 }).limit(6).populate('user', 'name');
  },
};

module.exports = reportRepository;
