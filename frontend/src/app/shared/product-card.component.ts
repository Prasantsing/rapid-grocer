import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ThemeService } from '../core/theme.service';
import { ToastService } from '../core/toast.service';
import { ProductQuickViewService } from '../core/product-quick-view.service';
import { errorMessage } from '../core/http-error';
import { Product } from '../core/models';
import { InrPipe } from './inr.pipe';

@Component({
  selector: 'app-product-card',
  imports: [InrPipe],
  templateUrl: './product-card.component.html',
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly auth = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly quickView = inject(ProductQuickViewService);
  private readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  readonly busy = signal(false);
  readonly imgFailed = signal(false);
  readonly qty = computed(() => this.shop.cart()?.items.find((item) => item.productId === this.product().id)?.quantity ?? 0);
  readonly wished = computed(() => this.shop.wishlistIds().includes(this.product().id));

  openQuickView(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.quickView.open(this.product());
  }

  getArtBackground(): string {
    if (this.product().imageUrl && !this.imgFailed()) {
      return this.themeService.isDark() ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc';
    }
    const t = this.product().tint;
    if (t && t.startsWith('#') && t.length === 7) {
      return this.themeService.isDark() ? t + '20' : t + '38';
    }
    return this.themeService.isDark() ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc';
  }

  add() {
    void this.change(1, true);
  }

  async change(quantity: number, adding = false) {
    if (!this.auth.user()) {
      await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.auth.user()?.role !== 'customer') {
      this.toasts.error('Use a customer account to fill a basket.');
      return;
    }
    this.busy.set(true);
    try {
      if (adding || this.qty() === 0) await this.shop.addItem(this.product().id, 1);
      else await this.shop.updateItem(this.product().id, quantity);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  async toggleWish() {
    if (!this.auth.user()) {
      await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    try {
      if (this.wished()) await this.shop.removeWish(this.product().id);
      else await this.shop.addWish(this.product().id);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }
}
