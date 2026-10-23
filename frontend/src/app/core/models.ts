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
  imageUrl?: string;
  tags: string[];
  isActive: boolean;
  isReturnable?: boolean;
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
  isReturnable?: boolean;
  lineTotal: number;
}

export interface Coupon {
  id?: string;
  code: string;
  description: string;
  type: 'percent' | 'flat' | 'free_delivery';
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

export interface ReverseGeocodeResult {
  lat: number;
  lng: number;
  road: string;
  neighbourhood: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  formattedAddress: string;
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
  isReturnable?: boolean;
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
  paymentMethod: 'cod' | 'razorpay' | 'upi';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cod';
  upiId?: string;
  upiTransactionId?: string;
  upiApp?: string;
  gatewayVerification?: GatewayVerification | null;
  receiptVerification?: ReceiptVerification | null;
  status: OrderStatus;
  notes: string;
  timeline: { status: string; note: string; at: string }[];
  user: { id: string; name: string; phone?: string; email?: string } | string | null;
  deliveryPartner: { id: string; name: string; phone?: string } | string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptVerification {
  receiptImageUrl?: string;
  uploadedAt?: string | null;
  extractedOrderId?: string;
  extractedAmount?: number | null;
  extractedUtr?: string;
  extractedPayeeVpa?: string;
  extractedPayeeName?: string;
  extractedTimestamp?: string;
  extractedStatus?: string;
  appName?: string;
  isMatched: boolean;
  matchReason?: string;
  matchDetails?: {
    amountMatched: boolean;
    orderIdMatched: boolean;
    vpaMatched: boolean;
    utrFound: boolean;
  } | null;
  verificationStatus:
    | 'not_uploaded'
    | 'scanning'
    | 'verified'
    | 'mismatched'
    | 'manual_utr_submitted'
    | 'admin_approved'
    | 'admin_rejected';
  manualUtr?: string;
  adminReviewNote?: string;
  reviewedAt?: string | null;
}

export interface GatewayVerification {
  verified: boolean;
  verifiedAt?: string | null;
  gatewayTransactionId?: string;
  gatewayStatus?: string;
  utr?: string;
  source?: string;
}

export interface UpiPaymentDetails {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  upiId: string;
  payeeName: string;
  paymentStatus: string;
  orderStatus?: string;
  genericUri: string;
  gpayUri: string;
  phonepeUri: string;
  paytmUri: string;
  bhimUri?: string;
  qrCodeData: string;
}

export interface StoreConfig {
  isOpen: boolean;
  isCurrentlyOpen: boolean;
  inOperatingHours: boolean;
  currentTimeIst: string;
  closedReason: string;
  openingTime: string;
  closingTime: string;
  storeLocation: {
    lat: number;
    lng: number;
    address: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  deliveryRadiusKm: number;
  minOrderAmount: number;
  freeDeliveryThreshold: number;
  deliveryFee: number;
  upiVpa: string;
  payeeName: string;
  supportPhone?: string;
  supportEmail?: string;
  allowCustomerCancellation?: boolean;
  cancellationWindowMinutes?: number;
  allowDirectRiderContact?: boolean;
  nonReturnableNotice?: string;
  webhookSecret?: string;
  enableSmsAlerts?: boolean;
  enableWhatsAppAlerts?: boolean;
  smsProvider?: string;
  smsSenderId?: string;
  smsApiKey?: string;
  whatsAppProvider?: string;
  whatsAppApiKey?: string;
  whatsAppPhoneNumberId?: string;
  whatsAppFromNumber?: string;
  updatedAt?: string;
}

export interface MessageLog {
  id?: string;
  _id?: string;
  orderId?: string | null;
  orderNumber?: string;
  channel: 'sms' | 'whatsapp';
  recipientPhone: string;
  eventType: string;
  messageBody: string;
  status: 'sent' | 'simulated' | 'failed';
  provider: string;
  error?: string;
  createdAt: string;
}

export interface UpiStatusResponse {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: OrderStatus;
  isConfirmed: boolean;
  gatewayVerification?: GatewayVerification | null;
  upiId?: string;
  upiTransactionId?: string;
  upiApp?: string;
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

export interface InventoryKpi {
  totalSkus: number;
  totalUnits: number;
  outOfStockCount: number;
  lowStockCount: number;
  healthyStockCount: number;
  totalValuation: number;
  lowStockThreshold: number;
}

export interface InventoryItem extends Product {
  valuation: number;
  stockHealth: 'out_of_stock' | 'low_stock' | 'healthy';
  stockHealthLabel: string;
  stockHealthColor: 'danger' | 'warning' | 'success';
  stockPercent: number;
  hsn: string;
  gstRate: number;
}

export interface InventoryReviewData {
  kpi: InventoryKpi;
  items: InventoryItem[];
}

export interface StoreGstProfile {
  businessName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  cin: string;
  state: string;
  stateCode: string;
  address: string;
  email: string;
  phone: string;
  fssaiLicense: string;
  taxType: string;
}

export interface GstSummary {
  totalOrders: number;
  totalGrossTurnover: number;
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalGstCollected: number;
  netSales: number;
}

export interface GstSlabSummary {
  rate: number;
  label: string;
  hsn: string;
  itemsCount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  gross: number;
}

export interface GstInvoiceLineItem {
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  hsn: string;
  gstRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalGst: number;
  grossAmount: number;
}

export interface GstInvoiceLedgerEntry {
  id: string;
  invoiceNumber: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  paymentMethod: string;
  paymentStatus: string;
  itemsCount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalGst: number;
  grossAmount: number;
  items: GstInvoiceLineItem[];
}

export interface GstReportData {
  store: StoreGstProfile;
  period: {
    name: string;
    startDate: string;
    endDate: string;
  };
  summary: GstSummary;
  slabs: GstSlabSummary[];
  invoices: GstInvoiceLedgerEntry[];
}

