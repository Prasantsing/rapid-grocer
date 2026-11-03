import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';
import { ShopService } from '../core/shop.service';

@Component({
  selector: 'app-delivery-shell',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './delivery-shell.component.html',
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
