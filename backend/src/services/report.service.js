const reportRepository = require('../repositories/report.repository');

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function paidMatch(from, to) {
  const match = {
    status: { $ne: 'cancelled' },
    paymentStatus: { $in: ['paid', 'cod'] },
  };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }
  return match;
}

function mapStatus(rows) {
  return rows.map((row) => ({ status: row._id, count: row.count, revenue: row.revenue }));
}

const reportService = {
  async dashboard() {
    const today = startOfDay(new Date());
    const [byStatus, revenueRows, users, lowStock, recentOrders, topProducts] = await Promise.all([
      reportRepository.ordersByStatus(),
      reportRepository.revenue(paidMatch()),
      reportRepository.usersByRole(),
      reportRepository.lowStock(),
      reportRepository.recentOrders(),
      reportRepository.topProducts(paidMatch()),
    ]);
    const revenue = revenueRows[0] || { revenue: 0, orders: 0, discount: 0 };
    const todayRows = await reportRepository.revenue(paidMatch(today));
    const todayStats = todayRows[0] || { revenue: 0, orders: 0 };

    return {
      revenue: revenue.revenue,
      orders: revenue.orders,
      discount: revenue.discount,
      averageOrderValue: revenue.orders ? Math.round(revenue.revenue / revenue.orders) : 0,
      todayRevenue: todayStats.revenue,
      todayOrders: todayStats.orders,
      ordersByStatus: mapStatus(byStatus),
      usersByRole: users.map((row) => ({ role: row._id, count: row.count })),
      lowStock: lowStock.map((product) => ({
        id: String(product._id),
        name: product.name,
        stock: product.stock,
        unit: product.unit,
        emoji: product.emoji,
        price: product.price,
      })),
      topProducts: topProducts.map((row) => ({
        name: row._id,
        quantity: row.quantity,
        revenue: row.revenue,
      })),
      recentOrders: recentOrders.map((order) => ({
        id: String(order._id),
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        customer: order.user?.name || 'Customer',
        createdAt: order.createdAt,
      })),
    };
  },

  async report(query) {
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();
    if (query.from && !query.from.includes('T')) from.setHours(0, 0, 0, 0);
    if (query.to && !query.to.includes('T')) to.setHours(23, 59, 59, 999);

    const match = paidMatch(from, to);
    const [revenueRows, byStatus, byDay, topProducts, newCustomers] = await Promise.all([
      reportRepository.revenue(match),
      reportRepository.ordersByStatus({ createdAt: match.createdAt }),
      reportRepository.ordersByDay(match),
      reportRepository.topProducts(match),
      reportRepository.newCustomers({ createdAt: match.createdAt }),
    ]);
    const revenue = revenueRows[0] || { revenue: 0, orders: 0, discount: 0 };

    return {
      from,
      to,
      revenue: revenue.revenue,
      orders: revenue.orders,
      discount: revenue.discount,
      averageOrderValue: revenue.orders ? Math.round((revenue.revenue / revenue.orders) * 100) / 100 : 0,
      newCustomers,
      ordersByStatus: mapStatus(byStatus),
      ordersByDay: byDay.map((row) => ({ date: row._id, orders: row.orders, revenue: row.revenue })),
      topProducts: topProducts.map((row) => ({
        name: row._id,
        quantity: row.quantity,
        revenue: row.revenue,
      })),
    };
  },
};

module.exports = reportService;
