import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ThemeService } from '../core/theme.service';
import { ToastService } from '../core/toast.service';
import { SearchBarComponent } from '../shared/search-bar.component';
import { PwaInstallComponent } from '../shared/pwa-install.component';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-store-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SearchBarComponent, PwaInstallComponent, InrPipe],
  template: `
    <header class="store-header">
      <!-- Desktop & Tablet Navigation Row (md and up) -->
      <div class="container py-2 d-none d-md-flex align-items-center gap-2 gap-md-3">
        <a class="brand text-decoration-none" routerLink="/">
          <span class="brand-mark">
            <img [src]="shop.logoUrl()" alt="ZapBasket Logo" class="brand-img" />
          </span>
          <span class="brand-word">ZapBasket<small>12-minute groceries</small></span>
        </a>
        <a class="location-chip" routerLink="/addresses">
          <i class="bi bi-geo-alt"></i>
          <span>{{ place() }}</span>
        </a>
        <app-search-bar />
        <app-pwa-install />
        
        <!-- Theme Toggle Button (Light / Dark) -->
        <button
          type="button"
          class="icon-btn theme-toggle-btn"
          (click)="themeService.toggleTheme()"
          [attr.aria-label]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          [title]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <i class="bi" [class.bi-sun-fill]="themeService.theme() === 'dark'" [class.bi-moon-stars-fill]="themeService.theme() === 'light'"></i>
        </button>

        <a class="icon-btn" routerLink="/notifications" aria-label="Notifications">
          <i class="bi bi-bell"></i>
          @if (shop.unread() > 0) { <span class="count">{{ shop.unread() }}</span> }
        </a>
        <a class="icon-btn" routerLink="/wishlist" aria-label="Wishlist">
          <i class="bi bi-heart"></i>
        </a>
        @if (!isCheckout()) {
          <a class="icon-btn cart-link" routerLink="/cart" aria-label="Cart">
            <i class="bi bi-basket"></i>
            @if ((shop.cart()?.itemCount || 0) > 0) { <span class="count">{{ shop.cart()?.itemCount }}</span> }
          </a>
        }
        @if (auth.user(); as user) {
          <details class="account-menu">
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
          <a class="location-chip" routerLink="/login">Log in</a>
        }
      </div>

      <!-- Mobile Tier 1: Brand Logo, Delivery Location & Quick Icons (d-md-none) -->
      <div class="container d-flex d-md-none align-items-center justify-content-between pt-2 pb-1 px-3">
        <div class="d-flex align-items-center gap-2 text-truncate" style="min-width: 0;">
          <a class="brand text-decoration-none flex-shrink-0" routerLink="/">
            <span class="brand-mark">
              <img [src]="shop.logoUrl()" alt="ZapBasket Logo" class="brand-img" />
            </span>
            <span class="brand-word">ZapBasket</span>
          </a>
          <a class="mobile-loc-pill text-decoration-none d-flex align-items-center gap-1 text-truncate" routerLink="/addresses">
            <i class="bi bi-geo-alt-fill text-warning"></i>
            <span class="loc-text text-truncate" style="max-width: 105px; font-size: 0.76rem;">{{ place() }}</span>
            <span class="delivery-time-badge" style="font-size: 0.65rem; padding: 1px 6px;"><i class="bi bi-lightning-charge-fill"></i> 12m</span>
          </a>
        </div>

        <div class="d-flex align-items-center gap-1 flex-shrink-0">
          <app-pwa-install />
          
          <!-- Mobile Theme Toggle -->
          <button
            type="button"
            class="icon-btn theme-toggle-btn"
            (click)="themeService.toggleTheme()"
            [attr.aria-label]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            [title]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <i class="bi" [class.bi-sun-fill]="themeService.theme() === 'dark'" [class.bi-moon-stars-fill]="themeService.theme() === 'light'"></i>
          </button>

          <a class="icon-btn" routerLink="/notifications" aria-label="Notifications">
            <i class="bi bi-bell"></i>
            @if (shop.unread() > 0) { <span class="count">{{ shop.unread() }}</span> }
          </a>
          @if (!isCheckout()) {
            <a class="icon-btn cart-link" routerLink="/cart" aria-label="Cart">
              <i class="bi bi-basket"></i>
              @if ((shop.cart()?.itemCount || 0) > 0) { <span class="count">{{ shop.cart()?.itemCount }}</span> }
            </a>
          }
          @if (auth.user()) {
            <a class="icon-btn" routerLink="/account" aria-label="Account">
              <i class="bi bi-person"></i>
            </a>
          } @else {
            <a class="icon-btn" routerLink="/login" aria-label="Log in">
              <i class="bi bi-box-arrow-in-right"></i>
            </a>
          }
        </div>
      </div>

      <!-- Mobile Tier 2: Dedicated Full-Width Prominent Search Bar (d-md-none) -->
      <div class="container d-block d-md-none px-3 pb-2 pt-1">
        <app-search-bar />
      </div>

      <!-- Live Store Operational Status Banner -->
      @if (shop.storeConfig() && !shop.storeConfig()?.isCurrentlyOpen) {
        <div class="store-closed-banner bg-warning-subtle text-warning-emphasis border-top border-bottom px-3 py-1 text-center small">
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
            <a class="brand d-inline-flex align-items-center gap-2 mb-3 text-decoration-none" routerLink="/">
              <span class="brand-mark">
                <img [src]="shop.logoUrl()" alt="ZapBasket Logo" class="brand-img" />
              </span>
              <span class="brand-word fs-4 fw-bold text-white">ZapBasket</span>
            </a>
            <p class="text-muted small mb-3 leading-relaxed">
              Hyperlocal rapid grocery delivery across Bengaluru. Fresh farm produce, daily essentials, and cold-pressed staples delivered to your doorstep in 12 minutes.
            </p>
            <div class="p-2 px-3 rounded-3 bg-dark border border-secondary border-opacity-25 mb-3 d-inline-flex align-items-center gap-2">
              <span class="badge bg-success text-dark px-2 py-1 fw-bold">FSSAI Certified</span>
              <span class="small font-monospace text-light fw-semibold">Lic. No. {{ shop.storeConfig()?.fssaiLicense || '11224333000542' }}</span>
            </div>
            <div class="d-flex flex-column gap-1 text-muted small" style="font-size: 0.78rem;">
              <div><b class="text-light">FSSAI Lic. No:</b> {{ shop.storeConfig()?.fssaiLicense || '11224333000542' }} (Central Food License)</div>
              <div><b class="text-light">GSTIN:</b> 29AABCZ9101F1Z8</div>
              <div><b class="text-light">Operating Hub:</b> {{ shop.storeConfig()?.storeLocation?.address || 'Koramangala 4th Block, Bengaluru 560034' }}</div>
            </div>
          </div>

          <!-- Col 2: Quick Links & Categories -->
          <div class="col-lg-2 col-md-6 col-6">
            <h6 class="fw-bold text-white mb-3">Categories</h6>
            <ul class="list-unstyled d-flex flex-column gap-2 small">
              <li><a routerLink="/c/fresh-produce" class="text-light-emphasis text-decoration-none">Fresh Veggies & Fruits</a></li>
              <li><a routerLink="/c/dairy-bread" class="text-light-emphasis text-decoration-none">Dairy, Bread & Eggs</a></li>
              <li><a routerLink="/c/snacks-munchies" class="text-light-emphasis text-decoration-none">Snacks & Beverages</a></li>
              <li><a routerLink="/c/staples" class="text-light-emphasis text-decoration-none">Atta, Rice & Dal</a></li>
              <li><a routerLink="/c/instant-food" class="text-light-emphasis text-decoration-none">Instant Foods & Noodles</a></li>
            </ul>
          </div>

          <!-- Col 3: Customer Care & Support -->
          <div class="col-lg-3 col-md-6 col-6">
            <h6 class="fw-bold text-white mb-3">Customer Desk</h6>
            <ul class="list-unstyled d-flex flex-column gap-2 small">
              <li><a routerLink="/orders" class="text-light-emphasis text-decoration-none">Track Orders</a></li>
              <li><a routerLink="/addresses" class="text-light-emphasis text-decoration-none">Saved Addresses</a></li>
              <li><a routerLink="/account" class="text-light-emphasis text-decoration-none">Account Profile</a></li>
              <li>
                <a href="tel:+919101516662" class="text-light-emphasis text-decoration-none">
                  <i class="bi bi-telephone me-1 text-success"></i> +91 9101516662
                </a>
              </li>
              <li>
                <a href="https://wa.me/919101516662?text=Hi%20ZapBasket%20Support" target="_blank" rel="noopener" class="text-light-emphasis text-decoration-none">
                  <i class="bi bi-whatsapp me-1 text-success"></i> WhatsApp Chat Desk
                </a>
              </li>
            </ul>
          </div>

          <!-- Col 4: Legal & Gateway Compliance -->
          <div class="col-lg-3 col-md-6">
            <h6 class="fw-bold text-white mb-3">Legal & Compliance</h6>
            <ul class="list-unstyled d-flex flex-column gap-2 small">
              <li><a routerLink="/terms" class="text-light-emphasis text-decoration-none">Terms of Service</a></li>
              <li><a routerLink="/privacy" class="text-light-emphasis text-decoration-none">Privacy Policy (DPDP 2023)</a></li>
              <li><a routerLink="/refund-policy" class="text-light-emphasis text-decoration-none">Refund & Cancellation SLA</a></li>
              <li><a routerLink="/legal/fssai" class="text-light-emphasis text-decoration-none">Food Safety & Licensing</a></li>
              <li><a routerLink="/contact" class="text-light-emphasis text-decoration-none">Grievance Redressal</a></li>
            </ul>
          </div>
        </div>

        <!-- Sub-footer & Payment Trust Icons -->
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 pt-3 border-top text-muted small" style="font-size: 0.78rem;">
          <div>
            © 2026 ZapBasket Rapid Retail LLP · All rights reserved.
          </div>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="text-success fw-semibold"><i class="bi bi-shield-fill-check me-1"></i>FSSAI Certified</span>
            <span aria-hidden="true">·</span>
            <span class="text-muted"><i class="bi bi-lock-fill text-primary me-1"></i>100% Secure Payments</span>
            <span aria-hidden="true">·</span>
            <span>UPI</span>
            <span aria-hidden="true">·</span>
            <span>RuPay</span>
            <span aria-hidden="true">·</span>
            <span>Cards</span>
            <span aria-hidden="true">·</span>
            <span>NetBanking</span>
            <span aria-hidden="true">·</span>
            <span>Cash on Delivery</span>
          </div>
        </div>
      </div>
    </footer>

    <!-- Floating Quick Action Pill (Mobile, Tablet, Desktop) -->
    @if ((shop.cart()?.itemCount || 0) > 0) {
      <aside
        class="floating-cart-bar"
        [class.on-cart-page]="isCart()"
        [class.on-checkout-page]="isCheckout()"
        aria-label="Quick Action"
      >
        @if (isCheckout()) {
          <!-- Inside Checkout Page: Always-Visible Pay Pill (Like Floating Cart) -->
          <button
            type="button"
            class="floating-cart-inner floating-pay-btn"
            (click)="triggerPay()"
            [disabled]="shop.placingOrder()"
            aria-label="Pay now"
          >
            <div class="d-flex align-items-center gap-2">
              <div class="floating-cart-badge">
                <i class="bi bi-lightning-charge-fill text-warning"></i>
                <span>{{ shop.cart()?.itemCount }} {{ shop.cart()?.itemCount === 1 ? 'item' : 'items' }}</span>
              </div>
              <span class="floating-cart-divider">·</span>
              <strong class="floating-cart-total">{{ (shop.cart()?.total || 0) | inr }}</strong>
            </div>
            <div class="floating-cart-cta">
              @if (shop.placingOrder()) {
                <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                <span>Placing order…</span>
              } @else if (shop.paymentMethod() === 'upi') {
                <span>Pay with UPI ⚡</span>
              } @else if (shop.paymentMethod() === 'cod') {
                <span>Place Order · Pay at Door →</span>
              } @else {
                <span>Pay via Cards →</span>
              }
            </div>
          </button>
        } @else if (isCart()) {
          <!-- Inside Cart Page: Show "Proceed to Checkout" -->
          <a routerLink="/checkout" class="floating-cart-inner">
            <div class="d-flex align-items-center gap-2">
              <div class="floating-cart-badge">
                <i class="bi bi-bag-check-fill"></i>
                <span>{{ shop.cart()?.itemCount }} {{ shop.cart()?.itemCount === 1 ? 'item' : 'items' }}</span>
              </div>
              <span class="floating-cart-divider">·</span>
              <strong class="floating-cart-total">{{ (shop.cart()?.total || 0) | inr }}</strong>
            </div>
            <div class="floating-cart-cta">
              <span>Proceed to Checkout</span>
              <i class="bi bi-arrow-right"></i>
            </div>
          </a>
        } @else {
          <!-- Outside Cart: Show "View Cart" -->
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
        }
      </aside>
    }

    @if (!isCheckout()) {
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
    }
  `,
})
export class StoreShell {
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  readonly currentUrl = signal<string>(this.router.url);

  readonly isCheckout = computed(() => this.currentUrl().includes('/checkout'));
  readonly isCart = computed(() => this.currentUrl().includes('/cart'));

  readonly place = computed(() => {
    const address = this.shop.addresses().find((item) => item.isDefault) ?? this.shop.addresses()[0];
    if (!address) return 'Add address';
    return `${address.label} · ${address.city}`;
  });

  constructor() {
    this.currentUrl.set(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentUrl.set(e.urlAfterRedirects || e.url);
      });
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

  triggerPay() {
    this.shop.requestPay();
  }

  async logout() {
    await this.auth.logout();
    this.shop.reset();
    this.toasts.show('Logged out successfully');
    await this.router.navigate(['/']);
  }
}
