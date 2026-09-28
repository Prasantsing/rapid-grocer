import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { Category, Product } from '../core/models';
import { ShopService } from '../core/shop.service';
import { errorMessage } from '../core/http-error';
import { ProductCard } from '../shared/product-card.component';

@Component({
  selector: 'app-home-page',
  imports: [ProductCard, RouterLink],
  template: `
    @if (!categorySlug() && !term()) {
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Koramangala · tonight</p>
          <h1>Groceries at the door before the chai cools.</h1>
          <p class="muted mb-0">Milk, bananas, and the onion you forgot. Packed from a dark store a few streets away.</p>
        </div>
        <aside class="slot-card">
          <p class="eyebrow">Next slot</p>
          <strong>{{ slot() }}</strong>
          <p class="mb-0 mt-2">Most baskets arrive in about 12 minutes. Free delivery over ₹299.</p>
        </aside>
      </section>
    }

    <div class="rail">
      <a class="cat-pill" routerLink="/" [class.active]="!categorySlug()"><span>✨</span><b>All</b></a>
      @for (category of categories(); track category.id) {
        <a class="cat-pill" [routerLink]="['/c', category.slug]" [class.active]="category.slug === categorySlug()">
          <span>{{ category.emoji }}</span>
          <b>{{ category.name }}</b>
        </a>
      }
    </div>

    <div class="section-head">
      <div>
        <h2>{{ heading() }}</h2>
        <p class="muted mb-0">{{ products().length }} on the shelf</p>
      </div>
      <select class="form-select w-auto" [value]="sort()" (change)="setSort($event)">
        <option value="newest">Newest</option>
        <option value="price_asc">Price: low</option>
        <option value="price_desc">Price: high</option>
        <option value="name">Name</option>
      </select>
    </div>

    @if (loading()) {
      <p class="muted">Bringing the aisle over…</p>
    } @else if (error()) {
      <div class="empty panel">
        <h2>The aisle did not load</h2>
        <p>{{ error() }}</p>
        <button class="btn btn-dark" type="button" (click)="load()">Try again</button>
      </div>
    } @else if (products().length === 0) {
      <div class="empty panel">
        <h2>Nothing matched</h2>
        <p>Try banana, milk, or oats.</p>
      </div>
    } @else {
      <div class="product-grid">
        @for (product of products(); track product.id) {
          <app-product-card [product]="product" />
        }
      </div>
    }
  `,
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

  constructor() {
    void this.shop.categories().then((items) => this.categories.set(items)).catch(() => undefined);
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, query]) => {
      this.categorySlug.set(params.get('slug') || '');
      this.term.set(query.get('q') || '');
      void this.load();
    });
  }

  heading() {
    if (this.term()) return `Results for “${this.term()}”`;
    const category = this.categories().find((item) => item.slug === this.categorySlug());
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
