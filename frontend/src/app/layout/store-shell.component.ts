import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { SearchBarComponent } from '../shared/search-bar.component';
import { PwaInstallComponent } from '../shared/pwa-install.component';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-store-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SearchBarComponent, PwaInstallComponent, InrPipe],
  template: `
    <header class="store-header">
      <div class="container py-2 d-flex align-items-center gap-2 gap-md-3">
        <a class="brand" routerLink="/">
          <span class="brand-mark">
            <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">
              <path d="M16 40c0-12 10-22 22-22 1 8-2 13-7 16 8 0 14 5 15 13H22c-3 0-6-3-6-7z" fill="#f0b429"/>
            </svg>
          </span>
          <span class="brand-word">ZapBasket<small>12-minute groceries</small></span>
        </a>
        <a class="location-chip d-none d-md-inline-flex" routerLink="/addresses">
          <i class="bi bi-geo-alt"></i>
          <span>{{ place() }}</span>
        </a>
        <app-search-bar />
        <app-pwa-install />
        <a class="icon-btn" routerLink="/notifications" aria-label="Notifications">
          <i class="bi bi-bell"></i>
          @if (shop.unread() > 0) { <span class="count">{{ shop.unread() }}</span> }
        </a>
        <a class="icon-btn d-none d-md-inline-flex" routerLink="/wishlist" aria-label="Wishlist">
          <i class="bi bi-heart"></i>
        </a>
        <a class="icon-btn cart-link" routerLink="/cart" aria-label="Cart">
          <i class="bi bi-basket"></i>
          @if ((shop.cart()?.itemCount || 0) > 0) { <span class="count">{{ shop.cart()?.itemCount }}</span> }
        </a>
        @if (auth.user(); as user) {
          <details class="account-menu d-none d-md-block">
            <summary class="location-chip">{{ user.name.split(' ')[0] }}</summary>
            <div class="panel account-pop">
              @if (user.role === 'admin') { <a routerLink="/admin">Store desk</a> }
              @if (user.role === 'delivery') { <a routerLink="/delivery">Deliveries</a> }
              <a routerLink="/account">Account</a>
              <a routerLink="/orders">Orders</a>
              <button type="button" (click)="logout()">Log out</button>
            </div>
          </details>
        } @else {
          <a class="location-chip d-none d-md-inline-flex" routerLink="/login">Log in</a>
        }
      </div>

      <!-- Mobile Location & Speed Sub-bar -->
      <div class="mobile-subbar d-flex d-md-none align-items-center justify-content-between px-3 py-1 border-top">
        <a class="mobile-loc-pill text-decoration-none d-flex align-items-center gap-1 text-truncate" routerLink="/addresses">
          <i class="bi bi-geo-alt-fill text-warning"></i>
          <span class="loc-text text-truncate">{{ place() }}</span>
          <i class="bi bi-chevron-down text-muted small flex-shrink-0"></i>
        </a>
        <span class="delivery-time-badge flex-shrink-0">
          <i class="bi bi-lightning-charge-fill text-warning"></i> 12 Mins
        </span>
      </div>

      <!-- Live Store Operational Status Banner -->
      @if (shop.storeConfig() && !shop.storeConfig()?.isCurrentlyOpen) {
        <div class="store-closed-banner bg-warning-subtle text-dark border-top border-bottom px-3 py-1 text-center small">
          <i class="bi bi-clock-history me-1 text-warning-emphasis"></i>
          <span>{{ shop.storeConfig()?.closedReason || 'Store currently closed. Delivery resumes during operating hours.' }}</span>
        </div>
      }
    </header>

    <main class="container page">
      <router-outlet />
    </main>

    <!-- Storefront Customer & Legal Footer -->
    <footer class="store-footer mt-5 pt-5 pb-4 border-top">
      <div class="container">
        <div class="row g-4 mb-4">
          <!-- Col 1: Brand & FSSAI / GST -->
          <div class="col-lg-4 col-md-6">
            <a class="brand d-inline-flex align-items-center gap-2 mb-3 text-decoration-none text-dark" routerLink="/">
              <span class="brand-mark bg-warning text-dark"><i class="bi bi-lightning-charge-fill"></i></span>
              <span class="brand-word fs-4 fw-bold">ZapBasket</span>
            </a>
            <p class="text-muted small mb-3 leading-relaxed">
              Hyperlocal rapid grocery delivery across Bengaluru. Fresh farm produce, daily essentials, and cold-pressed staples delivered to your doorstep in 12 minutes.
            </p>
            <div class="d-flex flex-column gap-1 text-muted small" style="font-size: 0.78rem;">
              <div><b>FSSAI Lic. No:</b> 11224333000542</div>
              <div><b>GSTIN:</b> 29AABCZ9101F1Z8</div>
              <div><b>Operating Hub:</b> Koramangala 4th Block, Bengaluru 560034</div>
            </div>
          </div>

          <!-- Col 2: Quick Links & Categories -->
          <div class="col-lg-2 col-md-6 col-6">
            <h6 class="fw-bold text-dark mb-3">Categories</h6>
            <ul class="list-unstyled d-flex flex-column gap-2 small">
              <li><a routerLink="/c/fresh-produce" class="text-secondary text-decoration-none">Fresh Veggies & Fruits</a></li>
              <li><a routerLink="/c/dairy-bread" class="text-secondary text-decoration-none">Dairy, Bread & Eggs</a></li>
              <li><a routerLink="/c/snacks-munchies" class="text-secondary text-decoration-none">Snacks & Beverages</a></li>
              <li><a routerLink="/c/staples" class="text-secondary text-decoration-none">Atta, Rice & Dal</a></li>
              <li><a routerLink="/c/instant-food" class="text-secondary text-decoration-none">Instant Foods & Noodles</a></li>
            </ul>
          </div>

          <!-- Col 3: Customer Care & Support -->
          <div class="col-lg-3 col-md-6 col-6">
            <h6 class="fw-bold text-dark mb-3">Customer Desk</h6>
            <ul class="list-unstyled d-flex flex-column gap-2 small">
              <li><a routerLink="/orders" class="text-secondary text-decoration-none">Track Orders</a></li>
              <li><a routerLink="/addresses" class="text-secondary text-decoration-none">Saved Addresses</a></li>
              <li><a routerLink="/account" class="text-secondary text-decoration-none">Account Profile</a></li>
              <li>
                <a href="tel:+919101516662" class="text-secondary text-decoration-none">
                  <i class="bi bi-telephone me-1 text-success"></i> +91 9101516662
                </a>
              </li>
              <li>
                <a href="https://wa.me/919101516662?text=Hi%20ZapBasket%20Support" target="_blank" rel="noopener" class="text-secondary text-decoration-none">
                  <i class="bi bi-whatsapp me-1 text-success"></i> WhatsApp Chat Desk
                </a>
              </li>
            </ul>
          </div>

          <!-- Col 4: Legal & Gateway Compliance -->
          <div class="col-lg-3 col-md-6">
            <h6 class="fw-bold text-dark mb-3">Legal & Compliance</h6>
            <ul class="list-unstyled d-flex flex-column gap-2 small">
              <li><a routerLink="/terms" class="text-secondary text-decoration-none">Terms of Service</a></li>
              <li><a routerLink="/privacy" class="text-secondary text-decoration-none">Privacy Policy (DPDP 2023)</a></li>
              <li><a routerLink="/refund-policy" class="text-secondary text-decoration-none">Refund & Cancellation SLA</a></li>
              <li><a routerLink="/legal/fssai" class="text-secondary text-decoration-none">Food Safety & Licensing</a></li>
              <li><a routerLink="/contact" class="text-secondary text-decoration-none">Grievance Redressal</a></li>
            </ul>
          </div>
        </div>

        <!-- Sub-footer & Payment Trust Icons -->
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 pt-3 border-top text-muted small" style="font-size: 0.78rem;">
          <div>
            © 2026 ZapBasket Rapid Retail LLP · All rights reserved.
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="text-muted"><i class="bi bi-shield-check text-success me-1"></i>100% Secure Payments</span>
            <span aria-hidden="true">·</span>
            <span>UPI</span>
            <span aria-hidden="true">·</span>
            <span>RuPay</span>
            <span aria-hidden="true">·</span>
            <span>Cards</span>
            <span aria-hidden="true">·</span>
            <span>NetBanking</span>
          </div>
        </div>
      </div>
    </footer>

    <!-- Floating Cart Quick Action Pill (Mobile Viewports) -->
    @if ((shop.cart()?.itemCount || 0) > 0 && !isCartOrCheckout()) {
      <aside class="floating-cart-bar" aria-label="Quick View Cart">
        <a routerLink="/cart" class="floating-cart-inner">
          <div class="d-flex align-items-center gap-2">
            <div class="floating-cart-badge">
              <i class="bi bi-basket2-fill"></i>
              <span>{{ shop.cart()?.itemCount }} {{ shop.cart()?.itemCount === 1 ? 'item' : 'items' }}</span>
            </div>
            <span class="floating-cart-divider">·</span>
            <strong class="floating-cart-total">{{ (shop.cart()?.total || 0) | inr }}</strong>
          </div>
          <div class="floating-cart-cta">
            <span>View Cart</span>
            <i class="bi bi-arrow-right"></i>
          </div>
        </a>
      </aside>
    }

    <nav class="mobile-nav" role="navigation" aria-label="Mobile Navigation">
      <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">
        <i class="bi bi-house"></i>
        <span>Home</span>
      </a>
      <a routerLink="/orders" routerLinkActive="on">
        <i class="bi bi-receipt"></i>
        <span>Orders</span>
      </a>
      <a routerLink="/cart" routerLinkActive="on" class="mobile-cart-tab">
        <div class="cart-icon-wrap">
          <i class="bi bi-basket"></i>
          @if ((shop.cart()?.itemCount || 0) > 0) {
            <span class="mobile-count">{{ shop.cart()?.itemCount }}</span>
          }
        </div>
        <span>Cart</span>
      </a>
      <a routerLink="/account" routerLinkActive="on">
        <i class="bi bi-person"></i>
        <span>You</span>
      </a>
    </nav>
  `,
})
export class StoreShell {
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  readonly place = computed(() => {
    const address = this.shop.addresses().find((item) => item.isDefault) ?? this.shop.addresses()[0];
    if (!address) return 'Add address';
    return `${address.label} · ${address.city}`;
  });

  readonly isCartOrCheckout = computed(() => {
    const url = this.router.url;
    return url.includes('/cart') || url.includes('/checkout');
  });

  constructor() {
    void this.shop.loadStoreConfig();
    effect(() => {
      const user = this.auth.user();
      if (!user) return;
      if (user.permissions.includes('cart:manage')) void this.shop.loadCart();
      if (user.permissions.includes('wishlist:manage')) void this.shop.loadWishlist();
      if (user.permissions.includes('addresses:manage')) void this.shop.loadAddresses();
      if (user.permissions.includes('notifications:read')) void this.shop.loadNotifications();
    });
  }

  async logout() {
    await this.auth.logout();
    this.shop.reset();
    this.toasts.show('Logged out successfully');
    await this.router.navigate(['/']);
  }
}
