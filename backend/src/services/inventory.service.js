const Product = require('../models/Product');
const Category = require('../models/Category');
const productRepository = require('../repositories/product.repository');
const inMemoryStore = require('../services/inMemoryStore');
const { presentProduct } = require('../utils/presenters');
const { getProductGstConfig } = require('../domain/gst');
const ApiError = require('../utils/ApiError');

const LOW_STOCK_THRESHOLD = 10;
const BENCHMARK_STOCK = 50;

function evaluateStockHealth(stock) {
  if (stock <= 0) return { status: 'out_of_stock', label: 'Out of Stock (Urgent)', color: 'danger' };
  if (stock <= LOW_STOCK_THRESHOLD) return { status: 'low_stock', label: 'Low Stock (< 10)', color: 'warning' };
  return { status: 'healthy', label: 'Healthy Stock', color: 'success' };
}

const inventoryService = {
  async getInventoryReview({ search = '', status = 'all', category = '', sort = 'stock_asc' } = {}) {
    let allProducts = [];

    if (inMemoryStore.isDbConnected()) {
      try {
        allProducts = await Product.find({ isActive: true })
          .populate('category', 'name slug emoji tint')
          .sort({ name: 1 });
      } catch (err) {
        console.warn('[Inventory Service] DB query fallback:', err.message);
        allProducts = [];
      }
    }

    if (allProducts.length === 0) {
      allProducts = inMemoryStore.storeProducts.filter((p) => p.isActive);
    }

    // Compute Overall KPIs
    let totalUnits = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    let healthyStockCount = 0;
    let totalValuation = 0;

    const presentedItems = allProducts.map((p) => {
      const presented = presentProduct(p);
      const stock = presented.stock || 0;
      const price = presented.price || 0;
      const valuation = Math.round(stock * price * 100) / 100;
      const health = evaluateStockHealth(stock);
      const gstConfig = getProductGstConfig(presented);

      totalUnits += stock;
      totalValuation += valuation;

      if (health.status === 'out_of_stock') outOfStockCount += 1;
      else if (health.status === 'low_stock') lowStockCount += 1;
      else healthyStockCount += 1;

      return {
        ...presented,
        valuation,
        stockHealth: health.status,
        stockHealthLabel: health.label,
        stockHealthColor: health.color,
        stockPercent: Math.min(100, Math.round((stock / BENCHMARK_STOCK) * 100)),
        hsn: gstConfig.hsn,
        gstRate: gstConfig.rate,
      };
    });

    // Apply Filter & Search
    let filtered = presentedItems;

    if (status === 'urgent' || status === 'out_of_stock') {
      filtered = filtered.filter((i) => i.stock <= 0);
    } else if (status === 'low' || status === 'low_stock') {
      filtered = filtered.filter((i) => i.stock > 0 && i.stock <= LOW_STOCK_THRESHOLD);
    } else if (status === 'healthy') {
      filtered = filtered.filter((i) => i.stock > LOW_STOCK_THRESHOLD);
    }

    if (category) {
      filtered = filtered.filter((i) => {
        const catId = typeof i.category === 'object' ? i.category.id || i.category.slug : i.category;
        return catId === category || (typeof i.category === 'object' && i.category.slug === category);
      });
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        (i.brand && i.brand.toLowerCase().includes(q)) ||
        (i.unit && i.unit.toLowerCase().includes(q))
      );
    }

    // Apply Sorting
    if (sort === 'stock_asc') filtered.sort((a, b) => a.stock - b.stock);
    else if (sort === 'stock_desc') filtered.sort((a, b) => b.stock - a.stock);
    else if (sort === 'value_desc') filtered.sort((a, b) => b.valuation - a.valuation);
    else if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));

    return {
      kpi: {
        totalSkus: presentedItems.length,
        totalUnits,
        outOfStockCount,
        lowStockCount,
        healthyStockCount,
        totalValuation: Math.round(totalValuation * 100) / 100,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
      },
      items: filtered,
    };
  },

  async restockProduct({ productId, quantity, note = '' }) {
    const qty = Number(quantity);
    if (!productId) throw new ApiError(400, 'Product ID is required');
    if (!qty || qty <= 0) throw new ApiError(400, 'Restock quantity must be greater than 0');

    const updated = await productRepository.restock(productId, qty);
    if (!updated) throw new ApiError(404, 'Product not found');

    const presented = presentProduct(updated);
    return {
      product: presented,
      added: qty,
      newStock: presented.stock,
      note,
      restockedAt: new Date().toISOString(),
    };
  },
};

module.exports = inventoryService;
