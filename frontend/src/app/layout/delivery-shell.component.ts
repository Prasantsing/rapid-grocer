import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-delivery-shell',
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="desk-top">
      <div class="container py-3 d-flex align-items-center justify-content-between">
        <a class="brand" routerLink="/delivery">
          <span class="brand-mark"><i class="bi bi-scooter text-warning"></i></span>
          <span class="brand-word">Runs<small>Delivery partner</small></span>
        </a>
        <div class="d-flex gap-2">
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

  async logout() {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
