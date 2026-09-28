const STATUSES = [
  'placed',
  'confirmed',
  'packed',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

const TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

const STATUS_NOTES = {
  placed: 'Order placed',
  confirmed: 'Store confirmed the order',
  packed: 'Order packed',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Order cancelled',
};

function canTransition(from, to) {
  return Boolean(TRANSITIONS[from]?.includes(to));
}

function canActorTransition(role, from, to) {
  if (!canTransition(from, to)) return false;
  if (role === 'admin') return true;
  if (role === 'delivery') return to === 'out_for_delivery' || to === 'delivered';
  if (role === 'customer') return to === 'cancelled' && (from === 'placed' || from === 'confirmed');
  return false;
}

module.exports = {
  STATUSES,
  TRANSITIONS,
  STATUS_NOTES,
  canTransition,
  canActorTransition,
};
