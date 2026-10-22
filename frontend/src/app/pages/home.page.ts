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
      <a class="cat-pill" routerLink="/" [queryParams]="term() ? { q: term() } : {}" [class.active]="!categorySlug()"><span>✨</span><b>All</b></a>
      @for (category of categories(); track category.id) {
        <a class="cat-pill" [routerLink]="['/c', category.slug]" [queryParams]="term() ? { q: term() } : {}" [class.active]="category.slug === categorySlug()">
          <span>{{ category.emoji }}</span>
          <b>{{ category.name }}</b>
        </a>
      }
    </div>

    @if (categorySlug() || term()) {
      <div class="active-filter-strip">
        <div class="strip-items">
          <span class="strip-label"><i class="bi bi-funnel-fill"></i> Filtering by:</span>
          @if (categorySlug()) {
            <span class="filter-chip">
              <span>Aisle: <b>{{ currentCategoryName() }}</b></span>
              <a [routerLink]="['/']" [queryParams]="term() ? { q: term() } : {}" class="chip-remove" aria-label="Remove category filter">&times;</a>
            </span>
          }
          @if (term()) {
            <span class="filter-chip">
              <span>Search: <b>"{{ term() }}"</b></span>
              <a [routerLink]="categorySlug() ? ['/c', categorySlug()] : ['/']" class="chip-remove" aria-label="Clear search term">&times;</a>
            </span>
          }
        </div>
        <a routerLink="/" class="clear-all-link">Clear all</a>
      </div>
    }

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
        @if (term() && categorySlug()) {
          <p>No groceries found for "<b>{{ term() }}</b>" in {{ currentCategoryName() }}.</p>
          <div class="d-flex gap-2 justify-content-center mt-3">
            <a class="btn btn-sm btn-outline-dark" [routerLink]="['/']" [queryParams]="{ q: term() }">Search all aisles for "{{ term() }}"</a>
            <a class="btn btn-sm btn-dark" routerLink="/">Browse all products</a>
          </div>
        } @else if (term()) {
          <p>No groceries matched "<b>{{ term() }}</b>". Try banana, milk, or oats.</p>
          <a class="btn btn-sm btn-dark mt-2" routerLink="/">Show all products</a>
        } @else {
          <p>This aisle is currently empty.</p>
          <a class="btn btn-sm btn-dark mt-2" routerLink="/">Browse other aisles</a>
        }
      </div>
    } @else {
      <div class="product-grid">
        @for (product of products(); track product.id) {
          <app-product-card [product]="product" />
        }
      </div>
    }
  `,
  styles: [`
    .active-filter-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.6rem;
      background: #ffffff;
      border: 1px solid var(--line, #e4dccb);
      border-radius: 14px;
      padding: 0.55rem 0.9rem;
      margin-bottom: 1.25rem;
    }

    .strip-items {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .strip-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--muted, #6f675c);
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }

    .filter-chip {
      background: #f4efe4;
      border: 1px solid #e2dac9;
      color: var(--ink, #1c1915);
      border-radius: 999px;
      font-size: 0.8rem;
      padding: 0.2rem 0.6rem;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .chip-remove {
      color: #9c9384;
      text-decoration: none;
      font-size: 1.1rem;
      line-height: 1;
      transition: color 0.15s ease;
    }

    .chip-remove:hover {
      color: var(--sale, #c2410c);
    }

    .clear-all-link {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--sale, #c2410c);
      text-decoration: none;
      margin-left: auto;
    }

    .clear-all-link:hover {
      text-decoration: underline;
    }
  `],
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
