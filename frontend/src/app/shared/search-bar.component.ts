import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Product } from '../core/models';
import { ShopService } from '../core/shop.service';
import { InrPipe } from './inr.pipe';
import { VoiceSearchModalComponent } from './voice-search-modal.component';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [RouterLink, InrPipe, VoiceSearchModalComponent],
  template: `
    <div class="search-bar-wrap" #container>
      <form class="search-bar-container" [class.focused]="isFocused()" (submit)="onSubmit($event)">
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
            placeholder='Search "milk", "bananas", "atta", "chips"…'
            aria-label="Search grocery items by name or keyword"
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
          <!-- Multi-Language Voice Search Mic Button -->
          <button
            type="button"
            class="mic-btn"
            (click)="openVoiceSearch($event)"
            aria-label="Voice search in English, Hindi, Kannada, Tamil, etc."
            title="Search with voice (English, Hindi, Kannada, Tamil, etc.)"
          >
            <i class="bi bi-mic-fill"></i>
          </button>
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

      <!-- Multi-Language Voice Search Modal -->
      @if (showVoiceModal()) {
        <app-voice-search-modal
          (querySelected)="onVoiceQuery($event)"
          (closed)="showVoiceModal.set(false)"
        />
      }

      <!-- Autocomplete & Quick Filter Dropdown -->
      @if (isOpen() && (isSearching() || liveResults().length > 0 || (searchTerm().trim().length >= 2 && liveResults().length === 0))) {
        <div class="search-dropdown-menu" (mousedown)="$event.preventDefault()">
          @if (isSearching()) {
            <div class="dropdown-header">
              <span class="header-title">Checking the shelves…</span>
              <span class="spinner-border spinner-border-sm text-success" role="status"></span>
            </div>
            <div class="dropdown-items-list" aria-label="Loading search items">
              @for (row of [1, 2, 3, 4]; track row) {
                <div class="dropdown-item-row skeleton-search-row">
                  <div class="item-art skeleton-shimmer"></div>
                  <div class="item-details">
                    <div class="skeleton-shimmer mb-1" style="width: 70%; height: 13px; border-radius: 4px;"></div>
                    <div class="d-flex align-items-center gap-2">
                      <div class="skeleton-shimmer" style="width: 50px; height: 10px; border-radius: 4px;"></div>
                      <div class="skeleton-shimmer" style="width: 40px; height: 10px; border-radius: 4px;"></div>
                    </div>
                  </div>
                  <div class="item-pricing">
                    <div class="skeleton-shimmer ms-auto" style="width: 46px; height: 16px; border-radius: 4px;"></div>
                  </div>
                </div>
              }
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
              <p class="empty-hint">Try searching for "doodh", "aloo", "tamatar", "pyaaz", "dahi", or "bread".</p>
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
      background: var(--search-bg, #141b26);
      border: 1.5px solid var(--search-border, rgba(255, 255, 255, 0.1));
      border-radius: 999px;
      padding: 0.2rem 0.35rem 0.2rem 1rem;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: var(--shadow);
      min-height: 44px;
    }

    .search-bar-container:hover {
      border-color: var(--leaf);
      box-shadow: 0 4px 14px var(--leaf-glow, rgba(0, 0, 0, 0.1));
    }

    .search-bar-container.focused {
      border-color: var(--leaf);
      box-shadow: 0 0 0 3px var(--leaf-glow, rgba(0, 229, 153, 0.22)), var(--shadow);
      background: var(--search-bg-focus, #162030);
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
      color: var(--muted, #94a3b8);
      font-size: 0.95rem;
      margin-right: 0.6rem;
      flex-shrink: 0;
    }

    .search-input {
      width: 100%;
      border: none;
      background: transparent;
      outline: none;
      font-size: 0.92rem;
      color: var(--ink, #f8fafc);
      font-weight: 500;
      padding: 0.2rem 0;
    }

    .search-input::placeholder {
      color: var(--muted, #64748b);
      font-weight: 400;
    }

    .clear-btn {
      background: none;
      border: none;
      color: var(--muted, #64748b);
      cursor: pointer;
      padding: 0 0.4rem;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease;
    }

    .clear-btn:hover {
      color: var(--ink, #f8fafc);
    }

    .mic-btn {
      background: none;
      border: none;
      color: var(--leaf, #00e599);
      cursor: pointer;
      padding: 0 0.4rem;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.18s ease;
      border-radius: 50%;
      height: 32px;
      width: 32px;
      flex-shrink: 0;
      margin-left: 0.15rem;
    }

    .mic-btn:hover {
      background: var(--leaf-glow, rgba(0, 229, 153, 0.18));
      transform: scale(1.08);
      color: var(--leaf, #00e599);
    }

    .mic-btn:active {
      transform: scale(0.94);
    }

    /* Submit Button */
    .submit-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--chip-bg, #1e293b);
      border: 1px solid var(--chip-border, rgba(255, 255, 255, 0.1));
      color: var(--leaf-text, var(--leaf, #00e599));
      display: grid;
      place-items: center;
      flex-shrink: 0;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.15s ease;
      margin-left: 0.25rem;
    }

    .submit-btn:hover {
      background: var(--leaf, #00e599);
      border-color: var(--leaf, #00e599);
      color: var(--stepper-text, #0b0f15);
    }

    @media (max-width: 768px) {
      .search-bar-container {
        min-height: 44px;
        padding: 0.25rem 0.35rem 0.25rem 0.9rem;
      }

      .search-input {
        font-size: 0.92rem;
      }

      .search-icon {
        font-size: 1rem;
        margin-right: 0.55rem;
      }

      .mic-btn {
        width: 30px;
        height: 30px;
        font-size: 0.95rem;
      }

      .submit-btn {
        width: 34px;
        height: 34px;
        font-size: 0.9rem;
      }

      .clear-btn {
        padding: 0 0.45rem;
        font-size: 0.95rem;
      }

      .dropdown-item-row {
        padding: 0.7rem 0.85rem;
      }

      .item-art {
        width: 42px;
        height: 42px;
        font-size: 1.35rem;
      }
    }

    /* Dropdown */
    .search-dropdown-menu {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: var(--dropdown-bg, rgba(18, 23, 33, 0.97));
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--card-border, rgba(255, 255, 255, 0.12));
      border-radius: 18px;
      box-shadow: var(--shadow-lg, 0 20px 48px rgba(0, 0, 0, 0.7));
      z-index: 1200;
      overflow: hidden;
      animation: dropdownSlide 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes dropdownSlide {
      from {
        opacity: 0;
        transform: translateY(-6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dropdown-state-loading {
      padding: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      color: var(--muted, #94a3b8);
      font-size: 0.9rem;
    }

    .dropdown-header {
      padding: 0.6rem 1rem;
      background: var(--dropdown-header-bg, #0e131d);
      border-bottom: 1px solid var(--line, rgba(255, 255, 255, 0.08));
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.76rem;
    }

    .header-title {
      font-weight: 600;
      color: var(--muted, #94a3b8);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .header-count {
      color: var(--muted, #64748b);
    }

    .dropdown-items-list {
      max-height: 380px;
      overflow-y: auto;
    }

    .dropdown-item-row {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.65rem 1rem;
      text-decoration: none;
      color: var(--ink, #f1f5f9);
      border-bottom: 1px solid var(--line-light, rgba(255, 255, 255, 0.04));
      transition: background-color 0.15s ease;
    }

    .dropdown-item-row:hover {
      background: var(--leaf-glow, rgba(0, 229, 153, 0.08));
    }

    .skeleton-search-row {
      pointer-events: none;
      user-select: none;
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
      background: var(--tile-art-bg, #0b0f15);
      border: 1px solid var(--line, rgba(255, 255, 255, 0.06));
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
      color: var(--ink, #f8fafc);
    }

    .item-meta {
      font-size: 0.76rem;
      color: var(--muted, #94a3b8);
      display: flex;
      align-items: center;
      gap: 0.3rem;
      margin-top: 0.15rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cat-tag {
      background: var(--chip-bg, #1e293b);
      padding: 0.05rem 0.4rem;
      border-radius: 4px;
      font-weight: 500;
      color: var(--muted, #cbd5e1);
      border: 1px solid var(--line, transparent);
    }

    .meta-separator {
      color: var(--muted, #475569);
    }

    .item-pricing {
      text-align: right;
      flex-shrink: 0;
    }

    .item-price {
      display: block;
      font-weight: 680;
      font-size: 0.95rem;
      color: var(--leaf-text, var(--leaf, #00e599));
    }

    .item-badge {
      display: inline-block;
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--copper, #e59880);
      background: var(--copper-glow, rgba(229, 152, 128, 0.16));
      border: 1px solid var(--copper-glow, rgba(229, 152, 128, 0.3));
      padding: 0.1rem 0.35rem;
      border-radius: 999px;
    }

    .dropdown-footer {
      padding: 0.6rem 0.8rem;
      background: var(--dropdown-header-bg, #0e131d);
      border-top: 1px solid var(--line, rgba(255, 255, 255, 0.06));
      text-align: center;
    }

    .view-all-btn {
      width: 100%;
      background: var(--chip-bg, #182232);
      border: 1px solid var(--leaf-glow, rgba(0, 229, 153, 0.3));
      border-radius: 999px;
      padding: 0.45rem 1rem;
      font-size: 0.85rem;
      font-weight: 550;
      color: var(--leaf-text, var(--leaf, #00e599));
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .view-all-btn:hover {
      background: var(--leaf, #00e599);
      color: var(--stepper-text, #0b0f15);
      border-color: var(--leaf, #00e599);
    }

    .dropdown-state-empty {
      padding: 2rem 1.5rem;
      text-align: center;
    }

    .empty-icon {
      font-size: 1.8rem;
      color: #475569;
      margin-bottom: 0.4rem;
      display: block;
    }

    .empty-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #f8fafc;
      margin-bottom: 0.35rem;
    }

    .empty-hint {
      font-size: 0.82rem;
      color: #94a3b8;
      margin: 0;
    }
  `],
})
export class SearchBarComponent implements OnInit, OnDestroy {
  private readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly elementRef = inject(ElementRef);

  readonly searchTerm = signal<string>('');
  readonly liveResults = signal<Product[]>([]);
  readonly isSearching = signal<boolean>(false);
  readonly isOpen = signal<boolean>(false);
  readonly isFocused = signal<boolean>(false);
  readonly showVoiceModal = signal<boolean>(false);

  private debounceTimer: any = null;

  getItemCategoryName(item: Product): string {
    if (!item.category) return '';
    if (typeof item.category === 'string') return item.category;
    return item.category.name || '';
  }

  ngOnInit() {
    this.syncFromUrl();

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
      this.searchTerm.set(q);
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
        this.fetchLiveResults(query);
      }, 220);
    } else {
      this.liveResults.set([]);
      this.isSearching.set(false);
      this.isOpen.set(false);
    }
  }

  private fetchLiveResults(query: string) {
    void this.shop
      .products({
        search: query,
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
        this.fetchLiveResults(this.searchTerm().trim());
      }
    }
  }

  clearSearch() {
    this.searchTerm.set('');
    this.liveResults.set([]);
    this.isOpen.set(false);
    this.submitFilter();
  }

  onSubmit(event: Event) {
    event.preventDefault();
    this.submitFilter();
  }

  submitFilter() {
    this.closeDropdown();
    const query = this.searchTerm().trim();
    void this.router.navigate(['/'], {
      queryParams: query ? { q: query } : {},
    });
  }

  openVoiceSearch(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.closeDropdown();
    this.showVoiceModal.set(true);
  }

  onVoiceQuery(query: string) {
    this.showVoiceModal.set(false);
    if (query && query.trim()) {
      this.searchTerm.set(query.trim());
      this.submitFilter();
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
