import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ProductCard } from '../shared/product-card.component';

@Component({
  selector: 'app-wishlist-page',
  imports: [ProductCard, RouterLink],
  template: `
    <div class="section-head"><h2>Saved</h2></div>
    @if (loading()) {
      <p class="muted">Opening your list…</p>
    } @else if (products().length === 0) {
      <div class="empty panel"><h2>Nothing saved yet</h2><a routerLink="/">Find something worth keeping</a></div>
    } @else {
      <div class="product-grid">
        @for (product of products(); track product.id) {
          <app-product-card [product]="product" />
        }
      </div>
    }
  `,
})
export class WishlistPage {
  private readonly shop = inject(ShopService);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.shop.loadWishlist()
      .then((wishlist) => this.products.set(wishlist.products))
      .catch(() => this.products.set([]))
      .finally(() => this.loading.set(false));
  }
}
