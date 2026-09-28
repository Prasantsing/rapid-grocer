import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="desk">
      <aside class="desk-nav">
        <a class="brand text-white mb-3" routerLink="/admin">
          <span class="brand-mark"><i class="bi bi-lightning-charge-fill text-warning"></i></span>
          <span class="brand-word text-white">Desk<small class="text-white-50">Store operations</small></span>
        </a>
        <a routerLink="/admin" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }"><i class="bi bi-speedometer2"></i> Dashboard</a>
        <a routerLink="/admin/orders" routerLinkActive="on"><i class="bi bi-bag"></i> Orders</a>
        <a routerLink="/admin/products" routerLinkActive="on"><i class="bi bi-box"></i> Products</a>
        <a routerLink="/admin/categories" routerLinkActive="on"><i class="bi bi-grid"></i> Categories</a>
        <a routerLink="/admin/coupons" routerLinkActive="on"><i class="bi bi-ticket"></i> Coupons</a>
        <a routerLink="/admin/users" routerLinkActive="on"><i class="bi bi-people"></i> People</a>
        <a routerLink="/admin/reports" routerLinkActive="on"><i class="bi bi-bar-chart"></i> Reports</a>
        <a routerLink="/"><i class="bi bi-shop"></i> Open store</a>
        <button class="btn btn-sm btn-outline-light mt-3" type="button" (click)="logout()">Log out</button>
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
