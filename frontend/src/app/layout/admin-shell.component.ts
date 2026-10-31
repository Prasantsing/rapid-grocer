import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { ShopService } from '../core/shop.service';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="desk">
      <!-- Mobile Top Bar for Desk Operations -->
      <header class="desk-mobile-header d-md-none">
        <div class="d-flex align-items-center justify-content-between p-2 px-3 border-bottom desk-mobile-bar">
          <a class="brand text-decoration-none" routerLink="/admin">
            <span class="brand-mark">
              <img [src]="shop.logoUrl()" alt="ZapBasket Logo" class="brand-img" />
            </span>
            <span class="brand-word">Desk<small>Store operations</small></span>
          </a>
          <div class="d-flex align-items-center gap-2">
            <button
              class="btn btn-sm btn-outline-secondary py-1 px-2"
              type="button"
              (click)="themeService.toggleTheme()"
              [title]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
              [attr.aria-label]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            >
              <i class="bi" [class.bi-sun-fill]="themeService.theme() === 'dark'" [class.bi-moon-stars-fill]="themeService.theme() === 'light'"></i>
            </button>
            <a routerLink="/" class="btn btn-sm btn-outline-secondary py-1 px-2" title="Open Storefront">
              <i class="bi bi-shop me-1"></i>Store
            </a>
            <button class="btn btn-sm btn-outline-danger py-1 px-2" type="button" (click)="logout()" title="Log out">
              <i class="bi bi-box-arrow-right"></i>
            </button>
          </div>
        </div>
      </header>

      <aside class="desk-nav">
        <div class="d-none d-md-flex align-items-center justify-content-between mb-3">
          <a class="brand text-decoration-none" routerLink="/admin">
            <span class="brand-mark">
              <img [src]="shop.logoUrl()" alt="ZapBasket Logo" class="brand-img" />
            </span>
            <span class="brand-word">Desk<small>Store operations</small></span>
          </a>
          <button
            class="btn btn-sm btn-outline-secondary py-1 px-2 theme-toggle-desk"
            type="button"
            (click)="themeService.toggleTheme()"
            [title]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            [attr.aria-label]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <i class="bi" [class.bi-sun-fill]="themeService.theme() === 'dark'" [class.bi-moon-stars-fill]="themeService.theme() === 'light'"></i>
          </button>
        </div>
        <div class="desk-nav-scroll-wrap">
          <a routerLink="/admin" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }"><i class="bi bi-speedometer2"></i> <span>Dashboard</span></a>
          <a routerLink="/admin/orders" routerLinkActive="on"><i class="bi bi-bag"></i> <span>Orders</span></a>
          <a routerLink="/admin/products" routerLinkActive="on"><i class="bi bi-box"></i> <span>Products</span></a>
          <a routerLink="/admin/inventory" routerLinkActive="on"><i class="bi bi-boxes"></i> <span>Inventory</span></a>
          <a routerLink="/admin/gst-billing" routerLinkActive="on"><i class="bi bi-receipt"></i> <span>GST</span></a>
          <a routerLink="/admin/settlement" routerLinkActive="on"><i class="bi bi-wallet2"></i> <span>Settlement</span></a>
          <a routerLink="/admin/categories" routerLinkActive="on"><i class="bi bi-grid"></i> <span>Categories</span></a>
          <a routerLink="/admin/coupons" routerLinkActive="on"><i class="bi bi-ticket"></i> <span>Coupons</span></a>
          <a routerLink="/admin/users" routerLinkActive="on"><i class="bi bi-people"></i> <span>People</span></a>
          <a routerLink="/admin/reports" routerLinkActive="on"><i class="bi bi-bar-chart"></i> <span>Reports</span></a>
          <a routerLink="/admin/theme" routerLinkActive="on"><i class="bi bi-palette"></i> <span>Theme</span></a>
          <a routerLink="/admin/settings" routerLinkActive="on"><i class="bi bi-sliders"></i> <span>Settings</span></a>
          <a routerLink="/" class="d-none d-md-flex"><i class="bi bi-shop"></i> <span>Open store</span></a>
        </div>
        <button class="btn btn-sm btn-outline-danger mt-3 d-none d-md-block w-100" type="button" (click)="logout()">Log out</button>
      </aside>
      <section class="desk-main">
        <router-outlet />
      </section>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 100vw;
      min-width: 0;
      overflow-x: hidden;
    }
    .desk {
      width: 100%;
      max-width: 100vw;
      min-width: 0;
      overflow-x: hidden;
    }
  `],
})
export class AdminShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);
  readonly shop = inject(ShopService);

  async logout() {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
