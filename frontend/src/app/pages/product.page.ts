import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Product } from '../core/models';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-product-page',
  imports: [InrPipe, RouterLink],
  template: `
    @if (loading()) {
      <p class="muted py-4">Finding that item…</p>
    } @else if (error()) {
      <div class="empty panel"><h2>Item missing</h2><p>{{ error() }}</p><a routerLink="/">Back to the shelf</a></div>
    } @else if (product(); as item) {
      <a class="muted" routerLink="/">Shelf</a>
      <div class="split mt-3">
        <div class="panel d-grid" [style.background]="item.tint" style="min-height: 320px; place-items: center">
          <span style="font-size: 7rem">{{ item.emoji }}</span>
        </div>
        <div class="panel">
          <p class="eyebrow">{{ categoryName(item) }}</p>
          <h1>{{ item.name }}</h1>
          <p class="muted">{{ item.brand }} · {{ item.unit }}</p>
          <p>{{ item.description }}</p>
          <p class="mb-1"><strong class="fs-3">{{ item.price | inr }}</strong>
            @if (item.mrp > item.price) { <s class="ms-2 muted">{{ item.mrp | inr }}</s> }
          </p>
          <p class="muted">{{ item.stock }} left in the dark store</p>
          @if (item.stock < 1) {
            <p class="sold">Sold out</p>
          } @else if (qty() === 0) {
            <button class="btn btn-dark" type="button" [disabled]="busy()" (click)="add()">Add to basket</button>
          } @else {
            <div class="stepper">
              <button type="button" (click)="change(qty() - 1)">−</button>
              <span>{{ qty() }}</span>
              <button type="button" (click)="change(qty() + 1)">+</button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class ProductPage {
  private readonly shop = inject(ShopService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  readonly product = signal<Product | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly qty = computed(() => {
    const current = this.product();
    if (!current) return 0;
    return this.shop.cart()?.items.find((item) => item.productId === current.id)?.quantity ?? 0;
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') || '';
      this.loading.set(true);
      this.shop.product(slug).then((item) => {
        this.product.set(item);
        this.error.set('');
      }).catch((error: unknown) => {
        this.product.set(null);
        this.error.set(errorMessage(error, 'That product is not on the shelf.'));
      }).finally(() => this.loading.set(false));
    });
  }

  categoryName(product: Product) {
    return typeof product.category === 'string' ? '' : product.category?.name || '';
  }

  add() {
    void this.change(1, true);
  }

  async change(quantity: number, adding = false) {
    const item = this.product();
    if (!item) return;
    if (!this.auth.user()) {
      await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.busy.set(true);
    try {
      if (adding || this.qty() === 0) await this.shop.addItem(item.id, 1);
      else await this.shop.updateItem(item.id, quantity);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
