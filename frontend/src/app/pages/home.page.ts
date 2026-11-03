import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { Category, Product } from '../core/models';
import { ShopService } from '../core/shop.service';
import { errorMessage } from '../core/http-error';
import { ProductCard } from '../shared/product-card.component';
import { ProductCardSkeletonComponent } from '../shared/product-card-skeleton.component';

@Component({
  selector: 'app-home-page',
  imports: [ProductCard, ProductCardSkeletonComponent, RouterLink],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly shop = inject(ShopService);
  private readonly route = inject(ActivatedRoute);
  readonly categories = signal<Category[]>([]);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly term = signal('');
  readonly categorySlug = signal('');
  readonly sort = signal('newest');
  readonly slot = signal(this.nextSlot());
  readonly skeletonItems = [1, 2, 3, 4, 5, 6, 7, 8];

  constructor() {
    void this.shop.categories().then((items) => this.categories.set(items)).catch(() => undefined);
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, query]) => {
      this.categorySlug.set(params.get('slug') || query.get('category') || '');
      this.term.set(query.get('q') || '');
      void this.load();
    });
  }

  currentCategoryName() {
    const found = this.categories().find((item) => item.slug === this.categorySlug());
    return found ? `${found.emoji} ${found.name}` : this.categorySlug();
  }

  heading() {
    const category = this.categories().find((item) => item.slug === this.categorySlug());
    if (this.term() && category) return `“${this.term()}” in ${category.name}`;
    if (this.term()) return `Results for “${this.term()}”`;
    return category?.name || 'On the shelf';
  }

  setSort(event: Event) {
    this.sort.set((event.target as HTMLSelectElement).value);
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.shop.products({
        search: this.term(),
        category: this.categorySlug(),
        sort: this.sort(),
        limit: 40,
      });
      this.products.set(page.items);
    } catch (error) {
      this.error.set(errorMessage(error, 'The store API is not reachable.'));
    } finally {
      this.loading.set(false);
    }
  }

  private nextSlot() {
    return new Date(Date.now() + 12 * 60 * 1000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }
}
