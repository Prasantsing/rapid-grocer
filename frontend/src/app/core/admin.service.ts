import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ApiResponse,
  Category,
  Coupon,
  DashboardData,
  Order,
  Page,
  Product,
  ReportData,
  User,
} from './models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  dashboard() {
    return this.unwrap(this.http.get<ApiResponse<DashboardData>>('/api/v1/admin/dashboard'));
  }

  report(from?: string, to?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.unwrap(this.http.get<ApiResponse<ReportData>>('/api/v1/admin/reports', { params }));
  }

  permissions() {
    return this.unwrap(this.http.get<ApiResponse<{ permissions: string[]; roles: Record<string, string[]> }>>('/api/v1/admin/permissions'));
  }

  products(search = '') {
    const params = new HttpParams().set('limit', '60').set('search', search);
    return this.unwrap(this.http.get<ApiResponse<Page<Product>>>('/api/v1/admin/products', { params }));
  }

  saveProduct(payload: object, id?: string) {
    const request = id
      ? this.http.patch<ApiResponse<Product>>(`/api/v1/admin/products/${id}`, payload)
      : this.http.post<ApiResponse<Product>>('/api/v1/admin/products', payload);
    return this.unwrap(request);
  }

  archiveProduct(id: string) {
    return this.unwrap(this.http.delete<ApiResponse<{ archived: boolean }>>(`/api/v1/admin/products/${id}`));
  }

  categories() {
    return this.unwrap(this.http.get<ApiResponse<Category[]>>('/api/v1/admin/categories'));
  }

  saveCategory(payload: object, id?: string) {
    const request = id
      ? this.http.patch<ApiResponse<Category>>(`/api/v1/admin/categories/${id}`, payload)
      : this.http.post<ApiResponse<Category>>('/api/v1/admin/categories', payload);
    return this.unwrap(request);
  }

  archiveCategory(id: string) {
    return this.unwrap(this.http.delete<ApiResponse<{ archived: boolean }>>(`/api/v1/admin/categories/${id}`));
  }

  users(query: { role?: string; search?: string; page?: number } = {}) {
    let params = new HttpParams().set('limit', '40');
    for (const [key, value] of Object.entries(query)) {
      if (value) params = params.set(key, String(value));
    }
    return this.unwrap(this.http.get<ApiResponse<Page<User>>>('/api/v1/admin/users', { params }));
  }

  createUser(payload: object) {
    return this.unwrap(this.http.post<ApiResponse<User>>('/api/v1/admin/users', payload));
  }

  updateUser(id: string, payload: object) {
    return this.unwrap(this.http.patch<ApiResponse<User>>(`/api/v1/admin/users/${id}`, payload));
  }

  coupons() {
    return this.unwrap(this.http.get<ApiResponse<Coupon[]>>('/api/v1/admin/coupons'));
  }

  saveCoupon(payload: object, id?: string) {
    const request = id
      ? this.http.patch<ApiResponse<Coupon>>(`/api/v1/admin/coupons/${id}`, payload)
      : this.http.post<ApiResponse<Coupon>>('/api/v1/admin/coupons', payload);
    return this.unwrap(request);
  }

  archiveCoupon(id: string) {
    return this.unwrap(this.http.delete<ApiResponse<Coupon>>(`/api/v1/admin/coupons/${id}`));
  }

  orders(query: { status?: string; search?: string } = {}) {
    let params = new HttpParams().set('limit', '40');
    if (query.status) params = params.set('status', query.status);
    if (query.search) params = params.set('search', query.search);
    return this.unwrap(this.http.get<ApiResponse<Page<Order>>>('/api/v1/orders', { params }));
  }

  assign(orderId: string, deliveryPartnerId: string) {
    return this.unwrap(this.http.patch<ApiResponse<Order>>(`/api/v1/orders/${orderId}/assign`, { deliveryPartnerId }));
  }

  private unwrap<T>(request: import('rxjs').Observable<ApiResponse<T>>) {
    return firstValueFrom(request).then((response) => response.data);
  }
}
