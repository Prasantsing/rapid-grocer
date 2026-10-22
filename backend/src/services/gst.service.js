const Order = require('../models/Order');
const inMemoryStore = require('../services/inMemoryStore');
const { getProductGstConfig, calculateGstFromGross, GST_SLABS } = require('../domain/gst');

const STORE_GST_PROFILE = {
  businessName: 'ZapBasket Retail & Quick Logistics Pvt. Ltd.',
  tradeName: 'ZapBasket',
  gstin: '29AAACZ1234F1Z5',
  pan: 'AAACZ1234F',
  cin: 'U52100KA2026PTC184920',
  state: 'Karnataka',
  stateCode: '29',
  address: 'No. 42, 80 Feet Road, 4th Block, Koramangala, Bengaluru, Karnataka 560034',
  email: 'billing@zapbasket.dev',
  phone: '+91 80 4920 1200',
  fssaiLicense: '11226333000142',
  taxType: 'Intra-State GST (CGST + SGST)',
};

function resolveDateRange(period, from, to) {
  const now = new Date();
  let startDate;
  let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (from) {
    startDate = new Date(from);
    startDate.setHours(0, 0, 0, 0);
  }
  if (to) {
    endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);
  }

  if (!from && !to) {
    switch (period) {
      case 'today': {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      }
      case 'this_week': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        break;
      }
      case 'last_month': {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      }
      case 'this_month':
      default: {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      }
    }
  }

  return { startDate, endDate };
}

const gstService = {
  getStoreProfile() {
    return STORE_GST_PROFILE;
  },

  async getGstReport({ period = 'this_month', from, to } = {}) {
    const { startDate, endDate } = resolveDateRange(period, from, to);

    let orders = [];
    if (inMemoryStore.isDbConnected()) {
      try {
        orders = await Order.find({
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: 'cancelled' },
        })
          .populate('user', 'name email phone')
          .sort({ createdAt: -1 });
      } catch (err) {
        console.warn('[GST Service] DB query fallback:', err.message);
        orders = [];
      }
    }

    // In-memory fallback if empty or offline
    if (orders.length === 0) {
      const memoryOrders = inMemoryStore.storeOrders || [];
      orders = memoryOrders.filter((o) => {
        const dt = new Date(o.createdAt || Date.now());
        return dt >= startDate && dt <= endDate && o.status !== 'cancelled';
      });
    }

    // Initialize Slab Aggregators
    const slabTotals = {
      '0%': { rate: 0, label: GST_SLABS.NIL.label, hsn: '0709 / 0803 / 0401', itemsCount: 0, taxableValue: 0, cgst: 0, sgst: 0, totalTax: 0, gross: 0 },
      '5%': { rate: 5, label: GST_SLABS.FIVE.label, hsn: '1006 / 1515 / 0902', itemsCount: 0, taxableValue: 0, cgst: 0, sgst: 0, totalTax: 0, gross: 0 },
      '12%': { rate: 12, label: GST_SLABS.TWELVE.label, hsn: '2106 / 2202 / 1905', itemsCount: 0, taxableValue: 0, cgst: 0, sgst: 0, totalTax: 0, gross: 0 },
    };

    let totalGrossTurnover = 0;
    let totalTaxableValue = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalGst = 0;

    const invoices = orders.map((order, idx) => {
      const orderJson = order.toJSON ? order.toJSON() : order;
      const orderItems = orderJson.items || [];
      const orderNumber = orderJson.orderNumber || `ORD-${idx + 1001}`;
      const invoiceNumber = `INV-${new Date(orderJson.createdAt || Date.now()).getFullYear()}-${orderNumber}`;

      let orderTaxable = 0;
      let orderCgst = 0;
      let orderSgst = 0;
      let orderGross = 0;

      const itemsDetail = orderItems.map((item) => {
        const lineTotal = Math.round((item.price || 0) * (item.quantity || 1) * 100) / 100;
        const gstConfig = getProductGstConfig(item);
        const tax = calculateGstFromGross(lineTotal, gstConfig.rate);

        // Aggregate into order
        orderTaxable += tax.taxableAmount;
        orderCgst += tax.cgstAmount;
        orderSgst += tax.sgstAmount;
        orderGross += tax.grossAmount;

        // Aggregate into slab
        const slabKey = gstConfig.code;
        if (slabTotals[slabKey]) {
          slabTotals[slabKey].itemsCount += item.quantity || 1;
          slabTotals[slabKey].taxableValue += tax.taxableAmount;
          slabTotals[slabKey].cgst += tax.cgstAmount;
          slabTotals[slabKey].sgst += tax.sgstAmount;
          slabTotals[slabKey].totalTax += tax.totalGst;
          slabTotals[slabKey].gross += tax.grossAmount;
        }

        return {
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.price,
          hsn: gstConfig.hsn,
          gstRate: gstConfig.rate,
          taxableAmount: tax.taxableAmount,
          cgstAmount: tax.cgstAmount,
          sgstAmount: tax.sgstAmount,
          totalGst: tax.totalGst,
          grossAmount: tax.grossAmount,
        };
      });

      // Include delivery fee as 18% or standard services if applicable, or treat as flat
      orderGross = Math.round(orderGross * 100) / 100;
      orderTaxable = Math.round(orderTaxable * 100) / 100;
      orderCgst = Math.round(orderCgst * 100) / 100;
      orderSgst = Math.round(orderSgst * 100) / 100;
      const orderTotalGst = Math.round((orderCgst + orderSgst) * 100) / 100;

      totalGrossTurnover += orderGross;
      totalTaxableValue += orderTaxable;
      totalCgst += orderCgst;
      totalSgst += orderSgst;
      totalGst += orderTotalGst;

      return {
        id: orderJson._id || orderJson.id,
        invoiceNumber,
        orderNumber,
        createdAt: orderJson.createdAt,
        customerName: orderJson.user?.name || orderJson.address?.fullName || 'Retail Customer (B2C)',
        customerPhone: orderJson.user?.phone || orderJson.address?.phone || '',
        customerCity: orderJson.address?.city || 'Bengaluru',
        paymentMethod: (orderJson.paymentMethod || 'cod').toUpperCase(),
        paymentStatus: orderJson.paymentStatus || 'paid',
        itemsCount: orderItems.length,
        taxableAmount: orderTaxable,
        cgstAmount: orderCgst,
        sgstAmount: orderSgst,
        totalGst: orderTotalGst,
        grossAmount: orderGross,
        items: itemsDetail,
      };
    });

    // Round all slab totals
    Object.keys(slabTotals).forEach((k) => {
      slabTotals[k].taxableValue = Math.round(slabTotals[k].taxableValue * 100) / 100;
      slabTotals[k].cgst = Math.round(slabTotals[k].cgst * 100) / 100;
      slabTotals[k].sgst = Math.round(slabTotals[k].sgst * 100) / 100;
      slabTotals[k].totalTax = Math.round(slabTotals[k].totalTax * 100) / 100;
      slabTotals[k].gross = Math.round(slabTotals[k].gross * 100) / 100;
    });

    return {
      store: STORE_GST_PROFILE,
      period: {
        name: period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      summary: {
        totalOrders: orders.length,
        totalGrossTurnover: Math.round(totalGrossTurnover * 100) / 100,
        totalTaxableValue: Math.round(totalTaxableValue * 100) / 100,
        totalCgst: Math.round(totalCgst * 100) / 100,
        totalSgst: Math.round(totalSgst * 100) / 100,
        totalGstCollected: Math.round(totalGst * 100) / 100,
        netSales: Math.round(totalTaxableValue * 100) / 100,
      },
      slabs: Object.values(slabTotals),
      invoices,
    };
  },

  async getOrderInvoice(orderId) {
    let order = null;
    if (inMemoryStore.isDbConnected()) {
      try {
        order = await Order.findById(orderId).populate('user', 'name email phone');
      } catch (_) {}
    }
    if (!order) {
      const memoryOrders = inMemoryStore.storeOrders || [];
      order = memoryOrders.find((o) => String(o._id || o.id) === String(orderId));
    }
    if (!order) throw new Error('Order not found');

    const orderJson = order.toJSON ? order.toJSON() : order;
    const orderItems = orderJson.items || [];
    const invoiceNumber = `INV-${new Date(orderJson.createdAt || Date.now()).getFullYear()}-${orderJson.orderNumber}`;

    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let grossTotal = 0;

    const items = orderItems.map((item) => {
      const lineGross = Math.round((item.price || 0) * (item.quantity || 1) * 100) / 100;
      const gstConfig = getProductGstConfig(item);
      const tax = calculateGstFromGross(lineGross, gstConfig.rate);

      taxableTotal += tax.taxableAmount;
      cgstTotal += tax.cgstAmount;
      sgstTotal += tax.sgstAmount;
      grossTotal += tax.grossAmount;

      return {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        hsn: gstConfig.hsn,
        gstRate: gstConfig.rate,
        taxable: tax.taxableAmount,
        cgst: tax.cgstAmount,
        sgst: tax.sgstAmount,
        total: tax.grossAmount,
      };
    });

    return {
      store: STORE_GST_PROFILE,
      invoice: {
        invoiceNumber,
        invoiceDate: orderJson.createdAt,
        orderNumber: orderJson.orderNumber,
        customer: {
          name: orderJson.user?.name || orderJson.address?.fullName || 'Retail Customer',
          phone: orderJson.user?.phone || orderJson.address?.phone || '',
          email: orderJson.user?.email || '',
          address: orderJson.address,
        },
        payment: {
          method: orderJson.paymentMethod,
          status: orderJson.paymentStatus,
          transactionId: orderJson.upiTransactionId || orderJson.gatewayVerification?.gatewayTransactionId || '',
        },
        items,
        subtotal: Math.round(taxableTotal * 100) / 100,
        cgst: Math.round(cgstTotal * 100) / 100,
        sgst: Math.round(sgstTotal * 100) / 100,
        totalGst: Math.round((cgstTotal + sgstTotal) * 100) / 100,
        deliveryFee: orderJson.deliveryFee || 0,
        discount: orderJson.discount || 0,
        total: Math.round(orderJson.total * 100) / 100,
      },
    };
  },
};

module.exports = gstService;
