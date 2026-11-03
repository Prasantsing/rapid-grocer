import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ProductCard } from '../shared/product-card.component';

@Component({
  selector: 'app-wishlist-page',
  imports: [ProductCard, RouterLink],
  templateUrl: './wishlist.page.html',
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
