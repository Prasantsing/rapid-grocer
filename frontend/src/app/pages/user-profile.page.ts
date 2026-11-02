import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { FcmService } from '../core/fcm.service';
import { ThemeService } from '../core/theme.service';
import { Address, Order } from '../core/models';
import { errorMessage } from '../core/http-error';
import { AddressFormComponent } from '../shared/address-form.component';
import { OrderProgressBarComponent } from '../shared/order-progress-bar.component';
import { InrPipe } from '../shared/inr.pipe';
import { STATUS_LABEL } from '../shared/status';

type ProfileTab = 'orders' | 'addresses' | 'settings';
type OrderFilter = 'all' | 'active' | 'delivered' | 'cancelled';

@Component({
  selector: 'app-user-profile-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    UpperCasePipe,
    DatePipe,
    InrPipe,
    AddressFormComponent,
    OrderProgressBarComponent,
  ],
  template: `
    @if (auth.user(); as user) {
      <div class="user-profile-layout pb-5">
        <!-- Top Profile Hero Banner -->
        <div class="profile-hero-card mb-4">
          <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div class="d-flex align-items-center gap-3">
              <div class="profile-avatar-wrapper">
                <div class="avatar-initials">
                  {{ userInitials(user.name) }}
                </div>
                <span class="avatar-role-badge" [title]="user.role">
                  <i class="bi bi-patch-check-fill text-success"></i>
                </span>
              </div>
              <div>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  <h1 class="h3 fw-bold mb-0 text-dark">{{ user.name }}</h1>
                  <span class="badge rounded-pill bg-emerald-subtle text-emerald border border-emerald-subtle text-uppercase fw-semibold px-2 py-1" style="font-size: 0.72rem;">
                    {{ user.role }}
                  </span>
                  @if (user.role === 'admin') {
                    <a routerLink="/admin" class="badge rounded-pill bg-primary text-white text-decoration-none px-2 py-1" style="font-size: 0.72rem;">
                      <i class="bi bi-speedometer2 me-1"></i> Admin Desk
                    </a>
                  }
                  @if (user.role === 'delivery') {
                    <a routerLink="/delivery" class="badge rounded-pill bg-warning text-dark text-decoration-none px-2 py-1" style="font-size: 0.72rem;">
                      <i class="bi bi-bicycle me-1"></i> Rider Desk
                    </a>
                  }
                </div>
                <div class="d-flex flex-wrap align-items-center gap-3 mt-1 text-muted small">
                  <span><i class="bi bi-envelope me-1"></i>{{ user.email }}</span>
                  @if (user.phone) {
                    <span>•</span>
                    <span><i class="bi bi-telephone me-1"></i>+91 {{ user.phone }}</span>
                  }
                  <span>•</span>
                  <span><i class="bi bi-shield-check text-success me-1"></i>Verified Member</span>
                </div>
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div class="d-flex align-items-center gap-2 flex-wrap mt-2 mt-md-0">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary rounded-pill px-3"
                (click)="setTab('settings')"
              >
                <i class="bi bi-pencil-square me-1"></i> Edit Profile
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-danger rounded-pill px-3"
                (click)="logout()"
              >
                <i class="bi bi-box-arrow-right me-1"></i> Logout
              </button>
            </div>
          </div>

          <!-- Quick Stats Row -->
          <div class="profile-stats-grid mt-4 pt-3 border-top">
            <div class="stat-box" role="button" (click)="setTab('orders')">
              <div class="stat-icon text-primary bg-primary-subtle">
                <i class="bi bi-bag-check-fill"></i>
              </div>
              <div>
                <div class="stat-value">{{ orders().length }}</div>
                <div class="stat-label">Total Orders</div>
              </div>
            </div>

            <div class="stat-box" role="button" (click)="setTab('addresses')">
              <div class="stat-icon text-success bg-success-subtle">
                <i class="bi bi-geo-alt-fill"></i>
              </div>
              <div>
                <div class="stat-value">{{ addresses().length }}</div>
                <div class="stat-label">Saved Addresses</div>
              </div>
            </div>

            <div class="stat-box" role="button" routerLink="/wishlist">
              <div class="stat-icon text-danger bg-danger-subtle">
                <i class="bi bi-heart-fill"></i>
              </div>
              <div>
                <div class="stat-value">{{ shop.wishlistIds().length }}</div>
                <div class="stat-label">Wishlist Items</div>
              </div>
            </div>

            <div class="stat-box" role="button" routerLink="/notifications">
              <div class="stat-icon text-warning bg-warning-subtle">
                <i class="bi bi-bell-fill"></i>
              </div>
              <div>
                <div class="stat-value">{{ shop.unread() }}</div>
                <div class="stat-label">Unread Alerts</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs (Segmented Control) -->
        <div class="profile-tabs-nav mb-4">
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab() === 'orders'"
            (click)="setTab('orders')"
          >
            <i class="bi bi-receipt me-1"></i>
            <span>Order History</span>
            <span class="tab-count-badge">{{ orders().length }}</span>
          </button>

          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab() === 'addresses'"
            (click)="setTab('addresses')"
          >
            <i class="bi bi-geo-alt me-1"></i>
            <span>Delivery Addresses</span>
            <span class="tab-count-badge">{{ addresses().length }}</span>
          </button>

          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab() === 'settings'"
            (click)="setTab('settings')"
          >
            <i class="bi bi-gear me-1"></i>
            <span>Profile Settings</span>
          </button>
        </div>

        <!-- ========================================== -->
        <!-- TAB 1: ORDER HISTORY -->
        <!-- ========================================== -->
        @if (activeTab() === 'orders') {
          <div class="orders-tab-container">
            <!-- Filter Bar & Search -->
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div class="order-filter-pills d-flex align-items-center gap-2 flex-wrap">
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.btn-dark]="orderFilter() === 'all'"
                  [class.btn-outline-secondary]="orderFilter() !== 'all'"
                  (click)="orderFilter.set('all')"
                >
                  All ({{ orders().length }})
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.btn-dark]="orderFilter() === 'active'"
                  [class.btn-outline-secondary]="orderFilter() !== 'active'"
                  (click)="orderFilter.set('active')"
                >
                  Active Runs ({{ activeOrdersCount() }})
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.btn-dark]="orderFilter() === 'delivered'"
                  [class.btn-outline-secondary]="orderFilter() !== 'delivered'"
                  (click)="orderFilter.set('delivered')"
                >
                  Delivered ({{ deliveredOrdersCount() }})
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.btn-dark]="orderFilter() === 'cancelled'"
                  [class.btn-outline-secondary]="orderFilter() !== 'cancelled'"
                  (click)="orderFilter.set('cancelled')"
                >
                  Cancelled ({{ cancelledOrdersCount() }})
                </button>
              </div>

              <div class="order-search-box">
                <div class="input-group input-group-sm">
                  <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
                  <input
                    type="text"
                    class="form-control border-start-0"
                    placeholder="Search by order #..."
                    [ngModel]="orderSearch()"
                    (ngModelChange)="orderSearch.set($event)"
                  />
                  @if (orderSearch()) {
                    <button class="btn btn-outline-secondary border-start-0" type="button" (click)="orderSearch.set('')">
                      <i class="bi bi-x-lg"></i>
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Loading State -->
            @if (loadingOrders()) {
              <div class="text-center py-5">
                <div class="spinner-border text-success" role="status">
                  <span class="visually-hidden">Loading orders...</span>
                </div>
                <p class="text-muted small mt-2">Loading your grocery order history…</p>
              </div>
            } @else if (filteredOrders().length === 0) {
              <!-- Empty Orders State -->
              <div class="empty-state-panel text-center py-5">
                <div class="empty-icon-circle mx-auto mb-3">
                  <i class="bi bi-bag-x text-muted fs-1"></i>
                </div>
                <h3 class="h5 fw-bold text-dark mb-2">No orders found</h3>
                <p class="text-muted small max-w-sm mx-auto mb-4">
                  {{ orderSearch() ? 'No orders match your search query.' : 'You haven’t placed any rapid grocery deliveries in this tab yet.' }}
                </p>
                <a routerLink="/" class="btn btn-success rounded-pill px-4">
                  <i class="bi bi-lightning-charge-fill me-1"></i> Shop Fresh Groceries
                </a>
              </div>
            } @else {
              <!-- Orders List -->
              <div class="orders-grid d-flex flex-column gap-3">
                @for (order of filteredOrders(); track order.id) {
                  <article class="order-history-card">
                    <div class="order-card-header d-flex flex-wrap align-items-center justify-content-between gap-2 p-3 bg-light border-bottom">
                      <div class="d-flex align-items-center gap-3">
                        <div class="order-id-block">
                          <span class="text-muted small">ORDER ID</span>
                          <div class="fw-bold text-dark font-monospace">{{ order.orderNumber }}</div>
                        </div>
                        <div class="vr d-none d-sm-block"></div>
                        <div class="d-none d-sm-block">
                          <span class="text-muted small">PLACED ON</span>
                          <div class="text-dark small fw-medium">{{ order.createdAt | date:'d MMM y, h:mm a' }}</div>
                        </div>
                      </div>

                      <div class="d-flex align-items-center gap-3">
                        <span [class]="'status-pill ' + order.status">
                          <i [class]="statusIcon(order.status) + ' me-1'"></i>
                          {{ getStatusLabel(order.status) }}
                        </span>
                        <div class="text-end">
                          <span class="text-muted small d-block">TOTAL</span>
                          <span class="fw-bold text-dark fs-6">{{ order.total | inr }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="order-card-body p-3">
                      <!-- Live Progress Bar -->
                      <div class="mb-3">
                        <app-order-progress-bar [order]="order" [status]="order.status" [compact]="true" />
                      </div>

                      <!-- OTP Alert for Active Out For Delivery Runs -->
                      @if (order.status === 'out_for_delivery' && order.deliveryOtp?.code) {
                        <div class="alert alert-warning d-flex align-items-center justify-content-between py-2 px-3 mb-3 rounded-3" role="alert">
                          <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-key-fill fs-5 text-warning-emphasis"></i>
                            <div>
                              <strong class="d-block small">Delivery Confirmation OTP</strong>
                              <span class="small text-muted">Share this 4-digit code with your rider upon arrival:</span>
                            </div>
                          </div>
                          <span class="badge bg-dark font-monospace fs-5 px-3 py-1 letter-spacing-1">
                            {{ order.deliveryOtp?.code }}
                          </span>
                        </div>
                      }

                      <!-- Item Thumbnails Preview -->
                      <div class="order-items-preview mb-3">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                          @for (line of order.items.slice(0, 4); track $index) {
                            <div class="item-tag-chip">
                              <span class="item-qty-badge">{{ line.quantity }}×</span>
                              <span class="item-name-text text-truncate">{{ line.name || 'Grocery Item' }}</span>
                            </div>
                          }
                          @if (order.items.length > 4) {
                            <span class="badge bg-light text-muted border px-2 py-1 small">
                              +{{ order.items.length - 4 }} more
                            </span>
                          }
                        </div>
                      </div>

                      <!-- Footer Action Buttons -->
                      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-2 border-top">
                        <div class="small text-muted">
                          <span>Payment: <strong class="text-dark text-uppercase">{{ order.paymentMethod }}</strong></span>
                          <span class="mx-2">•</span>
                          <span>Items: <strong class="text-dark">{{ order.items.length }}</strong></span>
                        </div>

                        <div class="d-flex align-items-center gap-2">
                          <button
                            type="button"
                            class="btn btn-sm btn-outline-success rounded-pill"
                            (click)="reorderItems(order)"
                            [disabled]="reorderingId() === order.id"
                          >
                            @if (reorderingId() === order.id) {
                              <span class="spinner-border spinner-border-sm me-1"></span> Adding...
                            } @else {
                              <i class="bi bi-arrow-repeat me-1"></i> Repeat Basket
                            }
                          </button>
                          <a
                            [routerLink]="['/orders', order.id]"
                            class="btn btn-sm btn-dark rounded-pill px-3"
                          >
                            Track Run <i class="bi bi-arrow-right ms-1"></i>
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                }
              </div>
            }
          </div>
        }

        <!-- ========================================== -->
        <!-- TAB 2: SAVED ADDRESSES -->
        <!-- ========================================== -->
        @if (activeTab() === 'addresses') {
          <div class="addresses-tab-container">
            <!-- Header Bar -->
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
              <div>
                <h3 class="h5 fw-bold text-dark mb-0">Delivery Locations</h3>
                <p class="text-muted small mb-0">Manage addresses for fast 12-minute doorstep grocery delivery</p>
              </div>

              @if (!showAddressForm()) {
                <button
                  type="button"
                  class="btn btn-success btn-sm rounded-pill px-3"
                  (click)="openAddAddressForm()"
                >
                  <i class="bi bi-plus-lg me-1"></i> Add New Address
                </button>
              } @else {
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm rounded-pill px-3"
                  (click)="closeAddressForm()"
                >
                  <i class="bi bi-x-lg me-1"></i> Close Form
                </button>
              }
            </div>

            <!-- Inline Address Form Drawer / Panel -->
            @if (showAddressForm()) {
              <div class="address-form-drawer-card mb-4 p-4 rounded-4 border bg-white shadow-sm">
                <div class="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom">
                  <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-geo-alt-fill text-success fs-5"></i>
                    <h4 class="h6 fw-bold mb-0 text-dark">
                      {{ editingAddress() ? 'Edit Delivery Address' : 'Add New Delivery Address' }}
                    </h4>
                  </div>
                  <button type="button" class="btn-close" (click)="closeAddressForm()" aria-label="Close"></button>
                </div>

                <app-address-form
                  [initialAddress]="editingAddress()"
                  (saved)="onAddressSaved($event)"
                  (cancelled)="closeAddressForm()"
                />
              </div>
            }

            <!-- Address Cards Grid -->
            @if (loadingAddresses()) {
              <div class="text-center py-5">
                <div class="spinner-border text-success" role="status">
                  <span class="visually-hidden">Loading addresses...</span>
                </div>
                <p class="text-muted small mt-2">Loading saved delivery locations…</p>
              </div>
            } @else if (addresses().length === 0 && !showAddressForm()) {
              <!-- Empty Addresses State -->
              <div class="empty-state-panel text-center py-5">
                <div class="empty-icon-circle mx-auto mb-3">
                  <i class="bi bi-geo-alt text-muted fs-1"></i>
                </div>
                <h3 class="h5 fw-bold text-dark mb-2">No saved addresses yet</h3>
                <p class="text-muted small max-w-sm mx-auto mb-4">
                  Add your home, office, or secondary delivery address for 1-click checkout.
                </p>
                <button
                  type="button"
                  class="btn btn-success rounded-pill px-4"
                  (click)="openAddAddressForm()"
                >
                  <i class="bi bi-plus-lg me-1"></i> Add Your First Address
                </button>
              </div>
            } @else {
              <div class="row g-3">
                @for (addr of addresses(); track addr.id) {
                  <div class="col-md-6">
                    <div
                      class="address-card h-100 p-3 rounded-4 border bg-white position-relative"
                      [class.border-success]="addr.isDefault"
                      [class.shadow-sm]="addr.isDefault"
                    >
                      <div class="d-flex align-items-start justify-content-between mb-2">
                        <div class="d-flex align-items-center gap-2">
                          <span class="address-type-icon" [title]="addr.label">
                            <i [class]="addressTypeIcon(addr.label)"></i>
                          </span>
                          <div>
                            <strong class="text-dark">{{ addr.label }}</strong>
                            @if (addr.isDefault) {
                              <span class="badge bg-success ms-2" style="font-size: 0.65rem;">DEFAULT</span>
                            }
                          </div>
                        </div>

                        <!-- Dropdown Actions -->
                        <div class="d-flex align-items-center gap-1">
                          <button
                            type="button"
                            class="btn btn-sm btn-link text-muted p-1"
                            (click)="editAddress(addr)"
                            title="Edit Address"
                          >
                            <i class="bi bi-pencil-square"></i>
                          </button>
                          <button
                            type="button"
                            class="btn btn-sm btn-link text-danger p-1"
                            (click)="deleteAddress(addr)"
                            title="Delete Address"
                          >
                            <i class="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>

                      <div class="address-recipient-info mb-2 small text-muted">
                        <i class="bi bi-person me-1"></i>
                        <strong class="text-dark">{{ addr.fullName }}</strong>
                        <span class="mx-1">·</span>
                        <span>+91 {{ addr.phone }}</span>
                      </div>

                      <p class="address-lines mb-3 text-secondary small leading-snug">
                        {{ addr.line1 }},
                        @if (addr.landmark) { <span>Near {{ addr.landmark }}, </span> }
                        {{ addr.city }}, {{ addr.state }} - <strong>{{ addr.pincode }}</strong>
                      </p>

                      <div class="d-flex align-items-center justify-content-between pt-2 border-top mt-auto">
                        @if (!addr.isDefault) {
                          <button
                            type="button"
                            class="btn btn-sm btn-link text-decoration-none text-success p-0 fw-semibold"
                            (click)="makeDefaultAddress(addr)"
                          >
                            <i class="bi bi-check2-circle me-1"></i> Set as Default
                          </button>
                        } @else {
                          <span class="text-success small fw-medium">
                            <i class="bi bi-shield-check me-1"></i> Primary Drop Location
                          </span>
                        }

                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary rounded-pill py-0 px-2"
                          style="font-size: 0.72rem;"
                          (click)="editAddress(addr)"
                        >
                          Modify
                        </button>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- ========================================== -->
        <!-- TAB 3: PROFILE SETTINGS -->
        <!-- ========================================== -->
        @if (activeTab() === 'settings') {
          <div class="settings-tab-container">
            <div class="row g-4">
              <!-- Left Column: Personal Information Form -->
              <div class="col-lg-7">
                <div class="settings-card p-4 rounded-4 border bg-white shadow-sm mb-4">
                  <h3 class="h5 fw-bold text-dark mb-3">
                    <i class="bi bi-person-lines-fill text-success me-2"></i>Personal Details
                  </h3>
                  <p class="text-muted small mb-4">Update your profile identity and primary contact phone number.</p>

                  <form [formGroup]="profileForm" (ngSubmit)="saveProfile()">
                    <div class="mb-3">
                      <label class="form-label fw-semibold text-dark small" for="profName">Full Name</label>
                      <div class="input-group">
                        <span class="input-group-text bg-light border-end-0"><i class="bi bi-person text-muted"></i></span>
                        <input
                          id="profName"
                          class="form-control border-start-0"
                          formControlName="name"
                          placeholder="Your full name"
                        />
                      </div>
                    </div>

                    <div class="mb-3">
                      <label class="form-label fw-semibold text-dark small" for="profPhone">Mobile Number</label>
                      <div class="input-group">
                        <span class="input-group-text bg-light border-end-0">+91</span>
                        <input
                          id="profPhone"
                          class="form-control border-start-0"
                          formControlName="phone"
                          placeholder="98765 43210"
                          maxlength="10"
                        />
                      </div>
                      <span class="form-text small text-muted">Used for delivery partner OTP handoff and SMS receipts.</span>
                    </div>

                    <div class="mb-4">
                      <label class="form-label fw-semibold text-dark small">Email Address</label>
                      <input
                        class="form-control bg-light text-muted"
                        [value]="user.email"
                        disabled
                        readonly
                      />
                      <span class="form-text small text-muted">Account email is permanent and used for secure login.</span>
                    </div>

                    <div class="d-flex align-items-center justify-content-between pt-3 border-top">
                      <button
                        type="button"
                        class="btn btn-outline-secondary rounded-pill btn-sm px-3"
                        (click)="resetProfileForm(user)"
                        [disabled]="profileForm.pristine || savingProfile()"
                      >
                        Reset Changes
                      </button>

                      <button
                        type="submit"
                        class="btn btn-dark rounded-pill px-4"
                        [disabled]="profileForm.invalid || profileForm.pristine || savingProfile()"
                      >
                        @if (savingProfile()) {
                          <span class="spinner-border spinner-border-sm me-1"></span> Saving...
                        } @else {
                          <i class="bi bi-check2 me-1"></i> Save Profile
                        }
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <!-- Right Column: Notifications & Security Preferences -->
              <div class="col-lg-5">
                <!-- Push Notification Preferences Card -->
                <div class="settings-card p-4 rounded-4 border bg-white shadow-sm mb-4">
                  <div class="d-flex align-items-center gap-3 mb-3">
                    <div class="rounded-circle bg-warning-subtle text-warning d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                      <i class="bi bi-bell-fill fs-5"></i>
                    </div>
                    <div>
                      <h4 class="h6 fw-bold mb-0 text-dark">Live Order Alerts</h4>
                      <span class="text-muted small">Browser & mobile push alerts</span>
                    </div>
                  </div>

                  <p class="text-muted small mb-3">
                    Receive instant notifications when your order is packed, dispatched, and when the rider arrives at your doorstep with the OTP.
                  </p>

                  <div class="d-flex align-items-center justify-content-between p-3 rounded-3 bg-light border mb-3">
                    <div>
                      <strong class="d-block text-dark small">Web Push Service</strong>
                      <span class="text-muted" style="font-size: 0.76rem;">
                        Status: <span class="fw-semibold text-uppercase">{{ fcm.permissionStatus() }}</span>
                      </span>
                    </div>

                    @if (fcm.permissionStatus() === 'granted') {
                      <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill small">
                        <i class="bi bi-check-circle-fill me-1"></i> Active
                      </span>
                    } @else {
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-dark rounded-pill px-3"
                        (click)="requestPushPermission()"
                        [disabled]="fcm.isBusy()"
                      >
                        @if (fcm.isBusy()) {
                          <span class="spinner-border spinner-border-sm me-1"></span>
                        } @else {
                          <i class="bi bi-bell me-1"></i> Enable
                        }
                      </button>
                    }
                  </div>
                </div>

                <!-- Theme Mode Card -->
                <div class="settings-card p-4 rounded-4 border bg-white shadow-sm mb-4">
                  <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center gap-3">
                      <div class="rounded-circle bg-info-subtle text-info d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                        <i class="bi bi-moon-stars-fill fs-5"></i>
                      </div>
                      <div>
                        <h4 class="h6 fw-bold mb-0 text-dark">Appearance Theme</h4>
                        <span class="text-muted small">Current: {{ themeService.theme() | uppercase }}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary rounded-pill px-3"
                      (click)="themeService.toggleTheme()"
                    >
                      <i class="bi" [class.bi-sun-fill]="themeService.theme() === 'dark'" [class.bi-moon-stars-fill]="themeService.theme() === 'light'"></i>
                      Switch
                    </button>
                  </div>
                </div>

                <!-- Security & Encryption Badge -->
                <div class="settings-card p-3 rounded-4 border bg-light text-center">
                  <div class="d-flex align-items-center justify-content-center gap-2 text-muted small">
                    <i class="bi bi-shield-lock-fill text-success fs-5"></i>
                    <span>Protected by 256-Bit SSL & Tokenized Sessions</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    } @else {
      <!-- Guest State -->
      <div class="text-center py-5">
        <div class="empty-icon-circle mx-auto mb-3">
          <i class="bi bi-person-lock text-muted fs-1"></i>
        </div>
        <h2 class="h4 fw-bold mb-2">Please sign in to view your profile</h2>
        <p class="text-muted small mb-4">Access your orders, saved delivery addresses, and settings in one place.</p>
        <a routerLink="/login" class="btn btn-success rounded-pill px-4">
          <i class="bi bi-box-arrow-in-right me-1"></i> Sign In to ZapBasket
        </a>
      </div>
    }
  `,
  styles: [`
    .user-profile-layout {
      max-width: 1040px;
      margin: 0 auto;
    }

    /* Hero Profile Card */
    .profile-hero-card {
      background: #ffffff;
      border: 1px solid #e8e3d6;
      border-radius: 24px;
      padding: 1.75rem 2rem;
      box-shadow: 0 4px 20px rgba(28, 25, 21, 0.04);
    }

    .profile-avatar-wrapper {
      position: relative;
    }

    .avatar-initials {
      width: 64px;
      height: 64px;
      border-radius: 20px;
      background: linear-gradient(135deg, #0e6b4f 0%, #072a20 100%);
      color: #f6f1e4;
      display: grid;
      place-items: center;
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.6rem;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(14, 107, 79, 0.25);
    }

    .avatar-role-badge {
      position: absolute;
      bottom: -4px;
      right: -4px;
      background: #ffffff;
      border-radius: 50%;
      padding: 2px;
      font-size: 0.9rem;
      line-height: 1;
    }

    .bg-emerald-subtle {
      background-color: #d1fae5;
    }

    .text-emerald {
      color: #065f46;
    }

    .border-emerald-subtle {
      border-color: #a7f3d0;
    }

    /* Stats Grid */
    .profile-stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    @media (max-width: 768px) {
      .profile-stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .profile-hero-card {
        padding: 1.25rem 1.25rem;
      }
    }

    .stat-box {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.75rem 1rem;
      border-radius: 16px;
      background: #fbf9f4;
      border: 1px solid #f0ebe1;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .stat-box:hover {
      background: #ffffff;
      border-color: #0e6b4f;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(14, 107, 79, 0.08);
    }

    .stat-icon {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-size: 1.1rem;
      flex-shrink: 0;
    }

    .stat-value {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: #1c1915;
      line-height: 1.1;
    }

    .stat-label {
      font-size: 0.74rem;
      color: #7b7466;
      font-weight: 500;
    }

    /* Tabs Segmented Control */
    .profile-tabs-nav {
      display: flex;
      background: #f3efe4;
      padding: 5px;
      border-radius: 16px;
      gap: 6px;
      overflow-x: auto;
    }

    .tab-btn {
      flex: 1;
      min-width: max-content;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border: 0;
      background: transparent;
      color: #6a6458;
      font-weight: 600;
      font-size: 0.9rem;
      padding: 0.7rem 1.25rem;
      border-radius: 12px;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .tab-btn:hover {
      color: #1c1915;
    }

    .tab-btn.active {
      background: #ffffff;
      color: #0e6b4f;
      box-shadow: 0 2px 8px rgba(28, 25, 21, 0.08);
    }

    .tab-count-badge {
      font-size: 0.72rem;
      background: rgba(14, 107, 79, 0.12);
      color: #0e6b4f;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
    }

    /* Order History Cards */
    .order-history-card {
      background: #ffffff;
      border: 1px solid #e8e3d6;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(28, 25, 21, 0.03);
      transition: all 0.2s ease;
    }

    .order-history-card:hover {
      box-shadow: 0 6px 18px rgba(28, 25, 21, 0.07);
      border-color: #d1c8b8;
    }

    .item-tag-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #fbf9f4;
      border: 1px solid #e8e3d6;
      border-radius: 999px;
      padding: 3px 10px;
      font-size: 0.78rem;
    }

    .item-qty-badge {
      font-weight: 700;
      color: #0e6b4f;
    }

    .item-name-text {
      max-width: 140px;
      color: #3b362f;
      font-weight: 500;
    }

    /* Address Cards */
    .address-card {
      transition: all 0.2s ease;
    }

    .address-card:hover {
      border-color: #0e6b4f;
      transform: translateY(-2px);
      box-shadow: 0 4px 14px rgba(14, 107, 79, 0.08);
    }

    .address-type-icon {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: #f3efe4;
      display: grid;
      place-items: center;
      color: #0e6b4f;
      font-size: 0.95rem;
      flex-shrink: 0;
    }

    /* Empty States */
    .empty-state-panel {
      background: #ffffff;
      border: 1px dashed #d1c8b8;
      border-radius: 24px;
      padding: 3rem 1.5rem;
    }

    .empty-icon-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: #fbf9f4;
      display: grid;
      place-items: center;
    }

    .max-w-sm {
      max-width: 380px;
    }
  `],
})
export class UserProfilePage implements OnInit {
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly fcm = inject(FcmService);
  readonly themeService = inject(ThemeService);

  readonly activeTab = signal<ProfileTab>('orders');
  readonly orderFilter = signal<OrderFilter>('all');
  readonly orderSearch = signal<string>('');

  readonly orders = signal<Order[]>([]);
  readonly loadingOrders = signal<boolean>(true);

  readonly addresses = signal<Address[]>([]);
  readonly loadingAddresses = signal<boolean>(true);

  readonly showAddressForm = signal<boolean>(false);
  readonly editingAddress = signal<Address | null>(null);

  readonly savingProfile = signal<boolean>(false);
  readonly reorderingId = signal<string | null>(null);

  readonly profileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.pattern(/^[6-9]\d{9}$/)]],
  });

  // Filtered Orders Computation
  readonly filteredOrders = computed(() => {
    let list = this.orders();
    const filter = this.orderFilter();
    const search = this.orderSearch().trim().toLowerCase();

    if (filter === 'active') {
      list = list.filter((o) => ['placed', 'confirmed', 'packed', 'out_for_delivery'].includes(o.status));
    } else if (filter === 'delivered') {
      list = list.filter((o) => o.status === 'delivered');
    } else if (filter === 'cancelled') {
      list = list.filter((o) => o.status === 'cancelled');
    }

    if (search) {
      list = list.filter((o) =>
        o.orderNumber.toLowerCase().includes(search) ||
        o.items.some((i) => (i.name || '').toLowerCase().includes(search))
      );
    }

    return list;
  });

  readonly activeOrdersCount = computed(() =>
    this.orders().filter((o) => ['placed', 'confirmed', 'packed', 'out_for_delivery'].includes(o.status)).length
  );

  readonly deliveredOrdersCount = computed(() =>
    this.orders().filter((o) => o.status === 'delivered').length
  );

  readonly cancelledOrdersCount = computed(() =>
    this.orders().filter((o) => o.status === 'cancelled').length
  );

  ngOnInit() {
    // 1. Parse query param for default tab (e.g. /profile?tab=addresses)
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab') as ProfileTab;
      if (tab && ['orders', 'addresses', 'settings'].includes(tab)) {
        this.activeTab.set(tab);
      }
    });

    // 2. Initialize profile form with current user data
    const user = this.auth.user();
    if (user) {
      this.resetProfileForm(user);
    }

    // 3. Load Orders and Addresses in parallel
    this.loadOrders();
    this.loadAddresses();
  }

  setTab(tab: ProfileTab) {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  async loadOrders() {
    this.loadingOrders.set(true);
    try {
      const res = await this.shop.orders();
      this.orders.set(res.items || []);
    } catch (err) {
      this.toast.error('Could not load order history: ' + errorMessage(err));
    } finally {
      this.loadingOrders.set(false);
    }
  }

  async loadAddresses() {
    this.loadingAddresses.set(true);
    try {
      const list = await this.shop.loadAddresses();
      this.addresses.set(list || []);
    } catch (err) {
      this.toast.error('Could not load saved addresses: ' + errorMessage(err));
    } finally {
      this.loadingAddresses.set(false);
    }
  }

  resetProfileForm(user: { name: string; phone?: string }) {
    this.profileForm.patchValue({
      name: user.name,
      phone: user.phone || '',
    });
    this.profileForm.markAsPristine();
  }

  async saveProfile() {
    if (this.profileForm.invalid) return;
    this.savingProfile.set(true);
    const { name, phone } = this.profileForm.getRawValue();
    try {
      await this.auth.updateProfile({ name, phone });
      this.profileForm.markAsPristine();
      this.toast.show('Your profile details have been saved.', 'ok');
    } catch (err) {
      this.toast.error('Failed to update profile: ' + errorMessage(err));
    } finally {
      this.savingProfile.set(false);
    }
  }

  openAddAddressForm() {
    this.editingAddress.set(null);
    this.showAddressForm.set(true);
  }

  editAddress(address: Address) {
    this.editingAddress.set(address);
    this.showAddressForm.set(true);
  }

  closeAddressForm() {
    this.showAddressForm.set(false);
    this.editingAddress.set(null);
  }

  async onAddressSaved(saved: Address) {
    this.closeAddressForm();
    await this.loadAddresses();
    this.toast.show(`Address "${saved.label}" saved successfully.`, 'ok');
  }

  async deleteAddress(address: Address) {
    const confirmDelete = window.confirm(`Are you sure you want to delete the "${address.label}" address?`);
    if (!confirmDelete) return;

    try {
      await this.shop.deleteAddress(address.id);
      this.addresses.update((list) => list.filter((a) => a.id !== address.id));
      this.toast.show(`Address "${address.label}" removed.`, 'ok');
    } catch (err) {
      this.toast.error('Could not remove address: ' + errorMessage(err));
    }
  }

  async makeDefaultAddress(address: Address) {
    try {
      await this.shop.saveAddress({ ...address, isDefault: true }, address.id);
      this.addresses.update((list) =>
        list.map((a) => ({ ...a, isDefault: a.id === address.id }))
      );
      this.toast.show(`"${address.label}" set as your default delivery address.`, 'ok');
    } catch (err) {
      this.toast.error('Could not set default address: ' + errorMessage(err));
    }
  }

  async reorderItems(order: Order) {
    this.reorderingId.set(order.id);
    let count = 0;
    try {
      for (const line of order.items) {
        if (line.productId) {
          await this.shop.addItem(line.productId, line.quantity);
          count++;
        }
      }
      this.toast.show(`Added ${count} items from ${order.orderNumber} to your basket!`, 'ok');
      this.router.navigate(['/cart']);
    } catch (err) {
      this.toast.error('Could not repeat order: ' + errorMessage(err));
    } finally {
      this.reorderingId.set(null);
    }
  }

  async requestPushPermission() {
    try {
      await this.fcm.requestPermissionAndRegister();
    } catch (err) {
      this.toast.error('Notification setup: ' + errorMessage(err));
    }
  }

  async logout() {
    await this.auth.logout();
    this.toast.show('You have logged out.', 'ok');
    this.router.navigate(['/']);
  }

  userInitials(name: string): string {
    if (!name) return 'Z';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  getStatusLabel(status: string): string {
    return STATUS_LABEL[status] || status;
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'placed':
        return 'bi-hourglass-split';
      case 'confirmed':
        return 'bi-check2-circle';
      case 'packed':
        return 'bi-box-seam';
      case 'out_for_delivery':
        return 'bi-bicycle';
      case 'delivered':
        return 'bi-check-all';
      case 'cancelled':
        return 'bi-x-circle';
      default:
        return 'bi-record-circle';
    }
  }

  addressTypeIcon(label: string): string {
    const l = (label || '').toLowerCase();
    if (l.includes('home')) return 'bi-house-door-fill text-success';
    if (l.includes('work') || l.includes('office')) return 'bi-briefcase-fill text-primary';
    return 'bi-geo-alt-fill text-warning';
  }
}
