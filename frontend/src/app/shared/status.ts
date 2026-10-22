export const STATUS_LABEL: Record<string, string> = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed',
  cod: 'Cash on delivery',
};

export const ORDER_STEPS = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered'];
