import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Category, Product } from '../core/models';
import { ShopService } from '../core/shop.service';
import { InrPipe } from './inr.pipe';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [RouterLink, InrPipe],
  template: `
    <div class="search-bar-wrap" #container>
      <form class="search-bar-container" [class.focused]="isFocused()" (submit)="onSubmit($event)">
        <!-- Category Filter Selector -->
        <div class="category-segment" title="Filter by category">
          <select
            class="category-select"
            [value]="selectedCategory()"
            (change)="onCategoryChange($event)"
            aria-label="Filter grocery items by category"
          >
            <option value="">🛒 All Aisles</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.slug">{{ cat.emoji }} {{ cat.name }}</option>
            }
          </select>
          <i class="bi bi-chevron-down select-caret" aria-hidden="true"></i>
        </div>

        <div class="divider" aria-hidden="true"></div>

        <!-- Name / Keyword Search Input -->
        <div class="input-segment">
          <i class="bi bi-search search-icon" aria-hidden="true"></i>
          <input
            #searchInput
            type="text"
            class="search-input"
            [value]="searchTerm()"
            (input)="onSearchInput($event)"
            (focus)="onInputFocus()"
            (keydown.escape)="closeDropdown()"
            [placeholder]="inputPlaceholder()"
            aria-label="Filter grocery items by name or keyword"
            autocomplete="off"
          />
          @if (searchTerm()) {
            <button
              type="button"
              class="clear-btn"
              (click)="clearSearch()"
              aria-label="Clear search query"
            >
              <i class="bi bi-x-circle-fill"></i>
            </button>
          }
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="submit-btn"
          aria-label="Search"
          title="Search grocery items"
        >
          <i class="bi bi-arrow-right"></i>
        </button>
      </form>

      <!-- Autocomplete & Quick Filter Dropdown -->
      @if (isOpen() && (isSearching() || liveResults().length > 0 || (searchTerm().trim().length >= 2 && liveResults().length === 0))) {
        <div class="search-dropdown-menu" (mousedown)="$event.preventDefault()">
          @if (isSearching()) {
            <div class="dropdown-state-loading">
              <span class="spinner-border spinner-border-sm text-success" role="status"></span>
              <span>Checking the shelves…</span>
            </div>
          } @else if (liveResults().length > 0) {
            <div class="dropdown-header">
              <span class="header-title">Matching Items</span>
              <span class="header-count">{{ liveResults().length }} available</span>
            </div>
            <div class="dropdown-items-list">
              @for (item of liveResults(); track item.id) {
                <a
                  [routerLink]="['/p', item.slug]"
                  (click)="onSelectProduct()"
                  class="dropdown-item-row"
                >
                  <div class="item-art" [style.background]="item.tint">
                    <span class="item-emoji">{{ item.emoji }}</span>
                  </div>
                  <div class="item-details">
                    <div class="item-name">{{ item.name }}</div>
                    <div class="item-meta">
                      @if (getItemCategoryName(item)) {
                        <span class="cat-tag">{{ getItemCategoryName(item) }}</span>
                      }
                      @if (item.brand) {
                        <span class="meta-separator">·</span>
                        <span class="brand-name">{{ item.brand }}</span>
                      }
                      <span class="meta-separator">·</span>
                      <span class="unit-text">{{ item.unit }}</span>
                    </div>
                  </div>
                  <div class="item-pricing">
                    <span class="item-price">{{ item.price | inr }}</span>
                    @if (item.discountPercent > 0) {
                      <span class="item-badge">{{ item.discountPercent }}% off</span>
                    }
                  </div>
                </a>
              }
            </div>
            <div class="dropdown-footer">
              <button type="button" class="view-all-btn" (click)="submitFilter()">
                <span>View all {{ liveResults().length }} results for "<b>{{ searchTerm() }}</b>"</span>
                <i class="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          } @else if (searchTerm().trim().length >= 2) {
            <div class="dropdown-state-empty">
              <i class="bi bi-search empty-icon"></i>
              <div class="empty-title">No grocery items found for "{{ searchTerm() }}"</div>
              @if (selectedCategory()) {
                <p class="empty-hint">
                  Filtered to <b>{{ selectedCategoryName() }}</b>.
                  <button type="button" class="switch-aisle-btn" (click)="resetCategory()">Search all aisles</button>
                </p>
              } @else {
                <p class="empty-hint">Try searching for "doodh", "aloo", "tamatar", "pyaaz", "dahi", or "bread".</p>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      flex: 1;
      min-width: 0;
    }

    .search-bar-wrap {
      position: relative;
      width: 100%;
    }

    .search-bar-container {
      display: flex;
      align-items: center;
      background: #ffffff;
      border: 1.5px solid var(--line, #e4dccb);
      border-radius: 999px;
      padding: 0.2rem 0.35rem 0.2rem 0.85rem;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 2px 6px rgba(28, 25, 21, 0.04);
      min-height: 44px;
    }

    .search-bar-container:hover {
      border-color: #cfc5b0;
      box-shadow: 0 4px 12px rgba(28, 25, 21, 0.07);
    }

    .search-bar-container.focused {
      border-color: var(--leaf, #0e6b4f);
      box-shadow: 0 0 0 4px rgba(14, 107, 79, 0.15), 0 4px 12px rgba(28, 25, 21, 0.06);
    }

    /* Category Dropdown Segment */
    .category-segment {
      position: relative;
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      max-width: 160px;
    }

    @media (max-width: 768px) {
      .category-segment {
        max-width: 110px;
      }
    }

    .category-select {
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: none;
      outline: none;
      font-size: 0.82rem;
      font-weight: 560;
      color: var(--ink, #1c1915);
      cursor: pointer;
      padding-right: 1.25rem;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      width: 100%;
    }

    .category-select:focus-visible {
      color: var(--leaf, #0e6b4f);
    }

    .select-caret {
      position: absolute;
      right: 0.15rem;
      pointer-events: none;
      font-size: 0.65rem;
      color: var(--muted, #6f675c);
    }

    .divider {
      width: 1px;
      height: 20px;
      background-color: var(--line, #e4dccb);
      margin: 0 0.5rem;
      flex-shrink: 0;
    }

    /* Input Segment */
    .input-segment {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .search-icon {
      color: var(--muted, #6f675c);
      font-size: 0.95rem;
      margin-right: 0.5rem;
      flex-shrink: 0;
    }

    .search-input {
      width: 100%;
      border: none;
      background: transparent;
      outline: none;
      font-size: 0.92rem;
      color: var(--ink, #1c1915);
      padding: 0.25rem 0.25rem 0.25rem 0;
      font-family: inherit;
    }

    .search-input::placeholder {
      color: #9c9384;
      font-size: 0.86rem;
    }

    .clear-btn {
      background: transparent;
      border: none;
      color: #adb5bd;
      padding: 0.2rem 0.4rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      transition: color 0.15s ease;
    }

    .clear-btn:hover {
      color: var(--sale, #c2410c);
    }

    /* Submit Arrow Button */
    .submit-btn {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: var(--leaf, #0e6b4f);
      color: #ffffff;
      border: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      font-size: 0.85rem;
      transition: all 0.15s ease;
      margin-left: 0.25rem;
    }

    .submit-btn:hover {
      background: var(--leaf-deep, #0a3d2e);
      transform: translateX(1px);
    }

    /* Suggestions Dropdown */
    .search-dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      background: #ffffff;
      border: 1px solid var(--line, #e4dccb);
      border-radius: 18px;
      box-shadow: 0 16px 36px rgba(28, 25, 21, 0.14);
      z-index: 1050;
      overflow: hidden;
      animation: dropdownFade 0.15s ease-out;
    }

    @keyframes dropdownFade {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .dropdown-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem 0.5rem;
      background: #faf8f3;
      border-bottom: 1px solid #f0eae1;
      font-size: 0.76rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted, #6f675c);
    }

    .dropdown-items-list {
      max-height: 340px;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .dropdown-item-row {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.65rem 1rem;
      text-decoration: none;
      color: var(--ink, #1c1915);
      border-bottom: 1px solid #f6f3ee;
      transition: background-color 0.15s ease;
    }

    .dropdown-item-row:hover {
      background: #fdfaf2;
    }

    .dropdown-item-row:last-child {
      border-bottom: none;
    }

    .item-art {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      font-size: 1.35rem;
    }

    .item-details {
      flex: 1;
      min-width: 0;
    }

    .item-name {
      font-size: 0.92rem;
      font-weight: 580;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--ink, #1c1915);
    }

    .item-meta {
      font-size: 0.76rem;
      color: var(--muted, #6f675c);
      display: flex;
      align-items: center;
      gap: 0.3rem;
      margin-top: 0.15rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cat-tag {
      background: #f0ede4;
      padding: 0.05rem 0.4rem;
      border-radius: 4px;
      font-weight: 500;
      color: var(--ink, #1c1915);
    }

    .meta-separator {
      color: #c4bcaf;
    }

    .item-pricing {
      text-align: right;
      flex-shrink: 0;
    }

    .item-price {
      display: block;
      font-weight: 680;
      font-size: 0.95rem;
      color: var(--ink, #1c1915);
    }

    .item-badge {
      display: inline-block;
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--sale, #c2410c);
      background: #ffede6;
      padding: 0.1rem 0.35rem;
      border-radius: 999px;
    }

    .dropdown-footer {
      padding: 0.6rem 0.8rem;
      background: #faf8f3;
      border-top: 1px solid #f0eae1;
      text-align: center;
    }

    .view-all-btn {
      width: 100%;
      background: #ffffff;
      border: 1px solid var(--line, #e4dccb);
      border-radius: 999px;
      padding: 0.45rem 1rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--leaf, #0e6b4f);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .view-all-btn:hover {
      background: var(--leaf, #0e6b4f);
      color: #ffffff;
      border-color: var(--leaf, #0e6b4f);
    }

    /* Loading & Empty States */
    .dropdown-state-loading, .dropdown-state-empty {
      padding: 1.5rem 1rem;
      text-align: center;
      color: var(--muted, #6f675c);
      font-size: 0.88rem;
    }

    .dropdown-state-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
    }

    .empty-icon {
      font-size: 1.5rem;
      color: #c4bcaf;
      margin-bottom: 0.4rem;
      display: block;
    }

    .empty-title {
      font-weight: 600;
      color: var(--ink, #1c1915);
    }

    .empty-hint {
      margin: 0.35rem 0 0;
      font-size: 0.8rem;
    }

    .switch-aisle-btn {
      background: transparent;
      border: none;
      color: var(--leaf, #0e6b4f);
      font-weight: 600;
      text-decoration: underline;
      cursor: pointer;
      padding: 0 0.2rem;
    }
  `],
})
export class SearchBarComponent implements OnInit, OnDestroy {
  private readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly elementRef = inject(ElementRef);

  readonly categories = signal<Category[]>([]);
  readonly selectedCategory = signal<string>('');
  readonly searchTerm = signal<string>('');
  readonly liveResults = signal<Product[]>([]);
  readonly isSearching = signal<boolean>(false);
  readonly isOpen = signal<boolean>(false);
  readonly isFocused = signal<boolean>(false);

  private debounceTimer: any = null;

  readonly selectedCategoryName = computed(() => {
    const slug = this.selectedCategory();
    if (!slug) return 'All Aisles';
    const found = this.categories().find((c) => c.slug === slug);
    return found ? `${found.emoji} ${found.name}` : 'All Aisles';
  });

  getItemCategoryName(item: Product): string {
    if (!item.category) return '';
    if (typeof item.category === 'string') return item.category;
    return item.category.name || '';
  }

  readonly inputPlaceholder = computed(() => {
    const slug = this.selectedCategory();
    if (!slug) return 'Search "doodh", "aloo", "tamatar", "chips"…';
    const found = this.categories().find((c) => c.slug === slug);
    return found ? `Search in ${found.name}…` : 'Search "doodh", "aloo", "tamatar", "chips"…';
  });

  ngOnInit() {
    // Load categories for selector
    void this.shop.categories().then((cats) => {
      this.categories.set(cats);
    }).catch(() => undefined);

    // Sync input and category state from URL query & route params
    this.syncFromUrl();

    // Listen to route changes to keep sync
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.syncFromUrl();
    });
  }

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private syncFromUrl() {
    let currentRoute: ActivatedRoute | null = this.route;
    while (currentRoute?.firstChild) {
      currentRoute = currentRoute.firstChild;
    }

    if (currentRoute) {
      const q = currentRoute.snapshot.queryParamMap.get('q') || '';
      const catParam = currentRoute.snapshot.paramMap.get('slug') || currentRoute.snapshot.queryParamMap.get('category') || '';

      this.searchTerm.set(q);
      this.selectedCategory.set(catParam);
    }
  }

  onCategoryChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const catSlug = target.value;
    this.selectedCategory.set(catSlug);

    // Fetch live suggestions or update current search
    if (this.searchTerm().trim().length >= 2) {
      this.fetchLiveResults(this.searchTerm().trim(), catSlug);
    } else {
      // Direct category filter execution
      this.submitFilter();
    }
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    this.searchTerm.set(value);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const query = value.trim();
    if (query.length >= 2) {
      this.isOpen.set(true);
      this.isSearching.set(true);
      this.debounceTimer = setTimeout(() => {
        this.fetchLiveResults(query, this.selectedCategory());
      }, 220);
    } else {
      this.liveResults.set([]);
      this.isSearching.set(false);
      this.isOpen.set(false);
    }
  }

  private fetchLiveResults(query: string, category: string) {
    void this.shop
      .products({
        search: query,
        category: category || undefined,
        limit: 6,
      })
      .then((page) => {
        this.liveResults.set(page.items);
      })
      .catch(() => {
        this.liveResults.set([]);
      })
      .finally(() => {
        this.isSearching.set(false);
      });
  }

  onInputFocus() {
    this.isFocused.set(true);
    if (this.searchTerm().trim().length >= 2) {
      this.isOpen.set(true);
      if (this.liveResults().length === 0) {
        this.fetchLiveResults(this.searchTerm().trim(), this.selectedCategory());
      }
    }
  }

  clearSearch() {
    this.searchTerm.set('');
    this.liveResults.set([]);
    this.isOpen.set(false);
    this.submitFilter();
  }

  resetCategory() {
    this.selectedCategory.set('');
    if (this.searchTerm().trim().length >= 2) {
      this.fetchLiveResults(this.searchTerm().trim(), '');
    } else {
      this.submitFilter();
    }
  }

  onSubmit(event: Event) {
    event.preventDefault();
    this.submitFilter();
  }

  submitSearch() {
    this.submitFilter();
  }

  submitFilter() {
    this.closeDropdown();
    const query = this.searchTerm().trim();
    const cat = this.selectedCategory();

    const queryParams: Record<string, string | null> = {};
    if (query) queryParams['q'] = query;

    if (cat) {
      void this.router.navigate(['/c', cat], {
        queryParams: query ? { q: query } : {},
      });
    } else {
      void this.router.navigate(['/'], {
        queryParams: query ? { q: query } : {},
      });
    }
  }

  onSelectProduct() {
    this.closeDropdown();
  }

  closeDropdown() {
    this.isOpen.set(false);
    this.isFocused.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }
}
