import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { Product } from '../core/models';
import { InrPipe } from './inr.pipe';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, InrPipe],
  template: `
    <article class="tile">
      <a class="tile-art" [routerLink]="['/p', product().slug]" [style.background]="product().tint">
        <span class="emoji">{{ product().emoji }}</span>
        @if (product().discountPercent > 0) {
          <span class="off">{{ product().discountPercent }}% off</span>
        }
      </a>
      @if (auth.user()?.role === 'customer' || !auth.user()) {
        <button class="wish" type="button" (click)="toggleWish()" [attr.aria-label]="wished() ? 'Remove from wishlist' : 'Save to wishlist'">
          <i class="bi" [class.bi-heart-fill]="wished()" [class.bi-heart]="!wished()"></i>
        </button>
      }
      <div class="tile-body">
        <p class="unit">{{ product().unit }}</p>
        <a [routerLink]="['/p', product().slug]">{{ product().name }}</a>
        <div class="price-row">
          <strong>{{ product().price | inr }}</strong>
          @if (product().mrp > product().price) {
            <s>{{ product().mrp | inr }}</s>
          }
          @if (product().stock < 1) {
            <span class="sold">Sold out</span>
          } @else if (qty() === 0) {
            <button class="add-btn" type="button" [disabled]="busy()" (click)="add()">ADD</button>
          } @else {
            <div class="stepper">
              <button type="button" [disabled]="busy()" (click)="change(qty() - 1)">−</button>
              <span>{{ qty() }}</span>
              <button type="button" [disabled]="busy()" (click)="change(qty() + 1)">+</button>
            </div>
          }
        </div>
      </div>
    </article>
  `,
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly auth = inject(AuthService);
  private readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  readonly busy = signal(false);
  readonly qty = computed(() => this.shop.cart()?.items.find((item) => item.productId === this.product().id)?.quantity ?? 0);
  readonly wished = computed(() => this.shop.wishlistIds().includes(this.product().id));

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
