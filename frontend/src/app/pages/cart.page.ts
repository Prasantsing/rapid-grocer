import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, InrPipe],
  template: `
    <div class="section-head"><h2>Your basket</h2></div>
    @if (!shop.cart() || shop.cart()!.items.length === 0) {
      <div class="empty panel">
        <h2>The basket is empty</h2>
        <p>The bananas are still on the shelf.</p>
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
        </div>
        <aside class="panel">
          <h3>Bill</h3>
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
          <p class="muted">Free over {{ shop.cart()!.freeDeliveryAbove | inr }}</p>
          <p class="summary-row total-row"><span>To pay</span><span>{{ shop.cart()!.total | inr }}</span></p>
          <a class="btn btn-dark w-100" routerLink="/checkout">Checkout</a>
        </aside>
      </div>
    }
  `,
})
export class CartPage {
  readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);
  readonly busy = signal(false);

  constructor() {
    void this.shop.loadCart().catch((error) => this.toasts.error(errorMessage(error)));
  }

  async setQty(productId: string, quantity: number) {
    try {
      await this.shop.updateItem(productId, quantity);
    } catch (error) {
      this.toasts.error(errorMessage(error));
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
