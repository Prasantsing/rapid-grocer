const { discountPercent } = require('../domain/pricing');

function idOf(value) {
  if (!value) return value;
  if (typeof value === 'string') return value;
  return String(value.id || value._id || value);
}

function presentCategory(category) {
  if (!category) return category;
  const json = category.toJSON ? category.toJSON() : category;
  return {
    id: idOf(json),
    name: json.name,
    slug: json.slug,
    description: json.description || '',
    emoji: json.emoji,
    tint: json.tint,
    isActive: json.isActive,
    sortOrder: json.sortOrder ?? 0,
  };
}

function presentProduct(product) {
  const json = product.toJSON ? product.toJSON() : product;
  const category = json.category && typeof json.category === 'object'
    ? presentCategory(json.category)
    : json.category;
  return {
    id: idOf(json),
    name: json.name,
    slug: json.slug,
    description: json.description || '',
    category,
    brand: json.brand || '',
    price: json.price,
    mrp: json.mrp,
    unit: json.unit,
    stock: json.stock,
    emoji: json.emoji,
    tint: json.tint,
    tags: json.tags || [],
    isActive: json.isActive,
    discountPercent: discountPercent(json.price, json.mrp),
  };
}

function presentAddress(address) {
  const json = address.toJSON ? address.toJSON() : address;
  return {
    id: idOf(json),
    label: json.label,
    fullName: json.fullName,
    phone: json.phone,
    line1: json.line1,
    line2: json.line2 || '',
    landmark: json.landmark || '',
    city: json.city,
    state: json.state,
    pincode: json.pincode,
    isDefault: Boolean(json.isDefault),
  };
}

function presentCoupon(coupon, discount) {
  const json = coupon.toJSON ? coupon.toJSON() : coupon;
  return {
    id: idOf(json),
    code: json.code,
    description: json.description || '',
    type: json.type,
    value: json.value,
    minOrder: json.minOrder || 0,
    maxDiscount: json.maxDiscount || 0,
    expiresAt: json.expiresAt,
    usageLimit: json.usageLimit || 0,
    usedCount: json.usedCount || 0,
    isActive: json.isActive,
    discount: discount ?? undefined,
  };
}

function presentPerson(person, fields) {
  if (!person || typeof person !== 'object' || !person.name) return person ? idOf(person) : null;
  const json = person.toJSON ? person.toJSON() : person;
  const result = { id: idOf(json), name: json.name };
  for (const field of fields) {
    if (json[field] !== undefined) result[field] = json[field];
  }
  return result;
}

function presentOrder(order, viewerRole) {
  const json = order.toJSON ? order.toJSON() : order;
  const userFields = viewerRole === 'customer' ? ['phone'] : ['email', 'phone'];
  return {
    id: idOf(json),
    orderNumber: json.orderNumber,
    items: (json.items || []).map((item) => ({
      productId: idOf(item.product),
      name: item.name,
      slug: item.slug,
      emoji: item.emoji,
      tint: item.tint,
      unit: item.unit,
      price: item.price,
      mrp: item.mrp,
      quantity: item.quantity,
      lineTotal: Math.round(item.price * item.quantity * 100) / 100,
    })),
    address: json.address,
    couponCode: json.couponCode || '',
    subtotal: json.subtotal,
    discount: json.discount,
    deliveryFee: json.deliveryFee,
    total: json.total,
    paymentMethod: json.paymentMethod,
    paymentStatus: json.paymentStatus,
    status: json.status,
    notes: json.notes || '',
    timeline: (json.timeline || []).map((entry) => ({
      status: entry.status,
      note: entry.note,
      at: entry.at,
    })),
    user: presentPerson(json.user, userFields),
    deliveryPartner: presentPerson(json.deliveryPartner, ['phone']),
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

function presentNotification(notification) {
  const json = notification.toJSON ? notification.toJSON() : notification;
  return {
    id: idOf(json),
    title: json.title,
    body: json.body,
    type: json.type,
    read: json.read,
    link: json.link || '',
    createdAt: json.createdAt,
  };
}

function snapshotAddress(address) {
  const json = address.toJSON ? address.toJSON() : address;
  return {
    label: json.label,
    fullName: json.fullName,
    phone: json.phone,
    line1: json.line1,
    line2: json.line2 || '',
    landmark: json.landmark || '',
    city: json.city,
    state: json.state,
    pincode: json.pincode,
  };
}

module.exports = {
  presentCategory,
  presentProduct,
  presentAddress,
  presentCoupon,
  presentOrder,
  presentNotification,
  snapshotAddress,
};
