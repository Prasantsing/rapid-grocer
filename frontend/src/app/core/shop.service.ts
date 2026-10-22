import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Address,
  ApiResponse,
  Cart,
  Category,
  Coupon,
  NotificationItem,
  Order,
  Page,
  PaymentPayload,
  Product,
  ReverseGeocodeResult,
  UpiPaymentDetails,
  UpiStatusResponse,
} from './models';

@Injectable({ providedIn: 'root' })
export class ShopService {
  private readonly http = inject(HttpClient);
  readonly cart = signal<Cart | null>(null);
  readonly wishlistIds = signal<string[]>([]);
  readonly unread = signal(0);
  readonly addresses = signal<Address[]>([]);

  reset() {
    this.cart.set(null);
    this.wishlistIds.set([]);
    this.unread.set(0);
    this.addresses.set([]);
  }

  categories() {
    return this.unwrap(this.http.get<ApiResponse<Category[]>>('/api/v1/categories'));
  }

  products(query: { search?: string; category?: string; sort?: string; page?: number; limit?: number } = {}) {
    return this.unwrap(this.http.get<ApiResponse<Page<Product>>>('/api/v1/products', { params: this.params(query) }));
  }

  product(slug: string) {
    return this.unwrap(this.http.get<ApiResponse<Product>>(`/api/v1/products/${slug}`));
  }

  async loadCart() {
    const cart = await this.unwrap(this.http.get<ApiResponse<Cart>>('/api/v1/cart'));
    this.cart.set(cart);
    return cart;
  }

  async addItem(productId: string, quantity = 1) {
    const cart = await this.unwrap(this.http.post<ApiResponse<Cart>>('/api/v1/cart/items', { productId, quantity }));
    this.cart.set(cart);
    return cart;
  }

  async updateItem(productId: string, quantity: number) {
    const cart = await this.unwrap(this.http.patch<ApiResponse<Cart>>(`/api/v1/cart/items/${productId}`, { quantity }));
    this.cart.set(cart);
    return cart;
  }

  async applyCoupon(code: string) {
    const cart = await this.unwrap(this.http.post<ApiResponse<Cart>>('/api/v1/cart/coupon', { code }));
    this.cart.set(cart);
    return cart;
  }

  async removeCoupon() {
    const cart = await this.unwrap(this.http.delete<ApiResponse<Cart>>('/api/v1/cart/coupon'));
    this.cart.set(cart);
    return cart;
  }

  activeCoupons() {
    return this.unwrap(this.http.get<ApiResponse<Coupon[]>>('/api/v1/coupons/active'));
  }

  async loadWishlist() {
    const wishlist = await this.unwrap(this.http.get<ApiResponse<{ products: Product[]; ids: string[] }>>('/api/v1/wishlist'));
    this.wishlistIds.set(wishlist.ids);
    return wishlist;
  }

  async addWish(productId: string) {
    const wishlist = await this.unwrap(this.http.post<ApiResponse<{ products: Product[]; ids: string[] }>>(`/api/v1/wishlist/${productId}`, {}));
    this.wishlistIds.set(wishlist.ids);
    return wishlist;
  }

  async removeWish(productId: string) {
    const wishlist = await this.unwrap(this.http.delete<ApiResponse<{ products: Product[]; ids: string[] }>>(`/api/v1/wishlist/${productId}`));
    this.wishlistIds.set(wishlist.ids);
    return wishlist;
  }

  async loadAddresses() {
    const addresses = await this.unwrap(this.http.get<ApiResponse<Address[]>>('/api/v1/addresses'));
    this.addresses.set(addresses);
    return addresses;
  }

  async saveAddress(payload: Partial<Address>, id?: string) {
    const request = id
      ? this.http.patch<ApiResponse<Address>>(`/api/v1/addresses/${id}`, payload)
      : this.http.post<ApiResponse<Address>>('/api/v1/addresses', payload);
    await this.unwrap(request);
    return this.loadAddresses();
  }

  async deleteAddress(id: string) {
    await this.unwrap(this.http.delete<ApiResponse<{ deleted: boolean }>>(`/api/v1/addresses/${id}`));
    return this.loadAddresses();
  }

  reverseGeocode(lat: number, lng: number) {
    return this.unwrap(
      this.http.get<ApiResponse<ReverseGeocodeResult>>('/api/v1/addresses/reverse-geocode', {
        params: this.params({ lat, lng }),
      })
    );
  }

  placeOrder(payload: { addressId: string; paymentMethod: 'cod' | 'razorpay' | 'upi'; notes?: string }) {
    return this.unwrap(this.http.post<ApiResponse<Order>>('/api/v1/orders', payload));
  }

  orders(query: { scope?: string; status?: string; search?: string; page?: number } = {}) {
    return this.unwrap(this.http.get<ApiResponse<Page<Order>>>('/api/v1/orders', { params: this.params(query) }));
  }

  order(id: string) {
    return this.unwrap(this.http.get<ApiResponse<Order>>(`/api/v1/orders/${id}`));
  }

  cancelOrder(id: string) {
    return this.unwrap(this.http.post<ApiResponse<Order>>(`/api/v1/orders/${id}/cancel`, {}));
  }

  cancelAndRestoreCart(id: string, note?: string) {
    return this.unwrap(
      this.http.post<ApiResponse<{ cancelled: boolean; restoredItemsCount: number; order: Order }>>(
        `/api/v1/orders/${id}/cancel-restore`,
        { note }
      )
    );
  }

  switchToCod(id: string) {
    return this.unwrap(this.http.post<ApiResponse<Order>>(`/api/v1/orders/${id}/switch-to-cod`, {}));
  }

  acceptOrder(id: string) {
    return this.unwrap(this.http.post<ApiResponse<Order>>(`/api/v1/orders/${id}/accept`, {}));
  }

  updateOrderStatus(id: string, status: string, note?: string) {
    return this.unwrap(this.http.patch<ApiResponse<Order>>(`/api/v1/orders/${id}/status`, { status, note }));
  }

  createPayment(orderId: string) {
    return this.unwrap(this.http.post<ApiResponse<PaymentPayload>>('/api/v1/payments/razorpay/order', { orderId }));
  }

  verifyPayment(payload: { orderId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature?: string }) {
    return this.unwrap(this.http.post<ApiResponse<Order>>('/api/v1/payments/razorpay/verify', payload));
  }

  getUpiDetails(orderId: string) {
    return this.unwrap(this.http.get<ApiResponse<UpiPaymentDetails>>(`/api/v1/payments/upi/${orderId}`));
  }

  getUpiStatus(orderId: string) {
    return this.unwrap(this.http.get<ApiResponse<UpiStatusResponse>>(`/api/v1/payments/upi/${orderId}/status`));
  }

  submitUpiPayment(payload: { orderId: string; upiApp?: string; utr?: string; note?: string }) {
    return this.unwrap(
      this.http.post<ApiResponse<{ status: string; orderId: string; orderNumber: string; message: string; order: Order }>>(
        '/api/v1/payments/upi/submit',
        payload
      )
    );
  }

  pingGatewayCallback(payload: { orderId: string; utr?: string; gatewayStatus?: 'SUCCESS' | 'FAILED' }) {
    return this.unwrap(
      this.http.post<ApiResponse<{ verified: boolean; status: string; gatewayTransactionId: string; utr: string; order: Order }>>(
        '/api/v1/payments/upi/ping-gateway',
        payload
      )
    );
  }

  sendGatewayWebhook(payload: { orderId?: string; orderNumber?: string; utr?: string; gatewayTransactionId?: string; amount?: number; gatewayStatus?: 'SUCCESS' | 'FAILED' }) {
    return this.unwrap(
      this.http.post<ApiResponse<{ verified: boolean; status: string; gatewayTransactionId: string; utr: string; order: Order }>>(
        '/api/v1/payments/upi/callback',
        payload
      )
    );
  }

  verifyUpiPayment(payload: { orderId: string; upiApp?: string; utr?: string; status?: 'success' | 'failed'; note?: string }) {
    return this.unwrap(this.http.post<ApiResponse<{ verified: boolean; status: string; order: Order }>>('/api/v1/payments/upi/verify', payload));
  }

  verifyReceipt(orderId: string, image: string) {
    return this.unwrap(
      this.http.post<ApiResponse<{
        success: boolean;
        isMatched: boolean;
        matchReason: string;
        extracted: {
          amount: number | null;
          orderId: string;
          utr: string;
          payeeVpa: string;
          payeeName: string;
          paymentStatus: string;
          appName: string;
          isBlurryOrUnreadable: boolean;
          rejectionReason?: string;
        };
        matchDetails: {
          amountMatched: boolean;
          orderIdMatched: boolean;
          vpaMatched: boolean;
          utrFound: boolean;
        };
        order: Order;
      }>>(`/api/v1/orders/${orderId}/verify-receipt`, { image })
    );
  }

  submitManualUtr(orderId: string, utr: string, note?: string) {
    return this.unwrap(
      this.http.post<ApiResponse<{ success: boolean; message: string; order: Order }>>(
        `/api/v1/orders/${orderId}/manual-utr`,
        { utr, note }
      )
    );
  }

  getOrderInvoice(orderId: string) {
    return this.unwrap(this.http.get<ApiResponse<any>>(`/api/v1/orders/${orderId}/invoice`));
  }

  async loadNotifications() {
    const result = await this.unwrap(this.http.get<ApiResponse<{ items: NotificationItem[]; unread: number }>>('/api/v1/notifications'));
    this.unread.set(result.unread);
    return result;
  }

  async markAllRead() {
    await this.unwrap(this.http.post<ApiResponse<{ updated: boolean }>>('/api/v1/notifications/read-all', {}));
    this.unread.set(0);
  }

  async markRead(id: string) {
    await this.unwrap(this.http.patch<ApiResponse<NotificationItem>>(`/api/v1/notifications/${id}/read`, {}));
  }

  private params(query: object) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return params;
  }

  private unwrap<T>(request: import('rxjs').Observable<ApiResponse<T>>) {
    return firstValueFrom(request).then((response) => response.data);
  }
}
