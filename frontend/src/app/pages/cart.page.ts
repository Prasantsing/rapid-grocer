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
  template: `
    <div class="section-head"><h2>Your basket</h2></div>
    @if (!shop.cart() || shop.cart()!.items.length === 0) {
      <div class="empty panel">
        <h2>The basket is empty</h2>
        <p>The bananas and farm veggies are still on the shelf.</p>
        <a class="btn btn-dark" routerLink="/">Start a shop</a>
      </div>
    } @else {
      <div class="split">
        <div class="panel">
          @for (item of shop.cart()!.items; track item.productId) {
            <div class="line-item">
              <div class="d-flex gap-3 align-items-center">
                <div class="line-art" [style.background]="item.tint">{{ item.emoji }}</div>
                <div>
                  <a [routerLink]="['/p', item.slug]">{{ item.name }}</a>
                  <p class="muted mb-0">{{ item.unit }} · {{ item.price | inr }}</p>
                </div>
              </div>
              <div class="text-end">
                <strong>{{ item.lineTotal | inr }}</strong>
                <div class="stepper mt-2">
                  <button type="button" (click)="setQty(item.productId, item.quantity - 1)">−</button>
                  <span>{{ item.quantity }}</span>
                  <button type="button" (click)="setQty(item.productId, item.quantity + 1)">+</button>
                </div>
              </div>
            </div>
          }

          <!-- Impulse / Frequently Added Together Essentials -->
          @if (availableQuickAdds().length > 0) {
            <div class="mt-4 pt-3 border-top">
              <div class="d-flex align-items-center justify-content-between mb-3">
                <h4 class="h6 fw-bold mb-0 text-dark">
                  <i class="bi bi-stars text-warning me-1"></i> Frequently added together
                </h4>
                <span class="text-muted small" style="font-size: 0.75rem;">One-tap add</span>
              </div>
              <div class="quick-add-grid">
                @for (prod of availableQuickAdds(); track prod.id) {
                  <div class="quick-add-card p-2 rounded-3 border bg-white d-flex align-items-center justify-content-between gap-2 shadow-xs">
                    <div class="d-flex align-items-center gap-2 text-truncate">
                      <div class="quick-art flex-shrink-0" [style.background]="prod.tint">{{ prod.emoji }}</div>
                      <div class="text-truncate">
                        <div class="small fw-semibold text-truncate text-dark">{{ prod.name }}</div>
                        <div class="text-muted small" style="font-size: 0.73rem;">{{ prod.unit }} · <b>{{ prod.price | inr }}</b></div>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn btn-outline-success btn-sm flex-shrink-0 px-2 py-1 fw-bold"
                      style="font-size: 0.75rem;"
                      (click)="quickAddItem(prod)"
                    >
                      + Add
                    </button>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <aside class="panel">
          <h3>Bill</h3>

          <!-- Free Delivery Progress Bar -->
          @if (freeDeliveryGap() > 0) {
            <div class="p-2 mb-3 rounded-3 bg-light border small text-start">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-semibold text-dark">
                  <i class="bi bi-truck text-success me-1"></i>
                  Add <b>{{ freeDeliveryGap() | inr }}</b> for Free Delivery
                </span>
                <span class="text-muted font-monospace">{{ freeDeliveryPercent() }}%</span>
              </div>
              <div class="progress" style="height: 5px;">
                <div class="progress-bar bg-success" role="progressbar" [style.width.%]="freeDeliveryPercent()"></div>
              </div>
            </div>
          } @else {
            <div class="p-2 mb-3 rounded-3 bg-success-subtle text-success border border-success-subtle text-center small fw-semibold">
              <i class="bi bi-check-circle-fill me-1"></i> You've unlocked FREE 12-Min Delivery!
            </div>
          }

          <form class="d-flex gap-2 mb-3" (submit)="apply($event)">
            <input class="form-control" name="code" placeholder="Coupon code" [value]="shop.cart()?.coupon?.code || ''" />
            <button class="btn btn-outline-dark" type="submit">Apply</button>
          </form>
          @if (shop.cart()?.couponMessage) { <p class="text-danger">{{ shop.cart()?.couponMessage }}</p> }
          @if (shop.cart()?.coupon) {
            <p class="d-flex justify-content-between"><span>{{ shop.cart()?.coupon?.code }}</span>
              <button class="btn btn-link p-0" type="button" (click)="clearCoupon()">Remove</button></p>
          }
          <p class="summary-row"><span>Items</span><span>{{ shop.cart()!.subtotal | inr }}</span></p>
          <p class="summary-row"><span>Discount</span><span>− {{ shop.cart()!.discount | inr }}</span></p>
          <p class="summary-row"><span>Delivery</span><span>{{ shop.cart()!.deliveryFee === 0 ? 'Free' : (shop.cart()!.deliveryFee | inr) }}</span></p>
          <p class="summary-row total-row"><span>To pay</span><span>{{ shop.cart()!.total | inr }}</span></p>
          <a class="btn btn-dark w-100 py-2 fw-semibold" routerLink="/checkout">Proceed to Checkout</a>
        </aside>
      </div>
    }
  `,
  styles: [`
    .quick-add-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.65rem;
    }
    .quick-add-card {
      transition: all 0.15s ease;
    }
    .quick-add-card:hover {
      border-color: #0e6b4f !important;
      box-shadow: 0 4px 10px rgba(0,0,0,0.06);
    }
    .quick-art {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      font-size: 1.15rem;
    }
  `],
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
