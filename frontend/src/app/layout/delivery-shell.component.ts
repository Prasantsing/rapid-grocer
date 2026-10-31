import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { ShopService } from '../core/shop.service';

@Component({
  selector: 'app-delivery-shell',
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="desk-top">
      <div class="container py-3 d-flex align-items-center justify-content-between">
        <a class="brand" routerLink="/delivery">
          <span class="brand-mark">
            <img [src]="shop.logoUrl()" alt="ZapBasket Logo" class="brand-img" />
          </span>
          <span class="brand-word">Runs<small>Delivery partner</small></span>
        </a>
        <div class="d-flex align-items-center gap-2">
          <button
            class="location-chip"
            type="button"
            (click)="themeService.toggleTheme()"
            [title]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            [attr.aria-label]="themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <i class="bi" [class.bi-sun-fill]="themeService.theme() === 'dark'" [class.bi-moon-stars-fill]="themeService.theme() === 'light'"></i>
          </button>
          <a class="location-chip" routerLink="/notifications"><i class="bi bi-bell"></i></a>
          <button class="location-chip" type="button" (click)="logout()">Log out</button>
        </div>
      </div>
    </header>
    <main class="container page py-3">
      <router-outlet />
    </main>
  `,
})
export class DeliveryShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly themeService = inject(ThemeService);
  readonly shop = inject(ShopService);

  async logout() {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
