import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-store-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
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
        <form class="search-form" (submit)="search($event)">
          <i class="bi bi-search"></i>
          <input name="q" [value]="term()" placeholder="Search banana, milk, oats…" aria-label="Search products" />
        </form>
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
    </header>
    <main class="container page">
      <router-outlet />
    </main>
    <nav class="mobile-nav">
      <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }"><i class="bi bi-house"></i>Home</a>
      <a routerLink="/orders" routerLinkActive="on"><i class="bi bi-receipt"></i>Orders</a>
      <a routerLink="/cart" routerLinkActive="on"><i class="bi bi-basket"></i>Cart</a>
      <a routerLink="/account" routerLinkActive="on"><i class="bi bi-person"></i>You</a>
    </nav>
  `,
})
export class StoreShell {
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  readonly term = signal('');
  readonly place = computed(() => {
    const address = this.shop.addresses().find((item) => item.isDefault) ?? this.shop.addresses()[0];
    if (!address) return 'Add address';
    return `${address.label} · ${address.city}`;
  });

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (!user) return;
      if (user.permissions.includes('cart:manage')) void this.shop.loadCart();
      if (user.permissions.includes('wishlist:manage')) void this.shop.loadWishlist();
      if (user.permissions.includes('addresses:manage')) void this.shop.loadAddresses();
      if (user.permissions.includes('notifications:read')) void this.shop.loadNotifications();
    });
  }

  search(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const query = String(new FormData(form).get('q') || '').trim();
    this.term.set(query);
    void this.router.navigate(['/'], { queryParams: query ? { q: query } : {} });
  }

  async logout() {
    await this.auth.logout();
    this.shop.cart.set(null);
    this.toasts.show('Logged out');
    await this.router.navigate(['/']);
  }
}
