import { Component, ElementRef, computed, inject, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Product } from '../core/models';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ThemeService } from '../core/theme.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { ProductCard } from '../shared/product-card.component';
import { ProductDetailSkeletonComponent } from '../shared/product-detail-skeleton.component';

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [InrPipe, RouterLink, ProductCard, ProductDetailSkeletonComponent],
  template: `
    @if (loading()) {
      <app-product-detail-skeleton />
    } @else if (error()) {
      <div class="empty panel text-center py-5">
        <i class="bi bi-basket3 text-muted display-4 mb-3 d-block"></i>
        <h2>Item not found on the shelf</h2>
        <p class="text-muted">{{ error() }}</p>
        <a routerLink="/" class="btn btn-dark mt-2">Browse All Groceries</a>
      </div>
    } @else if (product(); as item) {
      <!-- BREADCRUMB -->
      <nav class="d-flex align-items-center gap-2 small text-muted mb-3" aria-label="Breadcrumb">
        <a class="text-decoration-none text-muted" routerLink="/">Aisles</a>
        <span>/</span>
        @if (categorySlug(item)) {
          <a class="text-decoration-none text-muted" [routerLink]="['/c', categorySlug(item)]">{{ categoryName(item) }}</a>
          <span>/</span>
        }
        <span class="fw-semibold text-truncate">{{ item.name }}</span>
      </nav>

      <!-- MAIN PRODUCT PURCHASE HERO WITH MULTI-ANGLE GALLERY -->
      <div class="split">
        <div class="product-gallery-container">
          <div class="panel d-grid product-detail-hero" [style.background]="getProductHeroBg(item)">
            @if (activePhotoUrl() && !imgFailed()) {
              <img [src]="activePhotoUrl()" [alt]="item.name" class="product-hero-img" (error)="imgFailed.set(true)" />
            } @else {
              <span style="font-size: 7rem">{{ item.emoji }}</span>
            }
            @if (item.discountPercent > 0) {
              <div class="product-hero-badge">
                <i class="bi bi-tag-fill me-1"></i> {{ item.discountPercent }}% OFF
              </div>
            }
            @if (galleryPhotos().length > 1) {
              <div class="gallery-angle-tag">
                <i class="bi bi-camera me-1"></i> {{ activePhotoLabel() }}
              </div>
            }
          </div>

          <!-- Multi-Angle Thumbnail Strip -->
          @if (galleryPhotos().length > 1) {
            <div class="gallery-thumbnails mt-2 d-flex gap-2 justify-content-center flex-wrap">
              @for (photo of galleryPhotos(); track photo.slot) {
                <button
                  type="button"
                  class="thumb-pill-btn"
                  [class.active]="selectedSlot() === photo.slot"
                  (click)="selectSlot(photo.slot)"
                >
                  <img [src]="photo.url" [alt]="photo.label" class="thumb-mini-img" />
                  <span>{{ photo.label }}</span>
                </button>
              }
            </div>
          }
        </div>

        <div class="panel d-flex flex-column justify-content-between">
          <div>
            <div class="d-flex align-items-center justify-content-between mb-1">
              <span class="eyebrow text-uppercase text-muted fw-bold mb-0" style="font-size: 0.76rem; letter-spacing: 0.05em;">
                {{ categoryName(item) }}
              </span>
              <span class="badge bg-success-subtle text-success border border-success-subtle small">
                <i class="bi bi-lightning-charge-fill me-1"></i> 12 Mins Delivery
              </span>
            </div>

            <h1 class="h2 fw-bold text-dark mb-1">{{ item.name }}</h1>
            <p class="text-muted mb-3">{{ item.brand }} · {{ item.unit }}</p>

            <div class="d-flex align-items-baseline gap-2 mb-3">
              <strong class="fs-2 text-dark">{{ item.price | inr }}</strong>
              @if (item.mrp > item.price) {
                <s class="text-muted fs-5">{{ item.mrp | inr }}</s>
                <span class="badge bg-danger-subtle text-danger border border-danger-subtle">
                  Save {{ (item.mrp - item.price) | inr }}
                </span>
              }
            </div>

            <p class="text-secondary leading-relaxed mb-4">{{ item.description }}</p>

            <div class="d-flex align-items-center gap-2 mb-3">
              @if (item.stock < 1) {
                <span class="badge bg-danger-subtle text-danger px-2 py-1">Out of stock</span>
              } @else if (item.stock < 10) {
                <span class="badge bg-warning-subtle text-warning-emphasis px-2 py-1">
                  Only {{ item.stock }} units left in dark store
                </span>
              } @else {
                <span class="badge bg-light text-muted border px-2 py-1">
                  <i class="bi bi-check2-circle text-success me-1"></i> In stock
                </span>
              }
            </div>

            @if (!item.isReturnable) {
              <div class="mb-3">
                <span class="badge bg-light text-secondary border py-1 px-2 d-inline-flex align-items-center gap-1">
                  <i class="bi bi-shield-x text-danger"></i> Non-returnable perishable grocery
                </span>
              </div>
            }
          </div>

          <div>
            @if (item.stock < 1) {
              <div class="p-3 bg-light rounded text-center text-muted fw-semibold">
                Currently Out of Stock
              </div>
            } @else if (qty() === 0) {
              <button class="btn btn-dark w-100 py-3 fw-bold fs-6 shadow-sm d-flex align-items-center justify-content-center gap-2" type="button" [disabled]="busy()" (click)="add()">
                @if (busy()) {
                  <span class="spinner-border spinner-border-sm" role="status"></span>
                  <span>Adding…</span>
                } @else {
                  <i class="bi bi-basket2-fill"></i> Add to Basket
                }
              </button>
            } @else {
              <div class="stepper-wrap p-2 border rounded-3 bg-light d-flex align-items-center justify-content-between">
                <span class="small fw-semibold text-muted ms-2">Added to basket:</span>
                <div class="stepper">
                  <button type="button" [disabled]="busy()" (click)="change(qty() - 1)">−</button>
                  <span class="fw-bold px-3">{{ qty() }}</span>
                  <button type="button" [disabled]="busy()" (click)="change(qty() + 1)">+</button>
                </div>
              </div>
            }

            @if (!item.isReturnable) {
              <div class="p-2 mt-3 rounded-2 bg-light border small text-muted">
                <i class="bi bi-shield-check text-success me-1"></i>
                <strong>ZapBasket Food Safety Assurance:</strong> Hand-picked cold from our local dark store. If damaged or missing, file a 1-click photo claim for an instant refund.
              </div>
            }
          </div>
        </div>
      </div>

      <!-- RECOMMENDATIONS: FREQUENTLY BOUGHT TOGETHER -->
      @if (frequentlyBought().length > 0) {
        <section class="recommendations-section mt-5 pt-4 border-top">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <div>
              <div class="d-flex align-items-center gap-2">
                <h3 class="h5 fw-bold mb-0 text-dark">Frequently Bought Together</h3>
                <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle small">Popular Pairings</span>
              </div>
              <p class="text-muted small mb-0">Customers who bought {{ item.name }} often added these to their basket</p>
            </div>
            <div class="carousel-nav-arrows d-none d-md-flex gap-1">
              <button type="button" class="btn btn-sm btn-outline-secondary rounded-circle" (click)="scrollTrack(freqTrack, -300)" aria-label="Previous items">
                <i class="bi bi-chevron-left"></i>
              </button>
              <button type="button" class="btn btn-sm btn-outline-secondary rounded-circle" (click)="scrollTrack(freqTrack, 300)" aria-label="Next items">
                <i class="bi bi-chevron-right"></i>
              </button>
            </div>
          </div>

          <div class="carousel-track" #freqTrack>
            @for (rec of frequentlyBought(); track rec.id) {
              <div class="carousel-card-item">
                <app-product-card [product]="rec" />
              </div>
            }
          </div>
        </section>
      }

      <!-- RECOMMENDATIONS: SIMILAR ITEMS IN THIS AISLE -->
      @if (similarProducts().length > 0) {
        <section class="recommendations-section mt-5 pt-4 border-top">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <div>
              <div class="d-flex align-items-center gap-2">
                <h3 class="h5 fw-bold mb-0 text-dark">Similar Items in {{ categoryName(item) }}</h3>
                <span class="badge bg-light text-muted border small">{{ similarProducts().length }} options</span>
              </div>
              <p class="text-muted small mb-0">More essentials and alternative brands from this aisle</p>
            </div>
            <div class="d-flex align-items-center gap-2">
              @if (categorySlug(item)) {
                <a [routerLink]="['/c', categorySlug(item)]" class="btn btn-sm btn-link text-decoration-none text-dark fw-semibold p-0 me-2 d-none d-sm-inline">
                  View all in aisle <i class="bi bi-arrow-right"></i>
                </a>
              }
              <div class="carousel-nav-arrows d-none d-md-flex gap-1">
                <button type="button" class="btn btn-sm btn-outline-secondary rounded-circle" (click)="scrollTrack(simTrack, -300)" aria-label="Previous items">
                  <i class="bi bi-chevron-left"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary rounded-circle" (click)="scrollTrack(simTrack, 300)" aria-label="Next items">
                  <i class="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>

          <div class="carousel-track" #simTrack>
            @for (sim of similarProducts(); track sim.id) {
              <div class="carousel-card-item">
                <app-product-card [product]="sim" />
              </div>
            }
          </div>
        </section>
      }

      <!-- SERVICE & FRESHNESS TRUST STRIP -->
      <section class="mt-5 pt-4 border-top">
        <div class="row g-3 text-center">
          <div class="col-12 col-md-4">
            <div class="p-3 border rounded-3 bg-white h-100 shadow-sm">
              <i class="bi bi-lightning-charge-fill text-warning fs-3 mb-2 d-block"></i>
              <strong class="d-block text-dark">12-Minute Fast Delivery</strong>
              <small class="text-muted">Packed cold & dispatched from Koramangala dark store straight to your door</small>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="p-3 border rounded-3 bg-white h-100 shadow-sm">
              <i class="bi bi-snow text-info fs-3 mb-2 d-block"></i>
              <strong class="d-block text-dark">Cold Chain Freshness</strong>
              <small class="text-muted">Chilled dairy, leafy greens & beverages kept at optimal temperature</small>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="p-3 border rounded-3 bg-white h-100 shadow-sm">
              <i class="bi bi-shield-check text-success fs-3 mb-2 d-block"></i>
              <strong class="d-block text-dark">Instant Self-Service Refund</strong>
              <small class="text-muted">Damaged or missing items? Upload a photo for immediate store refund approval</small>
            </div>
          </div>
        </div>
      </section>
    }
  `,
  styles: [`
    .product-detail-hero {
      position: relative;
      min-height: 320px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      overflow: hidden;
    }

    .product-hero-img {
      max-width: 85%;
      max-height: 280px;
      object-fit: contain;
      filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.08));
      transition: transform 0.3s ease;
    }

    .product-hero-img:hover {
      transform: scale(1.04);
    }

    .product-hero-badge {
      position: absolute;
      top: 1rem;
      left: 1rem;
      background: #c2410c;
      color: #ffffff;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      letter-spacing: 0.03em;
      box-shadow: 0 4px 10px rgba(194, 65, 12, 0.3);
    }

    .stepper-wrap {
      border-color: var(--line, #e4dccb) !important;
    }

    /* Recommendation Carousels */
    .recommendations-section {
      position: relative;
    }

    .carousel-track {
      display: flex;
      gap: 1rem;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      padding: 0.4rem 0.2rem 1.2rem 0.2rem;
      scrollbar-width: thin;
      scrollbar-color: #d8d0c2 transparent;
      scroll-behavior: smooth;
    }

    .carousel-track::-webkit-scrollbar {
      height: 6px;
    }

    .carousel-track::-webkit-scrollbar-thumb {
      background: #d8d0c2;
      border-radius: 999px;
    }

    .carousel-card-item {
      flex: 0 0 205px;
      max-width: 220px;
      scroll-snap-align: start;
    }

    @media (max-width: 576px) {
      .carousel-card-item {
        flex: 0 0 165px;
        max-width: 175px;
      }
    }

    .carousel-nav-arrows button {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      padding: 0;
    }
  `],
})
export class ProductPage {
  private readonly shop = inject(ShopService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  readonly themeService = inject(ThemeService);

  getProductHeroBg(item: Product): string {
    if (item.imageUrl && !this.imgFailed()) {
      return this.themeService.isDark() ? 'rgba(255, 255, 255, 0.03)' : '#ffffff';
    }
    if (item.tint && item.tint.startsWith('#') && item.tint.length === 7) {
      return this.themeService.isDark() ? item.tint + '22' : item.tint;
    }
    return this.themeService.isDark() ? 'rgba(255, 255, 255, 0.03)' : '#ffffff';
  }

  readonly product = signal<Product | null>(null);
  readonly similarProducts = signal<Product[]>([]);
  readonly frequentlyBought = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly imgFailed = signal(false);

  readonly selectedSlot = signal<'front' | 'back' | 'detail'>('front');

  readonly galleryPhotos = computed(() => {
    const p = this.product();
    if (!p) return [];
    const list: { slot: 'front' | 'back' | 'detail'; label: string; url: string }[] = [];
    if (p.imageSlots?.front || p.imageUrl) {
      list.push({ slot: 'front', label: 'Front View', url: p.imageSlots?.front || p.imageUrl || '' });
    }
    if (p.imageSlots?.back) {
      list.push({ slot: 'back', label: 'Back View', url: p.imageSlots.back });
    } else if (p.images && p.images[1]) {
      list.push({ slot: 'back', label: 'Back View', url: p.images[1] });
    }
    if (p.imageSlots?.detail) {
      list.push({ slot: 'detail', label: 'Detail View', url: p.imageSlots.detail });
    } else if (p.images && p.images[2]) {
      list.push({ slot: 'detail', label: 'Detail View', url: p.images[2] });
    }
    return list;
  });

  readonly activePhotoUrl = computed(() => {
    const photos = this.galleryPhotos();
    if (photos.length === 0) return this.product()?.imageUrl || '';
    const found = photos.find((x) => x.slot === this.selectedSlot());
    return found ? found.url : (photos[0]?.url || this.product()?.imageUrl || '');
  });

  readonly activePhotoLabel = computed(() => {
    const photos = this.galleryPhotos();
    const found = photos.find((x) => x.slot === this.selectedSlot());
    return found ? found.label : 'Front View';
  });

  selectSlot(slot: 'front' | 'back' | 'detail') {
    this.selectedSlot.set(slot);
    this.imgFailed.set(false);
  }

  readonly qty = computed(() => {
    const current = this.product();
    if (!current) return 0;
    return this.shop.cart()?.items.find((item) => item.productId === current.id)?.quantity ?? 0;
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') || '';
      this.loadProduct(slug);
    });
  }

  private loadProduct(slug: string) {
    this.loading.set(true);
    this.imgFailed.set(false);
    this.selectedSlot.set('front');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.shop.product(slug).then((item) => {
      this.product.set(item);
      this.error.set('');
      this.loadRecommendations(item);
    }).catch((error: unknown) => {
      this.product.set(null);
      this.similarProducts.set([]);
      this.frequentlyBought.set([]);
      this.error.set(errorMessage(error, 'That product is not on the shelf.'));
    }).finally(() => this.loading.set(false));
  }

  private loadRecommendations(item: Product) {
    const catSlug = this.categorySlug(item);

    // 1. Similar Products in Same Aisle
    if (catSlug) {
      this.shop.products({ category: catSlug, limit: 12 }).then((page) => {
        this.similarProducts.set(page.items.filter((p) => p.id !== item.id));
      }).catch(() => this.similarProducts.set([]));
    } else {
      this.similarProducts.set([]);
    }

    // 2. Frequently Bought Together (Cross-Category Pairing)
    const pairMap: Record<string, string> = {
      'fruits-vegetables': 'dairy-breakfast',
      'dairy-breakfast': 'instant-food',
      'snacks-munchies': 'cold-drinks',
      'cold-drinks': 'snacks-munchies',
      'instant-food': 'cold-drinks',
    };
    const pairCategorySlug = pairMap[catSlug] || '';

    this.shop.products({ category: pairCategorySlug || undefined, limit: 10 }).then((page) => {
      const candidates = page.items.filter((p) => p.id !== item.id);
      this.frequentlyBought.set(candidates.slice(0, 8));
    }).catch(() => {
      this.frequentlyBought.set([]);
    });
  }

  categoryName(product: Product): string {
    return typeof product.category === 'string' ? '' : product.category?.name || '';
  }

  categorySlug(product: Product): string {
    if (!product.category) return '';
    return typeof product.category === 'string' ? product.category : product.category?.slug || '';
  }

  scrollTrack(element: HTMLElement, offset: number) {
    element.scrollBy({ left: offset, behavior: 'smooth' });
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
    if (this.auth.user()?.role !== 'customer') {
      this.toasts.error('Use a customer account to add items to your basket.');
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
