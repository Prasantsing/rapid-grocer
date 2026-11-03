import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { Product } from '../core/models';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [RouterLink, InrPipe],
  templateUrl: './cart.page.html',
  styleUrl: './cart.page.scss',
})
export class CartPage implements OnInit {
  readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);
  readonly busy = signal(false);

  readonly allQuickAdds = signal<Product[]>([]);

  readonly availableQuickAdds = computed(() => {
    const cart = this.shop.cart();
    const inCartIds = new Set(cart?.items.map((i) => i.productId) || []);
    return this.allQuickAdds().filter((p) => !inCartIds.has(p.id)).slice(0, 4);
  });

  readonly freeDeliveryThreshold = computed(() => {
    return this.shop.cart()?.freeDeliveryAbove || this.shop.storeConfig()?.freeDeliveryThreshold || 299;
  });

  readonly freeDeliveryGap = computed(() => {
    const subtotal = this.shop.cart()?.subtotal || 0;
    const threshold = this.freeDeliveryThreshold();
    return Math.max(0, threshold - subtotal);
  });

  readonly freeDeliveryPercent = computed(() => {
    const subtotal = this.shop.cart()?.subtotal || 0;
    const threshold = this.freeDeliveryThreshold();
    if (threshold <= 0) return 100;
    return Math.min(100, Math.round((subtotal / threshold) * 100));
  });

  ngOnInit() {
    void this.shop.loadCart().catch((error) => this.toasts.error(errorMessage(error)));
    void this.loadQuickAdds();
  }

  async loadQuickAdds() {
    try {
      const page = await this.shop.products({ limit: 12 });
      this.allQuickAdds.set(page.items);
    } catch {
      // Ignore background recommendations error
    }
  }

  async setQty(productId: string, quantity: number) {
    try {
      await this.shop.updateItem(productId, quantity);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async quickAddItem(product: Product) {
    try {
      await this.shop.addItem(product.id, 1);
      this.toasts.show(`Added ${product.name} to your basket!`);
    } catch (error) {
      this.toasts.error(errorMessage(error, 'Could not add item'));
    }
  }

  async apply(event: Event) {
    event.preventDefault();
    const code = String(new FormData(event.target as HTMLFormElement).get('code') || '');
    try {
      await this.shop.applyCoupon(code);
      this.toasts.show('Coupon applied');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async clearCoupon() {
    try {
      await this.shop.removeCoupon();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }
}
