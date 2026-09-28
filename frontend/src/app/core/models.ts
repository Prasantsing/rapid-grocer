export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

export type Role = 'admin' | 'customer' | 'delivery';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  isActive: boolean;
  permissions: string[];
  permissionGrants: string[];
  permissionRevokes: string[];
  createdAt?: string;
}

export interface Session {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  emoji: string;
  tint: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: Pick<Category, 'id' | 'name' | 'slug' | 'emoji'> | string;
  brand: string;
  price: number;
  mrp: number;
  unit: string;
  stock: number;
  emoji: string;
  tint: string;
  tags: string[];
  isActive: boolean;
  discountPercent: number;
}

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  price: number;
  mrp: number;
  unit: string;
  stock: number;
  emoji: string;
  tint: string;
  quantity: number;
  lineTotal: number;
}

export interface Coupon {
  id?: string;
  code: string;
  description: string;
  type: 'percent' | 'flat';
  value: number;
  minOrder: number;
  maxDiscount: number;
  expiresAt?: string | null;
  usageLimit?: number;
  usedCount?: number;
  isActive?: boolean;
  discount?: number;
}

export interface Cart {
  items: CartItem[];
  coupon: Coupon | null;
  couponMessage: string | null;
  itemCount: number;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  freeDeliveryAbove: number;
  deliveryFeeAmount: number;
}

export interface Address {
  id: string;
  label: 'Home' | 'Work' | 'Other';
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  productId: string;
  name: string;
  slug: string;
  emoji: string;
  tint: string;
  unit: string;
  price: number;
  mrp: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  address: {
    label?: string;
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
  };
  couponCode: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  paymentMethod: 'cod' | 'razorpay';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cod';
  status: OrderStatus;
  notes: string;
  timeline: { status: string; note: string; at: string }[];
  user: { id: string; name: string; phone?: string; email?: string } | string | null;
  deliveryPartner: { id: string; name: string; phone?: string } | string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  link: string;
  createdAt: string;
}

export interface DashboardData {
  revenue: number;
  orders: number;
  discount: number;
  averageOrderValue: number;
  todayRevenue: number;
  todayOrders: number;
  ordersByStatus: { status: string; count: number; revenue: number }[];
  usersByRole: { role: string; count: number }[];
  lowStock: { id: string; name: string; stock: number; unit: string; emoji: string; price: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  recentOrders: { id: string; orderNumber: string; status: string; total: number; customer: string; createdAt: string }[];
}

export interface ReportData {
  from: string;
  to: string;
  revenue: number;
  orders: number;
  discount: number;
  averageOrderValue: number;
  newCustomers: number;
  ordersByStatus: { status: string; count: number; revenue: number }[];
  ordersByDay: { date: string; orders: number; revenue: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
}

export interface PaymentPayload {
  mode: 'demo' | 'live' | 'free';
  keyId?: string | null;
  razorpayOrderId?: string;
  amount: number;
  currency: string;
  orderId: string;
  orderNumber?: string;
  customer?: { name: string; email: string; phone: string };
  order?: Order;
}
