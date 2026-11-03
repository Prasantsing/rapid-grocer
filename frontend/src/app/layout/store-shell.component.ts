import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ThemeService } from '../core/theme.service';
import { ToastService } from '../core/toast.service';
import { SearchBarComponent } from '../shared/search-bar.component';
import { PwaInstallComponent } from '../shared/pwa-install.component';
import { ProductBottomSheetComponent } from '../shared/product-bottom-sheet.component';
import { FloatingMiniCartComponent } from '../shared/floating-mini-cart.component';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-store-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    SearchBarComponent,
    PwaInstallComponent,
    ProductBottomSheetComponent,
    FloatingMiniCartComponent,
  ],
  templateUrl: './store-shell.component.html',
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
