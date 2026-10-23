import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="desk">
      <!-- Mobile Top Bar for Desk Operations -->
      <header class="desk-mobile-header d-md-none">
        <div class="d-flex align-items-center justify-content-between p-2 px-3 bg-dark text-white border-bottom">
          <a class="brand text-white text-decoration-none" routerLink="/admin">
            <span class="brand-mark bg-warning text-dark"><i class="bi bi-lightning-charge-fill"></i></span>
            <span class="brand-word text-white">Desk<small class="text-white-50">Store operations</small></span>
          </a>
          <div class="d-flex align-items-center gap-2">
            <a routerLink="/" class="btn btn-sm btn-outline-light py-1 px-2" title="Open Storefront">
              <i class="bi bi-shop me-1"></i>Store
            </a>
            <button class="btn btn-sm btn-outline-danger py-1 px-2" type="button" (click)="logout()" title="Log out">
              <i class="bi bi-box-arrow-right"></i>
            </button>
          </div>
        </div>
      </header>

      <aside class="desk-nav">
        <a class="brand text-white mb-3 d-none d-md-flex" routerLink="/admin">
          <span class="brand-mark"><i class="bi bi-lightning-charge-fill text-warning"></i></span>
          <span class="brand-word text-white">Desk<small class="text-white-50">Store operations</small></span>
        </a>
        <div class="desk-nav-scroll-wrap">
          <a routerLink="/admin" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }"><i class="bi bi-speedometer2"></i> <span>Dashboard</span></a>
          <a routerLink="/admin/orders" routerLinkActive="on"><i class="bi bi-bag"></i> <span>Orders</span></a>
          <a routerLink="/admin/products" routerLinkActive="on"><i class="bi bi-box"></i> <span>Products</span></a>
          <a routerLink="/admin/inventory" routerLinkActive="on"><i class="bi bi-boxes"></i> <span>Inventory</span></a>
          <a routerLink="/admin/gst-billing" routerLinkActive="on"><i class="bi bi-receipt"></i> <span>GST</span></a>
          <a routerLink="/admin/categories" routerLinkActive="on"><i class="bi bi-grid"></i> <span>Categories</span></a>
          <a routerLink="/admin/coupons" routerLinkActive="on"><i class="bi bi-ticket"></i> <span>Coupons</span></a>
          <a routerLink="/admin/users" routerLinkActive="on"><i class="bi bi-people"></i> <span>People</span></a>
          <a routerLink="/admin/reports" routerLinkActive="on"><i class="bi bi-bar-chart"></i> <span>Reports</span></a>
          <a routerLink="/admin/settings" routerLinkActive="on"><i class="bi bi-sliders"></i> <span>Settings</span></a>
          <a routerLink="/" class="d-none d-md-flex"><i class="bi bi-shop"></i> <span>Open store</span></a>
        </div>
        <button class="btn btn-sm btn-outline-light mt-3 d-none d-md-block" type="button" (click)="logout()">Log out</button>
      </aside>
      <section class="desk-main">
        <router-outlet />
      </section>
    </div>
  `,
})
export class AdminShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async logout() {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
